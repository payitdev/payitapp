import cron from 'node-cron';
import { createDbClient, eq, and, or } from '@payit/db';
import { automationPolicies, entities, intentSwaps, termVaults, users } from '@payit/db/schema';
import { env } from './env.js';
import { KaminoClient, NEARIntentsClient, PrivyNEARBridge, signAndSubmitTransaction, toBaseUnits } from '@payit/integrations';
const db = createDbClient(env.DATABASE_URL);
const kaminoClient = new KaminoClient();
const nearIntentsClient = new NEARIntentsClient({
  oneClickApiKey: env.NEAR_INTENT_1CLICK_API_KEY,
  explorerApiKey: env.NEAR_INTENT_EXPLORER_API_KEY,
  baseUrl: env.NEAR_INTENT_BASE_URL,
});
const activeAutoSaves = new Set<string>();

function encodeErc20Transfer(recipient: string, amount: bigint): string {
  const cleanRecipient = recipient.replace(/^0x/, '').padStart(64, '0');
  return `0xa9059cbb${cleanRecipient}${amount.toString(16).padStart(64, '0')}`;
}

async function reconcileKaminoPositions() {
  const pendingVaults = await db.select().from(termVaults).where(and(
    eq(termVaults.protocol, 'kamino'),
    or(eq(termVaults.status, 'SOLVING'), eq(termVaults.status, 'LOCKED'), eq(termVaults.status, 'MATURED')),
  )).limit(100);
  for (const vault of pendingVaults) {
    if (!vault.solanaRecipientAddress) continue;
    try {
      const positions = await kaminoClient.getUserPositions(vault.solanaRecipientAddress);
      const vaultAddress = vault.vaultName.match(/\(([^)]+)\)$/)?.[1] || vault.vaultName;
      const position = positions.find((candidate: any) => String(candidate.vaultId || candidate.vaultAddress) === String(vaultAddress));
      const shares = Number(position?.actualShares || 0);
      if (!position || position.onChainVerified === false || !Number.isFinite(shares) || shares <= 0) continue;
      const matured = new Date(vault.unlockDate) <= new Date();
      await db.update(termVaults).set({
        sharesMinted: String(shares),
        accruedInterestUsd: Number(position.accruedInterestUsd || 0).toFixed(2),
        status: matured ? 'MATURED' : 'LOCKED',
        onChainSyncTimestamp: new Date(),
      }).where(and(eq(termVaults.id, vault.id), or(eq(termVaults.status, 'SOLVING'), eq(termVaults.status, 'LOCKED'), eq(termVaults.status, 'MATURED'))));
    } catch (error: any) {
      console.warn(`[Scheduler] Kamino reconciliation failed for ${vault.id}:`, error.message);
    }
  }
}

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
          const policyLimit = Number(policy.maxPerTransactionUsd || 1000);
          const sweepAmount = Math.min(balance - liquidBuffer, policyLimit);
          if (sweepAmount <= 0) continue;

          const inFlight = await db.select({ id: intentSwaps.id }).from(intentSwaps).where(and(
            eq(intentSwaps.entityId, entity.id),
            or(eq(intentSwaps.status, 'PENDING_DEPOSIT'), eq(intentSwaps.status, 'SUBMITTED'), eq(intentSwaps.status, 'SOLVING')),
          )).limit(1);
          if (inFlight.length > 0) continue;
          if (activeAutoSaves.has(entity.id)) continue;
          activeAutoSaves.add(entity.id);

          const strategies = await kaminoClient.getKaminoVaults();
const bestStrategy = strategies.filter(strategy => strategy.verified && /USDC/i.test(strategy.assetSymbol))
            .find(strategy => strategy.id === entity.autoSaveStrategyId)
            || strategies.filter(strategy => strategy.verified && /USDC/i.test(strategy.assetSymbol)).sort((left, right) => left.id.localeCompare(right.id))[0];
           if (!bestStrategy) { console.warn(`[Scheduler] No verified USDC Kamino strategy found for entity ${entity.id}`); continue; }

const user = (await db.select().from(users).where(eq(users.id, entity.userId)).limit(1))[0];
           if (!user?.privyUserId) continue;
const derivation = await PrivyNEARBridge.deriveAddress(user.privyUserId, entity.kind === 'BUSINESS' ? 'business' : 'personal', user.email);
            const recipientAddress = derivation.solanaAddress || entity.solanaDepositAddress || '';
            const nearIntent = await nearIntentsClient.generateIntentForSigning({
              originAsset: 'base:usdc',
              destinationAsset: 'solana:usdc',
              amount: sweepAmount.toFixed(6),
              recipientAddress,
              refundAddress: entity.evmDepositAddress || '',
            });
const depositAddress = (nearIntent?.depositAddress || nearIntent?.quote?.depositAddress || '') as string;
           const intentId = (nearIntent?.intentId || depositAddress || '') as string;
           if (!depositAddress || !intentId) throw new Error('Kamino auto-save Intent returned no deposit address');

          const vaultId = `tv_${Date.now()}_${entity.id}`;
          const swapId = `swap_${Date.now()}_${entity.id}`;
          await db.insert(termVaults).values({ id: vaultId, entityId: entity.id, vaultName: bestStrategy.name, protocol: 'kamino', lockDurationDays: 30, startDate: new Date(), unlockDate: new Date(Date.now() + 30 * 86400000), principalAmountUsd: sweepAmount.toFixed(2), grossApy: '0.00', proximCutApy: '2.00', userNetApy: '0.00', accruedInterestUsd: '0.00', nearIntentId: intentId, depositAddress, solanaRecipientAddress: recipientAddress, status: 'PENDING_DEPOSIT' });
          await db.insert(intentSwaps).values({ id: swapId, entityId: entity.id, originAsset: 'base:usdc', destinationAsset: 'solana:usdc', originAmount: sweepAmount.toFixed(6), depositAddress, recipientAddress, status: 'PENDING_DEPOSIT', protocol: 'kamino_vault' });

          const sourceTx = await signAndSubmitTransaction({ userIdentifier: `privy-${user.privyUserId}`, context: entity.kind === 'BUSINESS' ? 'business' : 'personal', targetChain: 'base', bytecode: [{ to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', data: encodeErc20Transfer(depositAddress, toBaseUnits(sweepAmount.toFixed(6), 6)), value: '0', chainId: 8453 }] });
          const txHash = sourceTx[0]?.txHash;
          if (!txHash) throw new Error('Kamino auto-save MPC transfer returned no transaction hash');
          await db.update(intentSwaps).set({ sourceTxHash: txHash, status: 'SUBMITTED' }).where(eq(intentSwaps.id, swapId));
          await nearIntentsClient.submitDepositTxHash({ intentId, txHash, chain: 'base' });
          await db.update(termVaults).set({ sourceTxHash: txHash, status: 'SOLVING' }).where(eq(termVaults.id, vaultId));
          await db.update(entities).set({ autoSaveIdleSince: new Date() }).where(eq(entities.id, entity.id));
          console.log(`[Scheduler] Kamino auto-save submitted: ${sweepAmount.toFixed(2)} USD for entity ${entity.id} into ${bestStrategy.id}`);
        } catch (e: any) {
          console.error(`[Scheduler] Error sweeping for entity ${entity.id}:`, e.message);
        } finally {
          activeAutoSaves.delete(entity.id);
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

  cron.schedule('*/30 * * * * *', async () => {
    await reconcileKaminoPositions().catch(err => console.warn('[Kamino Reconciliation Warning]:', err.message));
  });

  console.log('[Scheduler] 5-hour idle auto-sweep, 1-minute webhook outbox worker, 30-second intent poller, and 5-second intent retry manager initialized.');
}
