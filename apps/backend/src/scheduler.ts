import cron from 'node-cron';
import { createDbClient, eq } from '@payit/db';
import { entities, ledgerEntries } from '@payit/db/schema';
import { env } from './env.js';
const db = createDbClient(env.DATABASE_URL);
import { PodsClient } from '@payit/integrations';

const podsClient = new PodsClient();

import { getEntityBalance } from './utils/balance.js';

async function getUsdCashBalance(entityId: string): Promise<number> {
  return await getEntityBalance(db, entityId, 'USD', 'cash');
}

export function initScheduler() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Scheduler] Running 5-hour idle auto-sweep check...');
    try {
      const allEntities = await db.select().from(entities);
      
      for (const entity of allEntities) {
        try {
          const balance = await getUsdCashBalance(entity.id);
          if (balance > 0) {
            // Find base strategy
            const strategies = await podsClient.getBaseStrategies();
            if (strategies.length > 0) {
              const bestStrategy = strategies[0];
              console.log(`[Scheduler] Auto-sweep candidate: ${balance} USD for entity ${entity.id} into ${bestStrategy.id}`);
            }
          }
        } catch (e: any) {
          console.error(`[Scheduler] Error sweeping for entity ${entity.id}:`, e.message);
        }
      }
    } catch (err: any) {
      console.error('[Scheduler] Auto-sweep cron error:', err.message);
    }
  });
  
  console.log('[Scheduler] 5-hour idle auto-sweep initialized.');
}
