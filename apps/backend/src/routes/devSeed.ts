import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { entities, ledgerEntries, ledgerAccounts } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

export async function devSeedRoutes(server: FastifyInstance) {
  /**
   * POST /api/dev/seed-deposit
   */
  server.post('/api/dev/seed-deposit', async (request, reply) => {
    const adminSecret = request.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SEED_SECRET || 'dev_seed_secret';
    if (!adminSecret || adminSecret !== expectedSecret) {
      return reply.status(403).send({ error: 'UNAUTHORIZED_SEED_REQUEST', message: 'Valid x-admin-secret header required' });
    }

    const { entityId, amount, currency = 'USD' } = request.body as {
      entityId: string;
      amount: number;
      currency?: string;
    };

    if (!entityId || !amount || amount <= 0) {
      return reply.status(400).send({ error: 'entityId and a positive amount are required' });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const txId = ulid();
    const currUpper = (currency || 'USD').toUpperCase();
    const ledgerAccId = `${entityId}_cash_${currUpper}`;
    const ledgerClearId = `${entityId}_inbound_${currUpper}`;

    const existingAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
    if (existingAcc.length === 0) {
      await db.insert(ledgerAccounts).values([
        {
          id: ledgerAccId,
          entityId,
          name: `Available ${currUpper}`,
          type: 'ASSET',
          currency: currUpper,
        },
        {
          id: ledgerClearId,
          entityId,
          name: `Inbound Clearing ${currUpper}`,
          type: 'LIABILITY',
          currency: currUpper,
        },
      ]);
    }

    await db.insert(ledgerEntries).values([
      {
        id: ulid(),
        entityId,
        transactionId: txId,
        ledgerAccountId: ledgerAccId,
        type: 'DEBIT',
        amount: String(amount.toFixed(4)),
      },
      {
        id: ulid(),
        entityId,
        transactionId: txId,
        ledgerAccountId: ledgerClearId,
        type: 'CREDIT',
        amount: String(amount.toFixed(4)),
      },
    ]);

    return reply.send({
      success: true,
      message: `Seeded ${amount} ${currUpper} deposit into entity ${entityId}`,
      transactionId: txId,
    });
  });
}
