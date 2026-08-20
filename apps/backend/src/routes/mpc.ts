import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { entities, users } from '@payit/db/schema';
import { PrivyNEARBridge, liquidationService } from '@payit/integrations';

const db = createDbClient();

export async function mpcRoutes(server: FastifyInstance) {

  /**
   * POST /api/mpc/liquidation-quote
   * Fetches AI-verified DEX pool liquidity & auto-swap route to convert deposits into USDC/USDT
   */
  server.post('/api/mpc/liquidation-quote', async (request, reply) => {
    const { tokenSymbol, chain, amount, targetStablecoin = 'USDC' } = request.body as {
      tokenSymbol: string;
      chain: string;
      amount: string;
      targetStablecoin?: 'USDC' | 'USDT';
    };

    if (!tokenSymbol || !chain || !amount) {
      return reply.status(400).send({ error: 'tokenSymbol, chain, and amount are required' });
    }

    try {
      const quote = await liquidationService.analyzeAndSelectLiquidityPool({
        tokenSymbol,
        chain,
        amount,
        targetStablecoin,
      });

      return reply.send({
        success: true,
        quote,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to generate liquidation quote', details: err.message });
    }
  });

  /**
   * POST /api/mpc/derive-addresses
   * Dynamically fetch or re-derive multi-chain MPC addresses for an entity
   */
  server.post('/api/mpc/derive-addresses', async (request, reply) => {
    const { entityId } = request.body as { entityId: string };
    if (!entityId) {
      return reply.status(400).send({ error: 'entityId is required' });
    }

    try {
      const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
      if (entityRows.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const entity = entityRows[0];
      const userRows = await db.select().from(users).where(eq(users.id, entity.userId)).limit(1);
      const privyUserId = userRows[0]?.privyUserId || entity.userId;
      const context = entity.kind === 'BUSINESS' ? 'business' : 'personal';

      const derivation = await PrivyNEARBridge.deriveAddress(privyUserId, context);

      // Update entity if addresses were updated
      await db.update(entities).set({
        evmDepositAddress: derivation.evmAddress,
        solanaDepositAddress: derivation.solanaAddress,
        btcDepositAddress: derivation.btcAddress,
        tronDepositAddress: derivation.tronAddress,
        tonDepositAddress: derivation.tonAddress,
        cosmosDepositAddress: derivation.cosmosAddress,
        suiDepositAddress: derivation.suiAddress,
        aptosDepositAddress: derivation.aptosAddress,
        xrpDepositAddress: derivation.xrpAddress,
        nearDepositAddress: derivation.nearDepositAddress,
      }).where(eq(entities.id, entityId));

      return reply.send({
        success: true,
        entityId,
        kind: entity.kind,
        addresses: {
          evm: derivation.evmAddress,
          solana: derivation.solanaAddress,
          btc: derivation.btcAddress,
          tron: derivation.tronAddress,
          ton: derivation.tonAddress,
          cosmos: derivation.cosmosAddress,
          sui: derivation.suiAddress,
          aptos: derivation.aptosAddress,
          xrp: derivation.xrpAddress,
          near: derivation.nearDepositAddress,
        },
        path: derivation.path,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to derive MPC addresses', details: err.message });
    }
  });

  /**
   * POST /api/mpc/sign-evm
   * Request NEAR MPC EVM signature for transaction bytecode
   */
  server.post('/api/mpc/sign-evm', async (request, reply) => {
    const { entityId, bytecode, targetChain } = request.body as {
      entityId: string;
      bytecode: Array<{ to: string; data: string; value: string; chainId: number }>;
      targetChain?: 'base' | 'bsc';
    };

    if (!entityId || !bytecode || !Array.isArray(bytecode)) {
      return reply.status(400).send({ error: 'entityId and array of bytecode legs are required' });
    }

    try {
      const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
      if (entityRows.length === 0) return reply.status(404).send({ error: 'Entity not found' });

      const entity = entityRows[0];
      const userRows = await db.select().from(users).where(eq(users.id, entity.userId)).limit(1);
      const privyUserId = userRows[0]?.privyUserId || entity.userId;
      const context = entity.kind === 'BUSINESS' ? 'business' : 'personal';

      const results = await PrivyNEARBridge.signTransaction({
        privyUserId,
        context,
        bytecode,
        targetChain: targetChain || 'base',
      });

      return reply.send({
        success: true,
        entityId,
        kind: entity.kind,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'EVM MPC signing failed', details: err.message });
    }
  });
}
