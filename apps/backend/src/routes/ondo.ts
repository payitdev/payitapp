/**
 * Ondo Global Markets Integration Routes
 * 
 * Implements PayIT's stock/ETF trading using Pods Finance Ondo Global Markets
 * Operates on BSC for positions with Base funding/payout support
 */

import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { OndoClient, buildDerivationPath, deriveUserAddress, signAndSubmitTransaction } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { entities, auditLogs } from '@payit/db/schema';
import { validatePodsEnv } from '../env.js';
import { ulid } from 'ulid';

const db = createDbClient();

// Simple in-memory cache for stock listings (5-minute TTL)
let stockListCache: {
  stocks: any[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function ondoRoutes(server: FastifyInstance) {
  // Check if Pods environment is configured
  const podsEnabled = validatePodsEnv();
  let ondo: OndoClient | null = null;
  
  if (podsEnabled) {
    try {
      ondo = new OndoClient();
      server.log.info('Ondo Global Markets integration enabled');
    } catch (error: any) {
      server.log.warn({ error: error.message }, 'Ondo Global Markets initialization failed, features disabled');
    }
  }

  /**
   * GET /api/ondo/market-status/:symbol
   * STEP 1: Check market status for a specific ticker
   */
  server.get('/api/ondo/market-status/:symbol', async (request, reply) => {
    if (!ondo) {
      return reply.status(503).send({ error: 'Ondo integration not configured' });
    }

    const { symbol } = request.params as { symbol: string };

    try {
      const marketStatus = await ondo.getMarketStatus(symbol);
      
      // Block request if not tradable
      if (!marketStatus.asset?.tradable) {
        return reply.status(400).send({
          error: 'MARKET_CLOSED',
          message: marketStatus.asset.blockingReason?.message || 'Market is currently closed for this asset',
          blockingReason: marketStatus.asset.blockingReason,
        });
      }

      return reply.send({
        success: true,
        symbol,
        isOpen: marketStatus.isOpen,
        tradable: marketStatus.asset.tradable,
        marketStatus: marketStatus.marketStatus,
        nextOpen: marketStatus.nextOpen,
        nextClose: marketStatus.nextClose,
      });
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to fetch market status');
      return reply.status(500).send({ error: 'Failed to fetch market status' });
    }
  });

  /**
   * GET /api/ondo/stocks
   * STEP 2: List available stocks/ETFs on BSC with cached strategy resolution
   */
  server.get('/api/ondo/stocks', async (request, reply) => {
    if (!ondo) {
      return reply.status(503).send({ error: 'Ondo integration not configured' });
    }

    try {
      // Check cache
      const now = Date.now();
      if (stockListCache && (now - stockListCache.timestamp) < CACHE_TTL) {
        return reply.send({
          success: true,
          cached: true,
          stocks: stockListCache.stocks,
        });
      }

      // Fetch fresh data
      const tokens = await ondo.listStocksAndETFs();
      
      // Resolve strategy IDs for each token
      const stocksWithStrategies = await Promise.all(
        tokens.map(async (token) => {
          const strategyId = await ondo.resolveStrategyId(token.address);
          return {
            ...token,
            strategyId,
            hasStrategy: !!strategyId,
          };
        })
      );

      // Update cache
      stockListCache = {
        stocks: stocksWithStrategies,
        timestamp: now,
      };

      return reply.send({
        success: true,
        cached: false,
        stocks: stocksWithStrategies,
      });
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to list stocks/ETFs');
      return reply.status(500).send({ error: 'Failed to list stocks/ETFs' });
    }
  });

  /**
   * POST /api/ondo/buy
   * STEP 3: Buy stock with Base USDC funding
   */
  server.post('/api/ondo/buy', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    if (!ondo) {
      return reply.status(503).send({ error: 'Ondo integration not configured' });
    }

    const {
      entityId,
      strategyId,
      usdAmount,
      accountContext = 'personal',
    } = request.body as {
      entityId: string;
      strategyId: string;
      usdAmount: number;
      accountContext?: 'personal' | 'business';
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    // Client-side + server-side validation for $10 minimum
    if (usdAmount < 10) {
      return reply.status(400).send({
        error: 'REQUEST_LEND_AMOUNT_TOO_LOW',
        message: 'Minimum purchase amount is $10 USD',
      });
    }

    try {
      // Get entity to derive user identifier
      const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
      if (entityRows.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }
      const entity = entityRows[0];

      // Use entity ID as user identifier for derivation
      const userIdentifier = entity.id;
      
      // Derive the Base address (same as Savings, no new address for stocks)
      const { address: userWallet } = await deriveUserAddress(userIdentifier, accountContext);

      server.log.info({
        entityId,
        strategyId,
        usdAmount,
        accountContext,
        userWallet,
      }, 'Initiating Ondo stock purchase');

      // Get buy bytecode from Pods
      const bytecodeResponse = await ondo.buyStock({
        strategyId,
        usdAmount,
        userWallet,
      });

      server.log.info({
        bytecodeLegs: bytecodeResponse.bytecode.length,
        crossChain: bytecodeResponse.crossChain.isCrossChain,
        quote: bytecodeResponse.quote,
      }, 'Received buy bytecode from Ondo');

      // Filter bytecode for Base chain (funding chain)
      const baseBytecode = bytecodeResponse.bytecode.filter(
        leg => Number(leg.chainId) === 8453
      );

      if (baseBytecode.length === 0) {
        return reply.status(500).send({
          error: 'No Base bytecode legs found',
          bytecode: bytecodeResponse.bytecode,
        });
      }

      // Sign and submit transaction using NEAR MPC (MVP - individual signing)
      const signingResults = await signAndSubmitTransaction({
        userIdentifier,
        context: accountContext,
        bytecode: baseBytecode.map(leg => ({
          to: leg.to,
          data: leg.data,
          value: leg.value,
          chainId: leg.chainId,
        })),
        targetChain: 'base',
      });

      // Check if all legs succeeded
      const allSuccess = signingResults.every(r => r.success);
      if (!allSuccess) {
        const failedLegs = signingResults.filter(r => !r.success);
        return reply.status(500).send({
          error: 'Some transaction legs failed',
          failedLegs,
          results: signingResults,
        });
      }

      // Store order history
      await db.insert(auditLogs).values({
        id: ulid(),
        userId: session.userId,
        entityId,
        action: 'ONDO_BUY',
        metadata: JSON.stringify({
          strategyId,
          usdAmount,
          accountContext,
          userWallet,
          txHashes: signingResults.map(r => r.txHash),
          actionId: bytecodeResponse.id,
          orderUid: bytecodeResponse.orderUid,
          singleUseAddress: bytecodeResponse.singleUseAddress,
          quote: bytecodeResponse.quote,
        }),
        createdAt: new Date(),
      });

      return reply.send({
        success: true,
        action: 'ONDO_BUY',
        strategyId,
        usdAmount,
        accountContext,
        actionId: bytecodeResponse.id,
        orderUid: bytecodeResponse.orderUid,
        singleUseAddress: bytecodeResponse.singleUseAddress,
        quote: bytecodeResponse.quote,
        transactions: signingResults,
        message: `Stock purchase initiated for ${strategyId}`,
      });

    } catch (error: any) {
      server.log.error({ error: error.message }, 'Ondo buy failed');
      return reply.status(500).send({ error: `Stock purchase failed: ${error.message}` });
    }
  });

  /**
   * POST /api/ondo/sell
   * STEP 4: Sell stock with BSC signing and Base payout
   */
  server.post('/api/ondo/sell', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    if (!ondo) {
      return reply.status(503).send({ error: 'Ondo integration not configured' });
    }

    const {
      entityId,
      strategyId,
      shareAmountWei,
      accountContext = 'personal',
    } = request.body as {
      entityId: string;
      strategyId: string;
      shareAmountWei: string;
      accountContext?: 'personal' | 'business';
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    try {
      // Get entity to derive user identifier
      const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
      if (entityRows.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }
      const entity = entityRows[0];

      // Use entity ID as user identifier for derivation
      const userIdentifier = entity.id;
      
      // Derive the Base address (same wallet used for stocks)
      const { address: userWallet } = await deriveUserAddress(userIdentifier, accountContext);

      // STEP 4.1: Check available shares before allowing sell
      const currentPosition = await ondo.getUserStockPositions(userWallet);
      const targetPosition = currentPosition.find(p => p.strategy.id === strategyId);
      
      if (!targetPosition) {
        return reply.status(400).send({
          error: 'NO_POSITION',
          message: 'No position found for this stock',
        });
      }

      const currentShares = BigInt(targetPosition.spotPosition.currentPositionInShares.value);
      const requestedShares = BigInt(shareAmountWei);
      
      if (requestedShares > currentShares) {
        return reply.status(400).send({
          error: 'INSUFFICIENT_SHARES',
          message: `Insufficient shares. Available: ${targetPosition.spotPosition.currentPositionInShares.humanized}, Requested: ${shareAmountWei}`,
          availableShares: targetPosition.spotPosition.currentPositionInShares.humanized,
        });
      }

      server.log.info({
        entityId,
        strategyId,
        shareAmountWei,
        accountContext,
        userWallet,
        availableShares: targetPosition.spotPosition.currentPositionInShares.humanized,
      }, 'Initiating Ondo stock sale');

      // Get sell bytecode from Pods
      const bytecodeResponse = await ondo.sellStock({
        strategyId,
        shareAmountWei,
        userWallet,
      });

      server.log.info({
        bytecodeLegs: bytecodeResponse.bytecode.length,
        crossChain: bytecodeResponse.crossChain.isCrossChain,
        quote: bytecodeResponse.quote,
      }, 'Received sell bytecode from Ondo');

      // Filter bytecode for BSC chain (position chain, always for sells)
      const bscBytecode = bytecodeResponse.bytecode.filter(
        leg => Number(leg.chainId) === 56
      );

      if (bscBytecode.length === 0) {
        return reply.status(500).send({
          error: 'No BSC bytecode legs found',
          bytecode: bytecodeResponse.bytecode,
        });
      }

      // ⚠️ IMPORTANT: Sign using SAME derivation path but BSC chain config
      // This is the same underlying address, only target chain changes
      server.log.info({
        userIdentifier,
        context: accountContext,
        chain: 'BSC',
        legs: bscBytecode.length,
      }, 'Signing BSC transaction with same derivation path');

      // Sign and submit transaction using NEAR MPC (MVP - individual signing on BSC)
      const signingResults = await signAndSubmitTransaction({
        userIdentifier,
        context: accountContext,
        bytecode: bscBytecode.map(leg => ({
          to: leg.to,
          data: leg.data,
          value: leg.value,
          chainId: leg.chainId,
        })),
        targetChain: 'bsc',
      });

      // Store order history
      await db.insert(auditLogs).values({
        id: ulid(),
        userId: session.userId,
        entityId,
        action: 'ONDO_SELL',
        metadata: JSON.stringify({
          strategyId,
          shareAmountWei,
          accountContext,
          userWallet,
          txHashes: signingResults.map(r => r.txHash),
          actionId: bytecodeResponse.id,
          orderUid: bytecodeResponse.orderUid,
          singleUseAddress: bytecodeResponse.singleUseAddress,
          quote: bytecodeResponse.quote,
        }),
        createdAt: new Date(),
      });

      return reply.send({
        success: true,
        action: 'ONDO_SELL',
        strategyId,
        shareAmountWei,
        accountContext,
        actionId: bytecodeResponse.id,
        orderUid: bytecodeResponse.orderUid,
        singleUseAddress: bytecodeResponse.singleUseAddress,
        quote: bytecodeResponse.quote,
        transactions: signingResults,
        message: `Stock sale initiated for ${strategyId}`,
      });

    } catch (error: any) {
      server.log.error({ error: error.message }, 'Ondo sell failed');
      return reply.status(500).send({ error: `Stock sale failed: ${error.message}` });
    }
  });

  /**
   * GET /api/ondo/positions/:entityId
   * STEP 6: Get user's stock positions (Personal and Business separate)
   */
  server.get('/api/ondo/positions/:entityId', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    if (!ondo) {
      return reply.status(503).send({ error: 'Ondo integration not configured' });
    }

    const { entityId } = request.params as { entityId: string };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    try {
      // Get entity
      const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
      if (entityRows.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }
      const entity = entityRows[0];

      const userIdentifier = entity.id;

      // Get positions for both personal and business contexts separately
      const personalAddress = (await deriveUserAddress(userIdentifier, 'personal')).address;
      const businessAddress = (await deriveUserAddress(userIdentifier, 'business')).address;

      const [personalPositions, businessPositions] = await Promise.all([
        ondo.getUserStockPositions(personalAddress),
        ondo.getUserStockPositions(businessAddress),
      ]);

      return reply.send({
        success: true,
        entityId,
        personal: {
          address: personalAddress,
          positions: personalPositions,
        },
        business: {
          address: businessAddress,
          positions: businessPositions,
        },
        note: 'Personal and Business stock positions are tracked separately as per PayIT account model',
      });

    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to fetch Ondo positions');
      return reply.status(500).send({ error: 'Failed to fetch stock positions' });
    }
  });

  /**
   * GET /api/ondo/action/:actionId
   * STEP 5: Check action status (HTTP fallback for polling)
   */
  server.get('/api/ondo/action/:actionId', async (request, reply) => {
    if (!ondo) {
      return reply.status(503).send({ error: 'Ondo integration not configured' });
    }

    const { actionId } = request.params as { actionId: string };

    try {
      const status = await ondo.getActionStatus(actionId);
      return reply.send({
        success: true,
        actionId,
        status,
      });
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to fetch action status');
      return reply.status(500).send({ error: 'Failed to fetch action status' });
    }
  });

  /**
   * GET /api/ondo/strategy-status/:strategyId
   * STEP 5: Check strategy status for polling fallback
   */
  server.get('/api/ondo/strategy-status/:strategyId', async (request, reply) => {
    if (!ondo) {
      return reply.status(503).send({ error: 'Ondo integration not configured' });
    }

    const { strategyId } = request.params as { strategyId: string };
    const { wallet } = request.query as { wallet?: string };

    if (!wallet) {
      return reply.status(400).send({ error: 'wallet parameter is required' });
    }

    try {
      const status = await ondo.getStrategyStatus(strategyId, wallet);
      return reply.send({
        success: true,
        strategyId,
        status,
      });
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to fetch strategy status');
      return reply.status(500).send({ error: 'Failed to fetch strategy status' });
    }
  });
}