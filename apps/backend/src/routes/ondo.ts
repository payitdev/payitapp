import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, sql } from '@payit/db';
import { entities, users, rwaPositions, rwaOrders } from '@payit/db/schema';
import { OndoClient, PrivyNEARBridge } from '@payit/integrations';
import { ulid } from 'ulid';
import { env } from '../env.js';

const db = createDbClient();
const ondoClient = new OndoClient();

async function syncPosition(entityId: string, wallet: string, symbol: string) {
  const positions = await ondoClient.getUserStockPositions(wallet);
  const position = positions.find(candidate => String(candidate.spotPosition?.currentPositionInShares?.symbol || '').toUpperCase() === symbol.toUpperCase());
  if (!position) return false;
  const shares = String(position.spotPosition.currentPositionInShares.value);
  const totalValueUsd = Number(position.spotPosition.underlyingBalanceUSD || 0);
  const price = Number(shares) > 0 ? totalValueUsd / Number(shares) : 0;
  await db.insert(rwaPositions).values({
    id: `rwa_pos_${entityId}_${symbol.toUpperCase()}`,
    entityId,
    symbol: symbol.toUpperCase(),
    name: position.strategy.assetName || symbol.toUpperCase(),
    shares,
    averageCostBasisUsd: price.toFixed(4),
    currentPriceUsd: price.toFixed(4),
    totalValueUsd: totalValueUsd.toFixed(2),
    network: 'BSC',
    reservedShares: '0',
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [rwaPositions.entityId, rwaPositions.symbol],
    set: { shares, reservedShares: '0', currentPriceUsd: price.toFixed(4), totalValueUsd: totalValueUsd.toFixed(2), updatedAt: new Date() },
  });
  return true;
}

let stockListCache: { stocks: any[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function ondoRoutes(server: FastifyInstance) {
  const liveFinanceEnabled = env.ENABLE_LIVE_FINANCE || env.ENABLE_ONDO_FINANCE;

  const denyLiveFinance = async (_request: any, reply: any) => {
    return reply.status(503).send({
      success: false,
      mode: 'demo',
      error: 'Ondo live finance is disabled.',
      message: 'Set ENABLE_LIVE_FINANCE=true or ENABLE_ONDO_FINANCE=true with valid relayer credentials to enable this flow.',
    });
  };

  if (!liveFinanceEnabled) {
    server.get('/api/ondo/*', denyLiveFinance);
    server.post('/api/ondo/*', denyLiveFinance);
  }

  /**
   * GET /api/ondo/stocks
   * List available tokenized stocks & ETFs on BSC with Base funding
   */
  server.get('/api/ondo/stocks', async (_request, reply) => {
    if (stockListCache && Date.now() - stockListCache.timestamp < CACHE_TTL) {
      return reply.send({ success: true, count: stockListCache.stocks.length, stocks: stockListCache.stocks, cached: true });
    }

    try {
      const tokens = await ondoClient.listStocksAndETFs();
      stockListCache = { stocks: tokens, timestamp: Date.now() };
      return reply.send({ success: true, count: tokens.length, stocks: tokens });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to fetch stocks', details: err.message });
    }
  });

  /**
   * GET /api/ondo/positions/:entityId
   * List persistent tokenized stock & ETF positions for entity
   */
  server.get('/api/ondo/positions/:entityId', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    try {
      const dbPositions = await db.select().from(rwaPositions).where(eq(rwaPositions.entityId, entityId));

      const formatted = dbPositions.map(pos => ({
        spotPosition: {
          currentPositionInShares: {
            value: pos.shares,
            decimals: 6,
            humanized: pos.shares,
            symbol: pos.symbol,
          },
          currentPosition: {
            value: pos.totalValueUsd,
            decimals: 2,
            humanized: `$${parseFloat(pos.totalValueUsd).toFixed(2)}`,
            symbol: 'USD',
          },
          underlyingBalanceUSD: parseFloat(pos.totalValueUsd),
          apy: 0,
        },
        strategy: {
          id: pos.symbol,
          protocol: 'Ondo Global Markets',
          assetName: pos.name || pos.symbol,
          network: pos.network,
          networkId: 56,
          asset: pos.symbol,
          assetDecimals: 18,
        },
      }));

      return reply.send({
        success: true,
        entityId,
        personal: { positions: formatted },
        business: { positions: formatted },
        positions: formatted,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to fetch positions', details: err.message });
    }
  });

  /**
   * GET /api/ondo/status/:actionId
   * GET /api/ondo/action/:actionId
   * Poll status of an Ondo stock buy/sell action
   */
  const handleActionStatus = async (request: any, reply: any) => {
    const { actionId } = request.params as { actionId: string };
    if (!actionId) return reply.status(400).send({ error: 'actionId is required' });

    try {
      const status = await ondoClient.getActionStatus(actionId);
      if (!status) return reply.status(502).send({ error: 'Ondo returned no action status', actionId });
      const order = (await db.select().from(rwaOrders).where(eq(rwaOrders.actionId, actionId)).limit(1))[0];
      if (order && !request.session?.userEntityIds.includes(order.entityId)) return reply.status(403).send({ error: 'Order is not owned by the authenticated user' });
      if (order && status.status === 'SUCCESS') {
        const entity = (await db.select().from(entities).where(and(eq(entities.id, order.entityId), eq(entities.userId, request.session!.userId))).limit(1))[0];
        if (entity?.evmDepositAddress) await syncPosition(order.entityId, entity.evmDepositAddress, order.symbol);
        await db.update(rwaOrders).set({ status: 'COMPLETED' }).where(and(eq(rwaOrders.id, order.id), eq(rwaOrders.status, 'SUBMITTED')));
      } else if (order && ['FAILED', 'REFUNDED', 'EXPIRED', 'CANCELLED'].includes(status.status)) {
        await db.update(rwaOrders).set({ status: 'FAILED' }).where(and(eq(rwaOrders.id, order.id), eq(rwaOrders.status, 'SUBMITTED')));
        await db.update(rwaPositions).set({ reservedShares: sql`GREATEST(${rwaPositions.reservedShares} - ${order.shares}, 0)` })
          .where(and(eq(rwaPositions.entityId, order.entityId), eq(rwaPositions.symbol, order.symbol)));
      }
      return reply.send({
        success: true,
        actionId,
        status,
      });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Ondo action status unavailable', actionId, details: err.message });
    }
  };

  server.get('/api/ondo/status/:actionId', handleActionStatus);
  server.get('/api/ondo/action/:actionId', handleActionStatus);

  /**
   * GET /api/ondo/market-status/:symbol
   * Check US stock market live status
   */
  server.get('/api/ondo/market-status/:symbol', async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    try {
      const marketStatus = await ondoClient.getMarketStatus(symbol);
      return reply.send({
        success: true,
        symbol,
        isOpen: marketStatus.isOpen,
        tradable: marketStatus.asset?.tradable || false,
        marketStatus: marketStatus.marketStatus,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to check market status', details: err.message });
    }
  });

  /**
   * POST /api/ondo/buy
   * Buy Tokenized Stocks & RWAs using NEAR MPC Signatures
   */
  server.post('/api/ondo/buy', async (request, reply) => {
    const { entityId, symbol, strategyId, amountUsd, usdAmount, userWallet } = request.body as {
      entityId: string;
      symbol?: string;
      strategyId?: string;
      amountUsd?: number;
      usdAmount?: number;
      userWallet?: string;
    };

    const finalAmountUsd = Number(amountUsd || usdAmount || 0);

    if (!entityId || (!symbol && !strategyId) || !finalAmountUsd || finalAmountUsd <= 0) {
      return reply.status(400).send({ error: 'entityId, symbol, and valid amountUsd are required' });
    }
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    try {
      const symbolUpper = (symbol || strategyId || '').toUpperCase();
      const entityRows = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session!.userId))).limit(1);
      const wallet = entityRows[0]?.evmDepositAddress;
      if (!wallet) return reply.status(409).send({ error: 'Entity EVM wallet is unavailable' });
      if (userWallet && userWallet.toLowerCase() !== wallet.toLowerCase()) return reply.status(403).send({ error: 'Wallet does not belong to the entity' });
      const resolvedStrategyId = strategyId || await ondoClient.resolveStrategyId(symbolUpper);
      if (!resolvedStrategyId) return reply.status(409).send({ error: 'Ondo strategy is unavailable' });

      // 1. Fetch Ondo bytecode
      const ondoBytecode = await ondoClient.buyStock({
        strategyId: resolvedStrategyId,
        usdAmount: finalAmountUsd,
        userWallet: wallet,
      });

      // 2. Fetch Privy user ID for NEAR MPC
      const userRows = await db.select().from(users).where(eq(users.id, request.session!.userId)).limit(1);
      const privyUserId = userRows[0]?.privyUserId;
      if (!privyUserId) return reply.status(409).send({ error: 'User does not have a Privy MPC identity' });

      // 3. Execute via NEAR MPC
      const executionResult = await PrivyNEARBridge.signTransaction({
        privyUserId,
        context: entityRows[0].kind === 'BUSINESS' ? 'business' : 'personal',
        bytecode: ondoBytecode.bytecode || [],
      });

      const orderId = `rwa_${ulid()}`;
      const actionId = ondoBytecode?.id || `action_${ulid()}`;
      const estimatedShares = 0;
      
      // Determine final transaction hash if available from MPC response
      const executionHashes = Array.isArray(executionResult) ? executionResult.map((r: any) => r.txHash).filter(Boolean) : [(executionResult as any).txHash];
      const finalTxHash = executionHashes.length > 0 ? executionHashes[executionHashes.length - 1] : '';

      // Record in database
      await db.insert(rwaOrders).values({
        id: orderId,
        entityId,
        symbol: symbolUpper,
        side: 'BUY',
        usdAmount: String(finalAmountUsd.toFixed(2)),
        shares: String(estimatedShares.toFixed(6)),
        status: 'SUBMITTED', // Directly set to SUBMITTED since we execute inline
        biconomyQuoteId: ondoBytecode?.id, // legacy field name, keeping for schema compatibility
        biconomyTxHash: finalTxHash, // legacy field name, keeping for schema compatibility
        actionId,
      });

      return reply.send({
        success: true,
        orderId,
        actionId,
        entityId,
        symbol: symbolUpper,
        amountUsd: finalAmountUsd,
        strategyId: resolvedStrategyId,
        ondoBytecode,
        executionResult,
        txHash: finalTxHash,
        executionMode: 'NEAR_MPC_SIGNATURES',
        settlementNetwork: 'Base (8453) -> BSC (56)',
        custodyProtocol: 'Ondo Global Markets',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Ondo Buy Error]:', err.message);
      return reply.status(500).send({ error: 'Stock buy order failed', details: err.message });
    }
  });

  /**
   * POST /api/ondo/sell
   * Sell Tokenized Stocks & RWAs back to Base USDC via NEAR MPC Signatures
   */
  server.post('/api/ondo/sell', async (request, reply) => {
    const { entityId, symbol, strategyId, shares, userWallet } = request.body as {
      entityId: string;
      symbol?: string;
      strategyId?: string;
      shares: number;
      userWallet?: string;
    };

    if (!entityId || (!symbol && !strategyId) || !shares || shares <= 0) {
      return reply.status(400).send({ error: 'entityId, symbol, and valid shares are required' });
    }
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    try {
      const symbolUpper = (symbol || strategyId || '').toUpperCase();
      const existingPos = await db.select().from(rwaPositions).where(and(eq(rwaPositions.entityId, entityId), eq(rwaPositions.symbol, symbolUpper))).limit(1);
      if (existingPos.length === 0 || parseFloat(existingPos[0].shares) - parseFloat(existingPos[0].reservedShares || '0') < shares) {
        return reply.status(409).send({ error: 'Insufficient confirmed shares available for sale' });
      }

      const entityRows = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session!.userId))).limit(1);
      const wallet = entityRows[0]?.evmDepositAddress;
      if (!wallet) return reply.status(409).send({ error: 'Entity EVM wallet is unavailable' });
      if (userWallet && userWallet.toLowerCase() !== wallet.toLowerCase()) return reply.status(403).send({ error: 'Wallet does not belong to the entity' });
      const resolvedStrategyId = strategyId || await ondoClient.resolveStrategyId(symbolUpper);
      if (!resolvedStrategyId) return reply.status(409).send({ error: 'Ondo strategy is unavailable' });
      const reserved = await db.update(rwaPositions).set({ reservedShares: sql`${rwaPositions.reservedShares} + ${shares}` }).where(and(
        eq(rwaPositions.id, existingPos[0].id),
        sql`${rwaPositions.shares} - ${rwaPositions.reservedShares} >= ${shares}`,
      )).returning({ id: rwaPositions.id });
      if (reserved.length === 0) return reply.status(409).send({ error: 'Shares are already reserved by another order' });
      const shareAmountWei = String(Math.floor(shares * 1e18));

      // 1. Fetch Ondo bytecode
      const ondoBytecode = await ondoClient.sellStock({
        strategyId: resolvedStrategyId,
        shareAmountWei,
        userWallet: wallet,
      });

      // 2. Fetch Privy user ID for NEAR MPC
      const userRows = await db.select().from(users).where(eq(users.id, request.session!.userId)).limit(1);
      const privyUserId = userRows[0]?.privyUserId;
      if (!privyUserId) return reply.status(409).send({ error: 'User does not have a Privy MPC identity' });

      // 3. Execute via NEAR MPC
      const executionResult = await PrivyNEARBridge.signTransaction({
        privyUserId,
        context: entityRows[0].kind === 'BUSINESS' ? 'business' : 'personal',
        bytecode: ondoBytecode.bytecode || [],
      });

      const orderId = `rwa_${ulid()}`;
      const actionId = ondoBytecode?.id || `action_${ulid()}`;
      const estimatedUsd = 0;

      // Determine final transaction hash if available from MPC response
      const executionHashes = Array.isArray(executionResult) ? executionResult.map((r: any) => r.txHash).filter(Boolean) : [(executionResult as any).txHash];
      const finalTxHash = executionHashes.length > 0 ? executionHashes[executionHashes.length - 1] : '';

      await db.insert(rwaOrders).values({
        id: orderId,
        entityId,
        symbol: symbolUpper,
        side: 'SELL',
        usdAmount: String(estimatedUsd.toFixed(2)),
        shares: String(shares.toFixed(6)),
        status: 'SUBMITTED', // Directly set to SUBMITTED since we execute inline
        biconomyQuoteId: ondoBytecode?.id,
        biconomyTxHash: finalTxHash,
        actionId,
      });

      return reply.send({
        success: true,
        orderId,
        actionId,
        entityId,
        symbol: symbolUpper,
        sharesSold: shares,
        strategyId: resolvedStrategyId,
        ondoBytecode,
        executionResult,
        txHash: finalTxHash,
        executionMode: 'NEAR_MPC_SIGNATURES',
        payoutAsset: 'Base USDC',
        custodyProtocol: 'Ondo Global Markets',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Ondo Sell Error]:', err.message);
      return reply.status(500).send({ error: 'Stock sell order failed', details: err.message });
    }
  });
}