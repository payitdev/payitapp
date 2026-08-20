import { FastifyInstance } from 'fastify';
import { createDbClient, eq, or } from '@payit/db';
import { intentSwaps, termVaults } from '@payit/db/schema';
import { NEARIntentsClient } from '@payit/integrations';

const db = createDbClient();
const nearIntentsClient = new NEARIntentsClient();

export async function intentRoutes(server: FastifyInstance) {
  /**
   * GET /api/intents/supported-tokens
   * Discover all tokens supported by NEAR 1Click solver network across chains
   */
  server.get('/api/intents/supported-tokens', async (_request, reply) => {
    try {
      const data = await nearIntentsClient.getSupportedTokens();
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

      const status = await nearIntentsClient.checkSwapExecutionStatus(intentId);

      // Reconcile status with DB if completed or failed
      const executionStatus = (status?.status || status?.data?.status || '').toUpperCase();
      if (executionStatus === 'COMPLETED' || executionStatus === 'SUCCESS' || executionStatus === 'EXECUTED') {
        const destTxHash = status?.destinationTxHash || status?.data?.destinationTxHash || '';
        try {
          await db.update(intentSwaps)
            .set({ status: 'COMPLETED', destinationTxHash: destTxHash, completedAt: new Date() })
            .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId)));

          await db.update(termVaults)
            .set({ status: 'LOCKED', solanaTxHash: destTxHash })
            .where(or(eq(termVaults.depositAddress, intentId), eq(termVaults.nearIntentId, intentId)));
        } catch {}
      } else if (executionStatus === 'FAILED' || executionStatus === 'REFUNDED') {
        try {
          await db.update(intentSwaps)
            .set({ status: 'FAILED' })
            .where(or(eq(intentSwaps.depositAddress, intentId), eq(intentSwaps.id, intentId)));

          await db.update(termVaults)
            .set({ status: 'EARLY_UNLOCKED' })
            .where(or(eq(termVaults.depositAddress, intentId), eq(termVaults.nearIntentId, intentId)));
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
}
