import cron from 'node-cron';
import { createDbClient, eq } from '@payit/db';
import { automationPolicies, entities, ledgerEntries } from '@payit/db/schema';
import { env } from './env.js';
const db = createDbClient(env.DATABASE_URL);
import { PodsClient } from '@payit/integrations';

const podsClient = new PodsClient();

import { getEntityBalance } from './utils/balance.js';

async function getUsdCashBalance(entityId: string): Promise<number> {
  const [usdc, usdt] = await Promise.all([
    getEntityBalance(db, entityId, 'USDC', 'cash'),
    getEntityBalance(db, entityId, 'USDT', 'cash'),
  ]);
  return usdc + usdt;
}

export function initScheduler() {
  // 1. Run 5-Hour Idle Auto-Sweep every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Scheduler] Running 5-hour idle auto-sweep check...');
    try {
      const allEntities = await db.select().from(entities);
      
      for (const entity of allEntities) {
        try {
          if (entity.autoSaveEnabled !== 1) continue;
          const policyRows = await db.select().from(automationPolicies).where(eq(automationPolicies.entityId, entity.id)).limit(1);
          const policy = policyRows[0];
          if (!policy || policy.status !== 'ACTIVE' || new Date(policy.expiresAt) <= new Date()) continue;
          const idleSince = entity.autoSaveIdleSince ? new Date(entity.autoSaveIdleSince).getTime() : 0;
          if (!idleSince || Date.now() - idleSince < 5 * 60 * 60 * 1000) continue;
          const balance = await getUsdCashBalance(entity.id);
          const liquidBuffer = Number(entity.autoSaveLiquidBufferUsd || 50);
          const sweepAmount = balance - liquidBuffer;
          if (sweepAmount <= 0) continue;

          const strategies = await podsClient.getBaseStrategies();
          const bestStrategy = strategies
            .filter(strategy => !strategy.paused && strategy.asset?.toLowerCase().includes('usdc'))
            .sort((left, right) => right.apy - left.apy)[0];
          if (!bestStrategy) continue;

          console.log(`[Scheduler] Auto-save approval required: ${sweepAmount.toFixed(2)} USD for entity ${entity.id} into ${bestStrategy.id}`);
        } catch (e: any) {
          console.error(`[Scheduler] Error sweeping for entity ${entity.id}:`, e.message);
        }
      }
    } catch (err: any) {
      console.error('[Scheduler] Auto-sweep cron error:', err.message);
    }
  });

  // 2. Run Webhook Outbox Retry Worker every 1 minute
  cron.schedule('* * * * *', async () => {
    try {
      const { WebhookDispatcher } = await import('./services/webhookDispatcher.js');
      await WebhookDispatcher.processPendingRetries();
    } catch (err: any) {
      console.warn('[Webhook Retry Worker Warning]:', err.message);
    }
  });

  // 3. Initialize Intent Poller for automatic NEAR Intents status polling
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const { IntentPoller } = await import('./services/intentPoller.js');
      await IntentPoller.pollPendingIntents();
    } catch (err: any) {
      console.warn('[Intent Poller Warning]:', err.message);
    }
  });

  // 4. Initialize Intent Retry Manager for exponential backoff retries
  cron.schedule('*/5 * * * * *', async () => {
    try {
      const { IntentRetryManager } = await import('./services/intentRetryManager.js');
      await IntentRetryManager.processRetries();
    } catch (err: any) {
      console.warn('[Intent Retry Manager Warning]:', err.message);
    }
  });

  console.log('[Scheduler] 5-hour idle auto-sweep, 1-minute webhook outbox worker, 30-second intent poller, and 5-second intent retry manager initialized.');
}
