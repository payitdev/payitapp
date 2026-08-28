import { FastifyInstance } from 'fastify';
import { and, createDbClient, eq } from '@payit/db';
import { entities } from '@payit/db/schema';
import { BiconomyClient } from '@payit/integrations';

const db = createDbClient();
const biconomyClient = new BiconomyClient();

export async function biconomyRoutes(server: FastifyInstance) {
  /**
   * GET /api/biconomy/orchestrator-addresses
   * Fetch Biconomy orchestrator smart contract addresses across EVM chains
   */
  server.get('/api/biconomy/orchestrator-addresses', async (_request, reply) => {
    try {
      const data = await biconomyClient.getOrchestratorAddresses();
      return reply.send(data);
    } catch (err: any) {
      console.error('[Route /api/biconomy/orchestrator-addresses] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to fetch orchestrator addresses', details: err.message });
    }
  });

  /**
   * POST /api/biconomy/compose-quote
   * Compose gasless instructions and generate execution quote
   */
  server.post('/api/biconomy/compose-quote', async (request, reply) => {
    try {
      const { userOp, chainId, mode, sponsor, instructions } = request.body as {
        userOp?: Record<string, any>;
        chainId: number;
        mode?: 'gasless' | 'token';
        sponsor?: boolean;
        instructions?: Array<{ to: string; data: string; value?: string }>;
      };

      if (!chainId) {
        return reply.status(400).send({ error: 'chainId is required' });
      }
      if (![56, 100, 8453].includes(Number(chainId))) return reply.status(400).send({ error: 'Unsupported execution chain' });
      const sender = String(userOp?.sender || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(sender)) return reply.status(400).send({ error: 'A valid wallet-bound user operation is required' });
      const owned = await db.select().from(entities).where(and(
        eq(entities.userId, request.session!.userId),
        eq(entities.evmDepositAddress, sender),
      )).limit(1);
      if (owned.length === 0) return reply.status(403).send({ error: 'Wallet is not owned by the authenticated user' });

      const quote = await biconomyClient.composeInstructionsAndGenerateQuote({
        userOp: userOp || {},
        chainId: Number(chainId),
        mode,
        sponsor,
        instructions,
      });

      return reply.send(quote);
    } catch (err: any) {
      console.error('[Route /api/biconomy/compose-quote] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to compose quote', details: err.message });
    }
  });

  /**
   * POST /api/biconomy/submit-supertransaction
   * Submit signed supertransaction for execution
   */
  server.post('/api/biconomy/submit-supertransaction', async (request, reply) => {
    try {
      const { quoteId, signature, userOp, chainId } = request.body as {
        quoteId?: string;
        signature: string;
        userOp?: Record<string, any>;
        chainId: number;
      };

      if (!signature || !chainId) {
        return reply.status(400).send({ error: 'signature and chainId are required' });
      }
      const sender = String(userOp?.sender || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(sender)) return reply.status(400).send({ error: 'A valid wallet-bound user operation is required' });
      const owned = await db.select().from(entities).where(and(
        eq(entities.userId, request.session!.userId),
        eq(entities.evmDepositAddress, sender),
      )).limit(1);
      if (owned.length === 0) return reply.status(403).send({ error: 'Wallet is not owned by the authenticated user' });

      const result = await biconomyClient.submitSupertransaction({
        quoteId,
        signature,
        userOp: userOp || {},
        chainId: Number(chainId),
      });

      return reply.send(result);
    } catch (err: any) {
      console.error('[Route /api/biconomy/submit-supertransaction] Error:', err.message);
      return reply.status(500).send({ error: 'Failed to submit supertransaction', details: err.message });
    }
  });
}
