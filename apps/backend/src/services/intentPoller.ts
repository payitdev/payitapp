/**
 * Intent Poller Service
 * 
 * Background cron job to automatically poll pending NEAR Intents and reconcile completed swaps
 * Ensures automatic settlement without manual intervention
 */

import { createDbClient, eq, or, and, lte } from '@payit/db';
import { intentSwaps, transfers, ledgerAccounts, ledgerEntries } from '@payit/db/schema';
import { NEARIntentsClient } from '@payit/integrations';
import { WebhookDispatcher } from './webhookDispatcher.js';
import { ulid } from 'ulid';
import { env } from '../env.js';

const db = createDbClient(env.DATABASE_URL);
const nearIntentsClient = new NEARIntentsClient({
  oneClickApiKey: env.NEAR_INTENT_1CLICK_API_KEY,
  explorerApiKey: env.NEAR_INTENT_EXPLORER_API_KEY,
  baseUrl: env.NEAR_INTENT_BASE_URL,
});

function assetDecimals(asset: string): number {
  const symbol = asset.split(':').pop()?.toLowerCase();
  return symbol === 'sol' ? 9 : symbol === 'btc' ? 8 : symbol === 'near' ? 24 : 6;
}

function fromBaseUnits(amount: string, decimals: number): string {
  const units = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = units / divisor;
  const fraction = (units % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export class IntentPoller {
  private static pollInterval: NodeJS.Timeout | null = null;
  private static readonly POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

  /**
   * Start the intent poller cron job
   */
  static start() {
    if (this.pollInterval) {
      console.log('[Intent Poller] Already running');
      return;
    }

    console.log('✅ [Intent Poller] Starting - polling every 30s');
    
    // Initial poll
    this.pollPendingIntents();
    
    // Schedule recurring polls
    this.pollInterval = setInterval(() => {
      this.pollPendingIntents().catch(err => {
        console.error('[Intent Poller] Polling error:', err.message);
      });
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop the intent poller
   */
  static stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[Intent Poller] Stopped');
    }
  }

  /**
   * Poll all pending intents and reconcile status
   */
  static async pollPendingIntents() {
    try {
      // Get all intents that are PENDING_DEPOSIT or SUBMITTED but not completed
      const pendingIntents = await db
        .select()
        .from(intentSwaps)
        .where(
          or(
            eq(intentSwaps.status, 'PENDING_DEPOSIT'),
            eq(intentSwaps.status, 'SUBMITTED'),
            eq(intentSwaps.status, 'RETRYING')
          )
        )
        .limit(50);

      if (pendingIntents.length === 0) {
        return;
      }

      console.log(`[Intent Poller] Polling ${pendingIntents.length} pending intents`);

      for (const intent of pendingIntents) {
        try {
          await this.pollSingleIntent(intent);
        } catch (error: any) {
          console.warn(`[Intent Poller] Failed to poll intent ${intent.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error('[Intent Poller] Polling batch error:', error.message);
    }
  }

  /**
   * Poll a single intent and reconcile status
   */
  static async pollSingleIntent(intent: any) {
    try {
      const status = await nearIntentsClient.checkSwapExecutionStatus(intent.depositAddress);
      const executionStatus = (status?.status || status?.data?.status || '').toUpperCase();

      console.log(`[Intent Poller] Intent ${intent.id} status: ${executionStatus}`);

      if (executionStatus === 'COMPLETED' || executionStatus === 'SUCCESS' || executionStatus === 'EXECUTED') {
        await this.handleCompletedIntent(intent, status);
      } else if (executionStatus === 'FAILED') {
        await this.handleFailedIntent(intent, status);
      } else if (executionStatus === 'REFUNDED') {
        await this.handleRefundedIntent(intent, status);
      }
    } catch (error: any) {
      console.warn(`[Intent Poller] Status check failed for intent ${intent.id}:`, error.message);
    }
  }

  /**
   * Handle completed intent - credit user ledger
   */
  static async handleCompletedIntent(intent: any, status: any) {
    const destTxHash = status?.destinationTxHash || status?.data?.destinationTxHash || '';
    const destinationAsset = String(intent.destinationAsset || 'base:usdc');
    const rawDestAmount = String(status?.amountOut || status?.destinationAmount || status?.data?.amountOut || intent.destinationAmount || '0');
    const destAmount = fromBaseUnits(rawDestAmount, assetDecimals(destinationAsset));

    if (!destTxHash) {
      console.warn(`[Intent Poller] Intent ${intent.id} completed without destination tx hash`);
      return;
    }

    console.log(`[Intent Poller] Intent ${intent.id} completed - crediting ${destAmount} ${intent.destinationAsset}`);

    await db.update(intentSwaps)
      .set({
        status: 'COMPLETED',
        destinationTxHash: destTxHash,
        destinationAmount: String(destAmount),
        completedAt: new Date(),
      })
      .where(eq(intentSwaps.id, intent.id));

    const relatedTransfer = (await db.select().from(transfers).where(eq(transfers.intentSwapId, intent.id)).limit(1))[0];
    if (relatedTransfer?.direction === 'DEBIT') {
      await this.completeOutboundTransfer(relatedTransfer, destTxHash);
    } else {
      await this.creditSettledStablecoin(intent, String(destAmount), intent.destinationAsset, destTxHash);
    }

    // Dispatch webhook notification
    await WebhookDispatcher.dispatchEvent(
      intent.entityId,
      'deposit.detected',
      {
        intentId: intent.id,
        sourceAsset: intent.originAsset,
        destinationAsset: intent.destinationAsset,
        sourceAmount: intent.originAmount,
        destinationAmount: String(destAmount),
        sourceTxHash: intent.sourceTxHash,
        destinationTxHash: destTxHash,
        status: 'completed',
        timestamp: new Date().toISOString(),
      }
    ).catch(err => {
      console.warn(`[Intent Poller] Webhook dispatch failed:`, err.message);
    });

    console.log(`✅ [Intent Poller] Intent ${intent.id} reconciled and credited`);
  }

  /**
   * Handle failed intent
   */
  static async handleFailedIntent(intent: any, status: any) {
    const failureReason = status?.reason || status?.data?.reason || 'Intent execution failed';

    console.log(`[Intent Poller] Intent ${intent.id} failed: ${failureReason}`);

    await db.update(intentSwaps)
      .set({
        status: 'FAILED',
        failureReason,
        completedAt: new Date(),
      })
      .where(eq(intentSwaps.id, intent.id));

    // Update related transfers
    await db.update(transfers)
      .set({
        settlementStatus: 'FAILED',
        settlementError: failureReason,
        status: 'failed',
      })
      .where(eq(transfers.intentSwapId, intent.id));

    // Dispatch webhook notification
    await WebhookDispatcher.dispatchEvent(
      intent.entityId,
      'deposit.detected',
      {
        intentId: intent.id,
        status: 'failed',
        reason: failureReason,
        timestamp: new Date().toISOString(),
      }
    ).catch(err => {
      console.warn(`[Intent Poller] Webhook dispatch failed:`, err.message);
    });
  }

  /**
   * Handle refunded intent
   */
  static async handleRefundedIntent(intent: any, status: any) {
    const refundReason = status?.reason || status?.data?.reason || 'Intent refunded';

    console.log(`[Intent Poller] Intent ${intent.id} refunded: ${refundReason}`);

    await db.update(intentSwaps)
      .set({
        status: 'REFUNDED',
        failureReason: refundReason,
        completedAt: new Date(),
      })
      .where(eq(intentSwaps.id, intent.id));

    // Update related transfers
    await db.update(transfers)
      .set({
        settlementStatus: 'REFUNDED',
        settlementError: refundReason,
        status: 'failed',
      })
      .where(eq(transfers.intentSwapId, intent.id));

    // Dispatch webhook notification
    await WebhookDispatcher.dispatchEvent(
      intent.entityId,
      'deposit.detected',
      {
        intentId: intent.id,
        status: 'refunded',
        reason: refundReason,
        timestamp: new Date().toISOString(),
      }
    ).catch(err => {
      console.warn(`[Intent Poller] Webhook dispatch failed:`, err.message);
    });
  }

  /**
   * Credit settled stablecoin to user ledger
   */
  static async creditSettledStablecoin(intent: any, destinationAmount: string, asset: string, destinationTxHash: string) {
    try {
      const currency = asset.toUpperCase().includes('USDT') ? 'USDT' : 'USDC';
      const cashAccountId = `${intent.entityId}_cash_${currency}`;
      const clearingAccountId = `${intent.entityId}_intent_clearing_${currency}`;
      const amount = String(destinationAmount);

      // Create ledger accounts if they don't exist
      const existingCredit = await db.select().from(ledgerEntries).where(and(
        eq(ledgerEntries.entityId, intent.entityId),
        eq(ledgerEntries.transactionId, intent.id),
        eq(ledgerEntries.type, 'DEBIT'),
      )).limit(1);
      if (existingCredit.length > 0) return;

      const existingAccounts = await db.select().from(ledgerAccounts).where(
        or(eq(ledgerAccounts.id, cashAccountId), eq(ledgerAccounts.id, clearingAccountId))
      );

      if (existingAccounts.length < 2) {
        await db.insert(ledgerAccounts).values([
          { id: cashAccountId, entityId: intent.entityId, name: `Available ${currency}`, type: 'ASSET', currency },
          { id: clearingAccountId, entityId: intent.entityId, name: `NEAR Intent Clearing ${currency}`, type: 'LIABILITY', currency },
        ]);
      }

      // Credit the cash account and debit the clearing account
      await db.insert(ledgerEntries).values([
        { id: ulid(), entityId: intent.entityId, transactionId: intent.id, ledgerAccountId: cashAccountId, type: 'DEBIT', amount },
        { id: ulid(), entityId: intent.entityId, transactionId: intent.id, ledgerAccountId: clearingAccountId, type: 'CREDIT', amount },
      ]);

      // Update transfer record
      await db.update(transfers)
        .set({
          settlementStatus: 'LEDGER_CREDITED',
          destinationTxHash,
          settledAsset: currency,
          settledAmount: amount,
          status: 'completed',
        })
        .where(eq(transfers.intentSwapId, intent.id));

      console.log(`✅ [Intent Poller] Credited ${amount} ${currency} to entity ${intent.entityId}`);
    } catch (error: any) {
      console.error(`[Intent Poller] Ledger credit failed for intent ${intent.id}:`, error.message);
      throw error;
    }
  }

  static async completeOutboundTransfer(transfer: any, destinationTxHash: string) {
    const currency = String(transfer.sourceCurrency || 'USDC').toUpperCase();
    const cashAccountId = `${transfer.entityId}_cash_${currency}`;
    const outboundAccountId = `${transfer.entityId}_outbound_${currency}`;
    const amount = String(transfer.sourceAmount || '0');
    const existingDebit = await db.select().from(ledgerEntries).where(and(
      eq(ledgerEntries.entityId, transfer.entityId),
      eq(ledgerEntries.transactionId, transfer.id),
      eq(ledgerEntries.type, 'CREDIT'),
    )).limit(1);

    if (existingDebit.length === 0) {
      const accounts = await db.select().from(ledgerAccounts).where(or(
        eq(ledgerAccounts.id, cashAccountId),
        eq(ledgerAccounts.id, outboundAccountId),
      ));
      const accountIds = new Set(accounts.map(account => account.id));
      const missingAccounts = [
        ...(accountIds.has(cashAccountId) ? [] : [{ id: cashAccountId, entityId: transfer.entityId, name: `Available ${currency}`, type: 'ASSET' as const, currency }]),
        ...(accountIds.has(outboundAccountId) ? [] : [{ id: outboundAccountId, entityId: transfer.entityId, name: `Outbound Clearing ${currency}`, type: 'LIABILITY' as const, currency }]),
      ];
      if (missingAccounts.length > 0) await db.insert(ledgerAccounts).values(missingAccounts);
      await db.insert(ledgerEntries).values([
        { id: ulid(), entityId: transfer.entityId, transactionId: transfer.id, ledgerAccountId: cashAccountId, type: 'CREDIT', amount },
        { id: ulid(), entityId: transfer.entityId, transactionId: transfer.id, ledgerAccountId: outboundAccountId, type: 'DEBIT', amount },
      ]);
    }

    await db.update(transfers).set({
      settlementStatus: 'LEDGER_CREDITED',
      destinationTxHash,
      status: 'completed',
    }).where(eq(transfers.id, transfer.id));
  }
}
