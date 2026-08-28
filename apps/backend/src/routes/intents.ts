import { FastifyInstance } from 'fastify';
import { createDbClient, eq, or, and } from '@payit/db';
import { intentSwaps, termVaults, transfers, ledgerAccounts, ledgerEntries, entities } from '@payit/db/schema';
import { NEARIntentsClient } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();
const nearIntentsClient = new NEARIntentsClient();

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

async function creditSettledStablecoin(swap: any, destinationAmount: string, asset: string, destinationTxHash: string) {
  const existingCredit = await db.select().from(ledgerEntries).where(and(
    eq(ledgerEntries.entityId, swap.entityId),
    eq(ledgerEntries.transactionId, swap.id),
    eq(ledgerEntries.type, 'DEBIT'),
  )).limit(1);
  if (existingCredit.length > 0) return;

  const currency = asset.toUpperCase().includes('USDT') ? 'USDT' : 'USDC';
  const cashAccountId = `${swap.entityId}_cash_${currency}`;
  const clearingAccountId = `${swap.entityId}_intent_clearing_${currency}`;
  const amount = String(destinationAmount);
  const accountRows = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, cashAccountId)).limit(1);
  if (accountRows.length === 0) {
    await db.insert(ledgerAccounts).values([
      { id: cashAccountId, entityId: swap.entityId, name: `Available ${currency}`, type: 'ASSET', currency },
      { id: clearingAccountId, entityId: swap.entityId, name: `NEAR Intent Clearing ${currency}`, type: 'LIABILITY', currency },
    ]);
  }
  await db.insert(ledgerEntries).values([
    { id: ulid(), entityId: swap.entityId, transactionId: swap.id, ledgerAccountId: cashAccountId, type: 'DEBIT', amount },
    { id: ulid(), entityId: swap.entityId, transactionId: swap.id, ledgerAccountId: clearingAccountId, type: 'CREDIT', amount },
  ]);
  await db.update(transfers).set({
    settlementStatus: 'LEDGER_CREDITED',
    destinationTxHash,
    settledAsset: currency,
    settledAmount: amount,
    status: 'completed',
  }).where(eq(transfers.intentSwapId, swap.id));
}

async function debitSettledCryptoTransfer(swap: any, transfer: any, destinationTxHash: string) {
  const currency = String(transfer.sourceCurrency || swap.originAsset || 'USDC').split(':').pop()!.toUpperCase();
  const cashAccountId = `${swap.entityId}_cash_${currency}`;
  const clearingAccountId = `${swap.entityId}_outbound_${currency}`;
  const amount = String(transfer.sourceAmount || swap.originAmount || '0');
  const existingDebit = await db.select().from(ledgerEntries).where(and(
    eq(ledgerEntries.entityId, swap.entityId),
    eq(ledgerEntries.transactionId, transfer.id),
    eq(ledgerEntries.type, 'CREDIT'),
  )).limit(1);
  if (existingDebit.length === 0) {
    const accountRows = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, cashAccountId)).limit(1);
    if (accountRows.length === 0) {
      await db.insert(ledgerAccounts).values([
        { id: cashAccountId, entityId: swap.entityId, name: `Available ${currency}`, type: 'ASSET', currency },
        { id: clearingAccountId, entityId: swap.entityId, name: `Outbound Clearing ${currency}`, type: 'LIABILITY', currency },
      ]);
    }
    await db.insert(ledgerEntries).values([
      { id: ulid(), entityId: swap.entityId, transactionId: transfer.id, ledgerAccountId: cashAccountId, type: 'CREDIT', amount },
      { id: ulid(), entityId: swap.entityId, transactionId: transfer.id, ledgerAccountId: clearingAccountId, type: 'DEBIT', amount },
    ]);
  }
  await db.update(transfers).set({
    settlementStatus: 'LEDGER_CREDITED',
    destinationTxHash,
    status: 'completed',
  }).where(eq(transfers.id, transfer.id));
}

export async function intentRoutes(server: FastifyInstance) {
  /**
   * GET /api/intents/supported-tokens
   * Discover all tokens supported by NEAR 1Click solver network across chains
   */
  server.get('/api/intents/supported-tokens', async (_request, reply) => {
    try {
      const data = await nearIntentsClient.getProductionSupportedTokens();
      return reply.send(data);
    } catch (err: any) {
      console.error('[Route /api/intents/supported-tokens] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to fetch supported tokens', details: err.message });
    }
  });

  /**
   * POST /api/intents/generate-intent
   * Generate cross-chain swap intent quote and signing payload
   */
  server.post('/api/intents/generate-intent', async (request, reply) => {
    try {
      const { originAsset, destinationAsset, amount, recipientAddress, refundAddress, slippageTolerance } = request.body as {
        originAsset: string;
        destinationAsset: string;
        amount: string;
        recipientAddress: string;
        refundAddress?: string;
        slippageTolerance?: number;
      };

      if (!originAsset || !destinationAsset || !amount || !recipientAddress) {
        return reply.status(400).send({
          error: 'Missing required parameters: originAsset, destinationAsset, amount, recipientAddress',
        });
      }

      const intent = await nearIntentsClient.generateIntentForSigning({
        originAsset,
        destinationAsset,
        amount: String(amount),
        recipientAddress,
        refundAddress,
        slippageTolerance: slippageTolerance ? Number(slippageTolerance) : undefined,
      });

      return reply.send(intent);
    } catch (err: any) {
      console.error('[Route /api/intents/generate-intent] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to generate intent', details: err.message });
    }
  });

  /**
   * POST /api/intents/submit-deposit
   * Submit deposit transaction hash for intent fulfillment
   */
  server.post('/api/intents/submit-deposit', async (request, reply) => {
    try {
      const { intentId, txHash, chain } = request.body as {
        intentId: string;
        txHash: string;
        chain: string;
      };

      if (!intentId || !txHash || !chain) {
        return reply.status(400).send({ error: 'Missing required parameters: intentId, txHash, chain' });
      }

      const [swapRows, vaultRows] = await Promise.all([
        db.select({ entityId: intentSwaps.entityId }).from(intentSwaps)
          .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId))).limit(1),
        db.select({ entityId: termVaults.entityId }).from(termVaults)
          .where(or(eq(termVaults.depositAddress, intentId), eq(termVaults.nearIntentId, intentId))).limit(1),
      ]);
      const ownerEntityId = swapRows[0]?.entityId || vaultRows[0]?.entityId;
      if (!ownerEntityId) return reply.status(404).send({ error: 'Intent not found' });
      if (!request.session?.userEntityIds.includes(ownerEntityId)) {
        return reply.status(403).send({ error: 'Intent is not owned by the authenticated user' });
      }

      const result = await nearIntentsClient.submitDepositTxHash({
        intentId,
        txHash,
        chain,
      });

      // Update local database records
      try {
        await db.update(intentSwaps)
          .set({ sourceTxHash: txHash, status: 'SUBMITTED' })
          .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId)));

        await db.update(termVaults)
          .set({ sourceTxHash: txHash, status: 'SOLVING' })
          .where(or(eq(termVaults.depositAddress, intentId), eq(termVaults.nearIntentId, intentId)));
      } catch (dbErr: any) {
        console.warn('[Intent DB Sync Warning]:', dbErr.message);
      }

      return reply.send(result);
    } catch (err: any) {
      console.error('[Route /api/intents/submit-deposit] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to submit deposit', details: err.message });
    }
  });

  /**
   * GET /api/intents/status/:intentId
   * Poll execution status of a cross-chain intent
   */
  server.get('/api/intents/status/:intentId', async (request, reply) => {
    try {
      const { intentId } = request.params as { intentId: string };
      if (!intentId) {
        return reply.status(400).send({ error: 'intentId is required' });
      }

      const [swapRowsForAuth, vaultRowsForAuth] = await Promise.all([
        db.select({ entityId: intentSwaps.entityId }).from(intentSwaps)
        .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId))).limit(1),
        db.select({ entityId: termVaults.entityId }).from(termVaults)
          .where(or(eq(termVaults.depositAddress, intentId), eq(termVaults.nearIntentId, intentId))).limit(1),
      ]);
      const statusEntityId = swapRowsForAuth[0]?.entityId || vaultRowsForAuth[0]?.entityId;
      if (!statusEntityId) return reply.status(404).send({ error: 'Intent not found' });
      if (!request.session?.userEntityIds.includes(statusEntityId)) {
        return reply.status(403).send({ error: 'Intent is not owned by the authenticated user' });
      }
      const status = await nearIntentsClient.checkSwapExecutionStatus(intentId);

      // Reconcile status with DB if completed or failed
      const executionStatus = (status?.status || status?.data?.status || '').toUpperCase();
      if (executionStatus === 'COMPLETED' || executionStatus === 'SUCCESS' || executionStatus === 'EXECUTED') {
        const destTxHash = status?.destinationTxHash || status?.data?.destinationTxHash || '';
        try {
          const swapRows = await db.select().from(intentSwaps)
            .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId))).limit(1);
          const swap = swapRows[0];
          if (swap && !destTxHash) {
            return reply.status(502).send({ error: 'Intent completed without a destination transaction hash; awaiting reconciliation.' });
          }
          await db.update(intentSwaps)
            .set({ status: 'COMPLETED', destinationTxHash: destTxHash, completedAt: new Date() })
            .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId)));

          if (swap) {
            const destinationAsset = String(swap.destinationAsset || 'base:usdc');
            const rawDestinationAmount = String(status?.amountOut || status?.destinationAmount || status?.data?.amountOut || swap.destinationAmount || '0');
            const destinationAmount = fromBaseUnits(rawDestinationAmount, assetDecimals(destinationAsset));
            const relatedTransfer = (await db.select().from(transfers).where(eq(transfers.intentSwapId, swap.id)).limit(1))[0];
            if (relatedTransfer?.direction === 'DEBIT') {
              await debitSettledCryptoTransfer(swap, relatedTransfer, destTxHash);
            } else if (Number(destinationAmount) > 0) {
              await creditSettledStablecoin(swap, destinationAmount, destinationAsset, destTxHash);
            }
          }

          await db.update(termVaults)
            .set({ solanaTxHash: destTxHash })
            .where(and(
              or(eq(termVaults.depositAddress, intentId), eq(termVaults.nearIntentId, intentId)),
              eq(termVaults.protocol, 'near_intent'),
              eq(termVaults.status, 'PENDING_DEPOSIT'),
            ));
        } catch {}
      } else if (executionStatus === 'FAILED' || executionStatus === 'REFUNDED') {
        try {
          await db.update(intentSwaps)
            .set({ status: executionStatus === 'REFUNDED' ? 'REFUNDED' : 'FAILED', failureReason: status?.reason || status?.data?.reason || 'Intent execution failed' })
            .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId)));

          await db.update(transfers).set({
            settlementStatus: executionStatus === 'REFUNDED' ? 'REFUNDED' : 'FAILED',
            settlementError: status?.reason || status?.data?.reason || 'Intent execution failed',
            status: 'failed',
          }).where(or(eq(transfers.intentSwapId, intentId), eq(transfers.dueTransferId, intentId)));

          await db.update(termVaults)
            .set({ status: 'EARLY_UNLOCKED' })
            .where(and(
              or(eq(termVaults.depositAddress, intentId), eq(termVaults.nearIntentId, intentId)),
              eq(termVaults.protocol, 'near_intent'),
            ));
        } catch {}
      }

      return reply.send(status);
    } catch (err: any) {
      console.error('[Route /api/intents/status] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to fetch status', details: err.message });
    }
  });

  /**
   * GET /api/intents/balances/:accountId
   * Fetch account token balances from Intent Explorer
   */
  server.get('/api/intents/balances/:accountId', async (request, reply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      if (!accountId) {
        return reply.status(400).send({ error: 'accountId is required' });
      }

      const balances = await nearIntentsClient.getUserTokenBalances(accountId);
      return reply.send(balances);
    } catch (err: any) {
      console.error('[Route /api/intents/balances] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to fetch balances', details: err.message });
    }
  });

  /**
   * GET /api/intents/earn/vaults
   * Fetch available yield vaults from NEAR Intents
   */
  server.get('/api/intents/earn/vaults', async (request, reply) => {
    try {
      const vaults = await nearIntentsClient.getEarnVaults();
      return reply.send({
        success: true,
        vaults: vaults.vaults || [],
        live: vaults.live || false,
      });
    } catch (err: any) {
      console.error('[Route /api/intents/earn/vaults] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to fetch vaults', details: err.message });
    }
  });

  /**
   * POST /api/intents/earn/deposit
   * Generate intent to deposit into a yield vault
   */
  server.post('/api/intents/earn/deposit', async (request, reply) => {
    try {
      const { vaultId, originAsset, amount, entityId } = request.body as {
        vaultId: string;
        originAsset: string;
        amount: string;
        entityId: string;
      };

      if (!vaultId || !originAsset || !amount || !entityId) {
        return reply.status(400).send({ error: 'vaultId, originAsset, amount, and entityId are required' });
      }

      const entity = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
      if (!request.session?.userEntityIds.includes(entityId) || !entity[0]) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const recipientAddress = entity[0].evmDepositAddress;
      if (!recipientAddress) {
        return reply.status(400).send({ error: 'Entity has no EVM deposit address' });
      }

      const intent = await nearIntentsClient.generateEarnIntent({
        vaultId,
        originAsset,
        amount,
        recipientAddress,
      });

      // Record vault position
      const vaultPositionId = ulid();
      await db.insert(termVaults).values({
        id: vaultPositionId,
        entityId,
        protocol: 'near_intent',
        vaultName: vaultId,
        nearIntentId: intent.intentId,
        depositAddress: intent.depositAddress,
        principalAmountUsd: amount,
        grossApy: '0.00',
        proximCutApy: '0.00',
        userNetApy: '0.00',
        lockDurationDays: 0,
        startDate: new Date(),
        unlockDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
        status: 'PENDING_DEPOSIT',
      });

      return reply.send({
        success: true,
        vaultPositionId,
        intentId: intent.intentId,
        depositAddress: intent.depositAddress,
        quote: intent.quote,
      });
    } catch (err: any) {
      console.error('[Route /api/intents/earn/deposit] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to generate earn intent', details: err.message });
    }
  });

  /**
   * POST /api/intents/earn/withdraw
   * Request withdrawal from vault (if supported by NEAR Intents)
   */
  server.post('/api/intents/earn/withdraw', async (request, reply) => {
    try {
      const { vaultPositionId, amount } = request.body as {
        vaultPositionId: string;
        amount?: string;
      };

      if (!vaultPositionId) {
        return reply.status(400).send({ error: 'vaultPositionId is required' });
      }

      const vaultPosition = await db.select().from(termVaults)
        .where(and(eq(termVaults.id, vaultPositionId), eq(termVaults.entityId, request.session!.activeEntityId)))
        .limit(1);

      if (!vaultPosition[0]) {
        return reply.status(404).send({ error: 'Vault position not found' });
      }

      return reply.status(501).send({ error: 'NEAR Intent earn withdrawals are not enabled until the provider withdrawal transaction is implemented.' });
    } catch (err: any) {
      console.error('[Route /api/intents/earn/withdraw] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to request withdrawal', details: err.message });
    }
  });

  /**
   * POST /api/intents/cancel
   * Cancel a pending intent before submission
   */
  server.post('/api/intents/cancel', async (request, reply) => {
    try {
      const { intentId } = request.body as { intentId: string };

      if (!intentId) {
        return reply.status(400).send({ error: 'intentId is required' });
      }

      const intent = await db.select().from(intentSwaps)
        .where(eq(intentSwaps.id, intentId))
        .limit(1);

      if (!intent[0]) {
        return reply.status(404).send({ error: 'Intent not found' });
      }

      // Only allow cancellation if not yet submitted
      if (intent[0].status !== 'PENDING_DEPOSIT') {
        return reply.status(400).send({ error: 'Intent can only be cancelled before submission' });
      }

      await db.update(intentSwaps)
        .set({ status: 'FAILED', failureReason: 'Cancelled by user' })
        .where(eq(intentSwaps.id, intentId));

      return reply.send({ success: true, message: 'Intent cancelled' });
    } catch (err: any) {
      console.error('[Route /api/intents/cancel] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to cancel intent', details: err.message });
    }
  });
}
