/**
 * Dev/Staging-only seed routes.
 * These routes are ONLY registered when NODE_ENV !== 'production'.
 * They simulate a Nuvion deposit so developers can test the full
 * balance + activity flow without a live bank transfer.
 */
import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { entities, auditLogs, ledgerEntries, ledgerAccounts } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

export async function devSeedRoutes(server: FastifyInstance) {
  /**
   * POST /api/dev/seed-deposit
   * Seeds a fake Nuvion deposit into the ledger for the given entity.
   * Body: { entityId: string, amount: number, currency?: string }
   */
  server.post('/api/dev/seed-deposit', async (request, reply) => {
    const adminSecret = request.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SEED_SECRET || 'dev_seed_secret';
    if (!adminSecret || adminSecret !== expectedSecret) {
      return reply.status(403).send({ error: 'UNAUTHORIZED_SEED_REQUEST', message: 'Valid x-admin-secret header required' });
    }

    const { entityId, amount, currency = 'NGN' } = request.body as {
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
    const entity = entityRows[0];

    const txId = ulid();
    const currUpper = (currency || 'NGN').toUpperCase();
    const ledgerAccId = `${entityId}_cash_${currUpper}`;
    const ledgerClearId = `${entityId}_inbound_${currUpper}`;

    // Ensure ledger accounts exist
    const existingAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
    if (existingAcc.length === 0) {
      await db.insert(ledgerAccounts).values([
        { id: ledgerAccId, entityId, name: `Cash / Wallet (${currUpper})`, type: 'ASSET', currency: currUpper, createdAt: new Date() },
        { id: ledgerClearId, entityId, name: `Inbound Deposit Clearing (${currUpper})`, type: 'LIABILITY', currency: currUpper, createdAt: new Date() },
      ]);
    }

    // Double-entry: debit clearing, credit cash
    await db.insert(ledgerEntries).values([
      { id: ulid(), entityId, transactionId: txId, ledgerAccountId: ledgerClearId, type: 'DEBIT', amount: String(amount), createdAt: new Date() },
      { id: ulid(), entityId, transactionId: txId, ledgerAccountId: ledgerAccId, type: 'CREDIT', amount: String(amount), createdAt: new Date() },
    ]);

    // Audit log so it shows up in /api/transfers/history
    await db.insert(auditLogs).values({
      id: ulid(),
      userId: entity.userId,
      entityId,
      action: 'NUVION_DEPOSIT_CREDITED',
      metadata: JSON.stringify({
        rawAmount: amount,
        normalizedAmount: amount,
        netUserAmount: amount * 0.97,
        payitFeeAmount: amount * 0.03,
        currency,
        senderName: 'Dev Test Deposit',
        reference: `dev_seed_${txId}`,
        txId,
      }),
      createdAt: new Date(),
    });

    return reply.send({
      success: true,
      message: `Seeded ${currency} ${amount.toLocaleString()} deposit into ledger`,
      txId,
      entityId,
      newBalance: amount,
    });
  });
}
