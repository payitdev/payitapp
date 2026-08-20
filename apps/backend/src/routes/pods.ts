import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { entities } from '@payit/db/schema';
import { PodsClient, BiconomyClient } from '@payit/integrations';
import { getEntityBalance } from '../utils/balance.js';

const db = createDbClient();
const podsClient = new PodsClient();
const biconomyClient = new BiconomyClient();

export async function podsRoutes(server: FastifyInstance) {
  /**
   * GET /api/pods/strategies
   * List all available savings strategies (Base & OpenCover Gnosis)
   */
  server.get('/api/pods/strategies', async (_request, reply) => {
    try {
      const strategies = await podsClient.getAllStrategies();
      return reply.send({ success: true, count: strategies.length, strategies });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to fetch savings strategies', details: err.message });
    }
  });

  /**
   * GET /api/pods/base-strategies
   * List Base network savings strategies with Proxim APY yield split
   */
  server.get('/api/pods/base-strategies', async (_request, reply) => {
    try {
      const strategies = await podsClient.getBaseStrategies();
      return reply.send({ success: true, count: strategies.length, strategies });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to fetch Base savings strategies', details: err.message });
    }
  });

  /**
   * POST /api/pods/deposit
   * Generate gasless Biconomy execution quote for Pods strategy deposit
   */
  server.post('/api/pods/deposit', async (request, reply) => {
    const { strategyId, amount, userWallet } = request.body as {
      strategyId: string;
      amount: string;
      userWallet: string;
    };

    if (!strategyId || !amount || !userWallet) {
      return reply.status(400).send({ error: 'strategyId, amount, and userWallet are required' });
    }

    try {
      // 1. Fetch Pods bytecode instructions for deposit
      const podsBytecode = await podsClient.getSavingsDepositBytecode({
        strategyId,
        amount,
        sourceWallet: userWallet,
        destinationWallet: userWallet,
      });

      // 2. Compose gasless Biconomy quote
      const biconomyQuote = await biconomyClient.composeInstructionsAndGenerateQuote({
        userOp: {},
        chainId: podsBytecode.chainIdIn || 8453,
        mode: 'gasless',
        sponsor: true,
        instructions: podsBytecode.bytecode || [],
      });

      return reply.send({
        success: true,
        strategyId,
        amount,
        podsBytecode,
        biconomyQuote,
      });
    } catch (err: any) {
      console.error('[Pods Deposit Error]:', err.message);
      return reply.status(500).send({ error: 'Pods deposit quote failed', details: err.message });
    }
  });

  server.post('/api/pods/submit', async (request, reply) => {
    const { quoteId, signature, userOp, chainId } = request.body as {
      quoteId: string;
      signature: string;
      userOp: Record<string, any>;
      chainId: number;
    };
    if (!quoteId || !signature || !userOp || !chainId) {
      return reply.status(400).send({ error: 'quoteId, signature, userOp, and chainId are required' });
    }
    try {
      const result = await biconomyClient.submitSupertransaction({ quoteId, signature, userOp, chainId });
      return reply.send({ success: true, result });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Pods transaction submission failed', details: err.message });
    }
  });

  /**
   * POST /api/pods/auto-sweep
   * Automatically sweeps idle funds into Pods yield strategies via gasless Biconomy execution
   */
  /**
   * POST /api/pods/auto-sweep
   * POST /api/pods/sweep-idle-cash
   * Automatically sweeps idle funds into Pods yield strategies via gasless Biconomy execution
   */
  const handleAutoSweep = async (request: any, reply: any) => {
    const { entityId, amountUsd, userWallet, strategyId = 'moonwell-usdc-base', liquidBufferUsd = 50 } = request.body as {
      entityId: string;
      amountUsd?: number;
      userWallet?: string;
      strategyId?: string;
      liquidBufferUsd?: number;
    };

    if (!entityId) {
      return reply.status(400).send({ error: 'entityId is required' });
    }

    try {
      let resolvedWallet = userWallet;
      if (!resolvedWallet) {
        try {
          const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
          resolvedWallet = entityRows[0]?.evmDepositAddress || '0x09648d98196460D63B3dB1B90c60100756dECb77';
        } catch {
          resolvedWallet = '0x09648d98196460D63B3dB1B90c60100756dECb77';
        }
      }

      let totalUsdCash = amountUsd;
      if (totalUsdCash === undefined || totalUsdCash === null) {
        try {
          totalUsdCash = await getEntityBalance(db, entityId, 'USD', 'cash');
        } catch {
          totalUsdCash = 0;
        }
      }

      const sweepAmount = Math.max(0, (totalUsdCash || 0) - liquidBufferUsd);
      if (sweepAmount <= 0) {
        return reply.send({
          success: true,
          message: 'Available cash is within your liquid buffer threshold. No sweep needed.',
          sweptAmountUsd: 0,
          liquidBufferUsd,
        });
      }

      const amountWei = String(Math.floor(sweepAmount * 1_000_000));
      const podsBytecode = await podsClient.getSavingsDepositBytecode({
        strategyId,
        amount: amountWei,
        sourceWallet: resolvedWallet,
        destinationWallet: resolvedWallet,
      });

      const biconomyQuote = await biconomyClient.composeInstructionsAndGenerateQuote({
        userOp: {},
        chainId: podsBytecode.chainIdIn || 8453,
        mode: 'gasless',
        sponsor: true,
        instructions: podsBytecode.bytecode || [],
      });

      return reply.send({
        success: true,
        entityId,
        strategyId,
        sweptAmountUsd: sweepAmount,
        liquidBufferUsd,
        podsBytecode,
        biconomyQuote,
        executionMode: 'BICONOMY_MEE_SUPERTRANSACTION',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Pods Auto-Sweep Error]:', err.message);
      return reply.status(500).send({ error: 'Pods auto-sweep execution failed', details: err.message });
    }
  };

  server.post('/api/pods/auto-sweep', handleAutoSweep);
  server.post('/api/pods/sweep-idle-cash', handleAutoSweep);

  /**
   * GET /api/pods/yield-summary
   * Fetch user net yield earnings vs Proxim fee cut breakdown
   */
  server.get('/api/pods/yield-summary', async (request, reply) => {
    const { userWallet } = request.query as { userWallet: string };
    if (!userWallet) return reply.status(400).send({ error: 'userWallet is required' });

    try {
      const positionData = await podsClient.getUserSavingsPosition(userWallet);
      return reply.send({
        success: true,
        userWallet,
        earn: positionData,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Pods yield summary lookup failed', details: err.message });
    }
  });
}