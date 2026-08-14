/**
 * Pods Finance Integration Routes
 * 
 * Implements PayIT's savings engine using Pods Finance yield strategies
 * Operates exclusively on Base (chainId 8453) with NEAR MPC signing
 */

import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { PodsClient, buildDerivationPath, signAndSubmitTransaction, deriveUserAddress } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { entities, auditLogs, ledgerEntries, ledgerAccounts } from '@payit/db/schema';
import { validatePodsEnv } from '../env.js';
import { ulid } from 'ulid';

const db = createDbClient();

export async function podsRoutes(server: FastifyInstance) {
  // Check if Pods environment is configured
  const podsEnabled = validatePodsEnv();
  let pods: PodsClient | null = null;
  
  if (podsEnabled) {
    try {
      pods = new PodsClient();
      server.log.info('Pods Finance integration enabled');
    } catch (error: any) {
      server.log.warn({ error: error.message }, 'Pods Finance initialization failed, features disabled');
    }
  }

  /**
   * GET /api/pods/strategies
   * Fetch available Base strategies from Pods API
   */
  server.get('/api/pods/strategies', async (request, reply) => {
    if (!pods) {
      return reply.status(503).send({ error: 'Pods integration not configured' });
    }

    try {
      const strategies = await pods.getBaseStrategies();
      return reply.send({
        success: true,
        strategies,
        count: strategies.length,
      });
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to fetch Pods strategies');
      return reply.status(500).send({ error: 'Failed to fetch strategies' });
    }
  });

  /**
   * GET /api/pods/strategies/token/:tokenAddress
   * Find strategies matching a specific token on Base
   */
  server.get('/api/pods/strategies/token/:tokenAddress', async (request, reply) => {
    if (!pods) {
      return reply.status(503).send({ error: 'Pods integration not configured' });
    }

    const { tokenAddress } = request.params as { tokenAddress: string };

    try {
      const strategies = await pods.findStrategiesByToken(tokenAddress);
      return reply.send({
        success: true,
        strategies,
        count: strategies.length,
      });
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to find token strategies');
      return reply.status(500).send({ error: 'Failed to find token strategies' });
    }
  });

  /**
   * GET /api/pods/strategies/opencover
   * Find OpenCover-insured strategies on Base
   */
  server.get('/api/pods/strategies/opencover', async (request, reply) => {
    if (!pods) {
      return reply.status(503).send({ error: 'Pods integration not configured' });
    }

    try {
      const strategies = await pods.findOpenCoverStrategies();
      return reply.send({
        success: true,
        strategies,
        count: strategies.length,
        note: strategies.length === 0 ? 'No OpenCover+Base strategies found' : undefined,
      });
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to find OpenCover strategies');
      return reply.status(500).send({ error: 'Failed to find OpenCover strategies' });
    }
  });

  /**
   * POST /api/pods/deposit
   * Deposit into a Pods yield strategy
   */
  server.post('/api/pods/deposit', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    if (!pods) {
      return reply.status(503).send({ error: 'Pods integration not configured' });
    }

    const {
      entityId,
      strategyId,
      amount,
      context = 'personal',
      destinationWallet,
    } = request.body as {
      entityId: string;
      strategyId: string;
      amount: string;
      context?: 'personal' | 'business';
      destinationWallet?: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!strategyId || !amount) {
      return reply.status(400).send({ error: 'strategyId and amount are required' });
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
      
      // Derive the Base address for this user/context
      const { address: sourceWallet } = await deriveUserAddress(userIdentifier, context);
      
      // If no destination specified, use source wallet
      const finalDestinationWallet = destinationWallet || sourceWallet;

      server.log.info({
        entityId,
        strategyId,
        amount,
        context,
        sourceWallet,
        destinationWallet: finalDestinationWallet,
      }, 'Initiating Pods deposit');

      // Get deposit bytecode from Pods
      const bytecodeResponse = await pods.getSavingsDepositBytecode({
        strategyId,
        amount,
        sourceWallet,
        destinationWallet: finalDestinationWallet,
      });

      server.log.info({
        bytecodeLegs: bytecodeResponse.bytecode.length,
        crossChain: bytecodeResponse.crossChain.isCrossChain,
      }, 'Received deposit bytecode from Pods');

      // Sign and submit transaction using NEAR MPC
      const signingResults = await signAndSubmitTransaction({
        userIdentifier,
        context,
        bytecode: bytecodeResponse.bytecode.map(leg => ({
          to: leg.to,
          data: leg.data,
          value: leg.value,
          chainId: leg.chainId || 8453, // Default to Base if not specified
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

      // Log successful deposit
      await db.insert(auditLogs).values({
        id: ulid(),
        userId: session.userId,
        entityId,
        action: 'PODS_DEPOSIT',
        metadata: JSON.stringify({
          strategyId,
          amount,
          context,
          sourceWallet,
          destinationWallet: finalDestinationWallet,
          txHashes: signingResults.map(r => r.txHash),
          podsActionId: bytecodeResponse.id,
        }),
        createdAt: new Date(),
      });

      return reply.send({
        success: true,
        action: 'PODS_DEPOSIT',
        strategyId,
        amount,
        context,
        podsActionId: bytecodeResponse.id,
        transactions: signingResults,
        message: `Successfully deposited to ${strategyId}`,
      });

    } catch (error: any) {
      server.log.error({ error: error.message }, 'Pods deposit failed');
      return reply.status(500).send({ error: `Deposit failed: ${error.message}` });
    }
  });

  /**
   * POST /api/pods/withdraw
   * Withdraw from a Pods yield strategy
   */
  server.post('/api/pods/withdraw', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    if (!pods) {
      return reply.status(503).send({ error: 'Pods integration not configured' });
    }

    const {
      entityId,
      strategyId,
      amount,
      context = 'personal',
      destinationWallet,
    } = request.body as {
      entityId: string;
      strategyId: string;
      amount: string;
      context?: 'personal' | 'business';
      destinationWallet?: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!strategyId || !amount) {
      return reply.status(400).send({ error: 'strategyId and amount are required' });
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
      
      // Derive the Base address for this user/context
      const { address: sourceWallet } = await deriveUserAddress(userIdentifier, context);
      
      // If no destination specified, use source wallet
      const finalDestinationWallet = destinationWallet || sourceWallet;

      server.log.info({
        entityId,
        strategyId,
        amount,
        context,
        sourceWallet,
        destinationWallet: finalDestinationWallet,
      }, 'Initiating Pods withdrawal');

      // Get withdrawal bytecode from Pods
      const bytecodeResponse = await pods.getSavingsWithdrawBytecode({
        strategyId,
        amount,
        sourceWallet,
        destinationWallet: finalDestinationWallet,
      });

      server.log.info({
        bytecodeLegs: bytecodeResponse.bytecode.length,
        crossChain: bytecodeResponse.crossChain.isCrossChain,
      }, 'Received withdrawal bytecode from Pods');

      // Sign and submit transaction using NEAR MPC
      const signingResults = await signAndSubmitTransaction({
        userIdentifier,
        context,
        bytecode: bytecodeResponse.bytecode.map(leg => ({
          to: leg.to,
          data: leg.data,
          value: leg.value,
          chainId: leg.chainId || 8453, // Default to Base if not specified
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

      // Log successful withdrawal
      await db.insert(auditLogs).values({
        id: ulid(),
        userId: session.userId,
        entityId,
        action: 'PODS_WITHDRAW',
        metadata: JSON.stringify({
          strategyId,
          amount,
          context,
          sourceWallet,
          destinationWallet: finalDestinationWallet,
          txHashes: signingResults.map(r => r.txHash),
          podsActionId: bytecodeResponse.id,
        }),
        createdAt: new Date(),
      });

      return reply.send({
        success: true,
        action: 'PODS_WITHDRAW',
        strategyId,
        amount,
        context,
        podsActionId: bytecodeResponse.id,
        transactions: signingResults,
        message: `Successfully withdrew from ${strategyId}`,
      });

    } catch (error: any) {
      server.log.error({ error: error.message }, 'Pods withdrawal failed');
      return reply.status(500).send({ error: `Withdrawal failed: ${error.message}` });
    }
  });

  /**
   * GET /api/pods/positions/:entityId
   * Get yield positions for an entity (both personal and business contexts)
   */
  server.get('/api/pods/positions/:entityId', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    if (!pods) {
      return reply.status(503).send({ error: 'Pods integration not configured' });
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
        pods.getUserSavingsPosition(personalAddress),
        pods.getUserSavingsPosition(businessAddress),
      ]);

      return reply.send({
        success: true,
        entityId,
        personal: {
          address: personalAddress,
          positions: personalPositions.positions,
          summary: personalPositions.summary,
        },
        business: {
          address: businessAddress,
          positions: businessPositions.positions,
          summary: businessPositions.summary,
        },
        note: 'Personal and Business positions are tracked separately as per PayIT account model',
      });

    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to fetch Pods positions');
      return reply.status(500).send({ error: 'Failed to fetch positions' });
    }
  });

  /**
   * GET /api/pods/action/:actionId
   * Check status of an async Pods action
   */
  server.get('/api/pods/action/:actionId', async (request, reply) => {
    if (!pods) {
      return reply.status(503).send({ error: 'Pods integration not configured' });
    }

    const { actionId } = request.params as { actionId: string };

    try {
      const status = await pods.getActionStatus(actionId);
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
}