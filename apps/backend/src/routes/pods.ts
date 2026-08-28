import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and } from '@payit/db';
import { automationPolicies, entities } from '@payit/db/schema';
import { ulid } from 'ulid';
import { PodsClient, BiconomyClient } from '@payit/integrations';
import { getEntityBalance } from '../utils/balance.js';

const db = createDbClient();
const podsClient = new PodsClient();
const biconomyClient = new BiconomyClient();

export async function podsRoutes(server: FastifyInstance) {
  server.get('/api/pods/auto-save', async (request, reply) => {
    const entityId = (request.query as { entityId?: string }).entityId || request.session?.activeEntityId;
    if (!entityId || !request.session?.userEntityIds.includes(entityId)) {
      return reply.status(403).send({ error: 'Authenticated entity is required' });
    }
    const rows = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session.userId))).limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'Entity not found' });
    return reply.send({
      enabled: rows[0].autoSaveEnabled === 1,
      liquidBufferUsd: Number(rows[0].autoSaveLiquidBufferUsd),
      strategyId: rows[0].autoSaveStrategyId,
    });
  });

  server.post('/api/pods/auto-save', async (request, reply) => {
    const body = request.body as { entityId?: string; enabled?: boolean; liquidBufferUsd?: number; strategyId?: string };
    const entityId = body.entityId || request.session?.activeEntityId;
    if (!entityId || !request.session?.userEntityIds.includes(entityId)) {
      return reply.status(403).send({ error: 'Authenticated entity is required' });
    }
    if (typeof body.enabled !== 'boolean') return reply.status(400).send({ error: 'enabled must be boolean' });
    const liquidBufferUsd = body.liquidBufferUsd ?? 50;
    if (!Number.isFinite(liquidBufferUsd) || liquidBufferUsd < 0) return reply.status(400).send({ error: 'liquidBufferUsd must be non-negative' });
    await db.update(entities).set({
      autoSaveEnabled: body.enabled ? 1 : 0,
      autoSaveLiquidBufferUsd: liquidBufferUsd.toFixed(2),
      autoSaveIdleSince: body.enabled ? new Date() : null,
      autoSaveStrategyId: body.strategyId || null,
    }).where(and(eq(entities.id, entityId), eq(entities.userId, request.session.userId)));
    const expiresAt = new Date(Date.now() + 365 * 86400000);
    if (body.enabled) {
      await db.insert(automationPolicies).values({
        id: `policy_${ulid()}`,
        entityId,
        maxPerTransactionUsd: '1000.00',
        maxDailyUsd: '2500.00',
        maxMonthlyUsd: '10000.00',
        expiresAt,
      }).onConflictDoUpdate({
        target: automationPolicies.entityId,
        set: { status: 'PENDING_SIGNATURE', expiresAt, updatedAt: new Date(), revokedAt: null },
      });
    } else {
      await db.update(automationPolicies).set({ status: 'REVOKED', revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(automationPolicies.entityId, entityId));
    }
    return reply.send({ success: true, enabled: body.enabled, liquidBufferUsd, strategyId: body.strategyId || null, authorizationStatus: body.enabled ? 'PENDING_SIGNATURE' : 'REVOKED' });
  });

  server.get('/api/pods/auto-save/authorization', async (request, reply) => {
    const entityId = (request.query as { entityId?: string }).entityId || request.session?.activeEntityId;
    if (!entityId || !request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Authenticated entity is required' });
    const rows = await db.select().from(automationPolicies).where(eq(automationPolicies.entityId, entityId)).limit(1);
    return reply.send({ success: true, policy: rows[0] || null });
  });

  server.post('/api/pods/auto-save/authorization/revoke', async (request, reply) => {
    const entityId = (request.body as { entityId?: string }).entityId || request.session?.activeEntityId;
    if (!entityId || !request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Authenticated entity is required' });
    await db.update(automationPolicies).set({ status: 'REVOKED', revokedAt: new Date(), updatedAt: new Date() }).where(eq(automationPolicies.entityId, entityId));
    await db.update(entities).set({ autoSaveEnabled: 0, autoSaveIdleSince: null }).where(eq(entities.id, entityId));
    return reply.send({ success: true, authorizationStatus: 'REVOKED' });
  });

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

    if (!request.session || !strategyId || !amount || !userWallet) {
      return reply.status(400).send({ error: 'strategyId, amount, and userWallet are required' });
    }

    const ownedEntity = await db.select().from(entities).where(and(
      eq(entities.evmDepositAddress, userWallet),
      eq(entities.userId, request.session.userId),
    )).limit(1);
    if (ownedEntity.length === 0) {
      return reply.status(403).send({ error: 'The savings wallet must belong to the authenticated entity' });
    }
    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0 || numericAmount > 1_000_000_000_000) {
      return reply.status(400).send({ error: 'amount must be a positive base-unit integer within the transaction limit' });
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
        userOp: { sender: userWallet },
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
    if (!request.session || !quoteId || !signature || !userOp || !chainId) {
      return reply.status(400).send({ error: 'quoteId, signature, userOp, and chainId are required' });
    }
    const sender = String(userOp.sender || '').toLowerCase();
    const ownedEntity = await db.select().from(entities).where(and(
      eq(entities.userId, request.session.userId),
      eq(entities.evmDepositAddress, sender),
    )).limit(1);
    if (ownedEntity.length === 0) {
      return reply.status(403).send({ error: 'The submitted user operation is not owned by the authenticated entity' });
    }
    if (chainId !== 8453 && chainId !== 100) {
      return reply.status(400).send({ error: 'Pods execution is restricted to supported strategy chains' });
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
    if (!request.session?.userEntityIds.includes(entityId)) {
      return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    }

    try {
      let resolvedWallet = userWallet;
      if (!resolvedWallet) {
        try {
          const entityRows = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session.userId))).limit(1);
          resolvedWallet = entityRows[0]?.evmDepositAddress || '';
        } catch {
          resolvedWallet = '';
        }
      }
      if (!resolvedWallet) return reply.status(409).send({ error: 'Live MPC Base wallet is unavailable.' });

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
        userOp: { sender: resolvedWallet },
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
    const ownedWallet = await db.select().from(entities).where(and(eq(entities.evmDepositAddress, userWallet), eq(entities.userId, request.session!.userId))).limit(1);
    if (ownedWallet.length === 0) return reply.status(403).send({ error: 'The savings wallet must belong to the authenticated entity' });

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