import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, or, sql } from '@payit/db';
import { entities, contacts, paymentRequests, transfers, ledgerAccounts, ledgerEntries } from '@payit/db/schema';
import { ulid } from 'ulid';
import { getEntityBalance } from '../utils/balance.js';

const db = createDbClient();

interface StoredPaymentRequest {
  id: string;
  requesterEntityId: string;
  payerEntityId?: string;
  payerUsername?: string;
  amount: number;
  currency: string;
  narration?: string;
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'EXPIRED';
  createdAt: string;
}

export async function paymentRoutes(server: FastifyInstance) {

  /**
   * List Inbound and Outbound Payment Requests
   */
  server.get('/api/payments/requests', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    const username = entityRows[0]?.username?.toLowerCase();

    const inbound = await db.select().from(paymentRequests).where(or(eq(paymentRequests.payerEntityId, entityId), and(sql`LOWER(${paymentRequests.payerUsername}) = ${username || ''}`, eq(paymentRequests.status, 'PENDING'))));
    const outbound = await db.select().from(paymentRequests).where(eq(paymentRequests.requesterEntityId, entityId));

    // Mutual contacts check
    const contactList = await db.select().from(contacts).where(eq(contacts.entityId, entityId));
    const contactEntityIds = new Set(contactList.map(c => c.targetEntityId).filter(Boolean));

    const formatRequest = async (req: any) => {
      const requesterRows = await db.select().from(entities).where(eq(entities.id, req.requesterEntityId)).limit(1);
      const requester = requesterRows[0];
      const isMutualContact = contactEntityIds.has(req.requesterEntityId);

      return {
        id: req.id,
        amount: String(req.amount),
        currency: req.currency,
        narration: req.narration,
        status: req.status,
        createdAt: req.createdAt,
        requester: {
          entityId: req.requesterEntityId,
          legalName: requester?.legalName || 'Proxim User',
          username: requester?.username || 'user',
        },
        requesterUsername: requester?.username || 'user',
        isMutualContact,
      };
    };

    const formattedInbound = await Promise.all(inbound.map(formatRequest));
    const formattedOutbound = await Promise.all(outbound.map(formatRequest));

    const trusted = formattedInbound.filter(r => r.isMutualContact || r.status === 'PENDING');
    const strangers = formattedInbound.filter(r => !r.isMutualContact && r.status === 'PENDING');

    return reply.send({
      success: true,
      requests: formattedInbound, // for App.tsx top-level list
      inbound: {
        trusted,
        strangers,
      },
      outbound: formattedOutbound,
    });
  });

  /**
   * Create New Payment Request
   */
  server.post('/api/payments/request', async (request, reply) => {
    const { entityId, payerUsernameOrId, amount, currency = 'NGN', narration } = request.body as {
      entityId: string;
      payerUsernameOrId: string;
      amount: number;
      currency?: string;
      narration?: string;
    };

    if (!entityId || !payerUsernameOrId || !amount) {
      return reply.status(400).send({ error: 'entityId, payerUsernameOrId, and amount are required' });
    }

    const clean = payerUsernameOrId.replace(/^@/, '').toLowerCase().trim();
    const payerRows = await db
      .select()
      .from(entities)
      .where(sql`LOWER(${entities.username}) = LOWER(${clean}) OR ${entities.id} = ${payerUsernameOrId}`)
      .limit(1);

    const payer = payerRows[0];
    const requestId = ulid();

    await db.insert(paymentRequests).values({
      id: requestId, requesterEntityId: entityId, payerEntityId: payer?.id,
      payerUsername: payer?.username || clean, amount: Number(amount).toFixed(4),
      currency: currency.toUpperCase(), narration: narration || 'Payment Request', status: 'PENDING',
    });

    return reply.send({
      success: true,
      requestId,
      message: 'Payment request sent successfully',
      request: { id: requestId, requesterEntityId: entityId, payerEntityId: payer?.id, amount, currency: currency.toUpperCase(), narration: narration || 'Payment Request', status: 'PENDING' },
    });
  });

  /**
   * Fulfill / Pay a Payment Request
   */
  server.post('/api/payments/fulfill', async (request, reply) => {
    const { entityId, requestId } = request.body as { entityId: string; requestId: string };
    if (!requestId) return reply.status(400).send({ error: 'requestId is required' });

    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    const reqRows = await db.select().from(paymentRequests).where(eq(paymentRequests.id, requestId)).limit(1);
    const req = reqRows[0];
    if (!req || req.status !== 'PENDING') return reply.status(409).send({ error: 'Payment request is unavailable' });
    if (req.payerEntityId && req.payerEntityId !== entityId) return reply.status(403).send({ error: 'Payment request is assigned to another entity' });
    const normalizedCurrency = req.currency.toUpperCase();
    const amount = Number(req.amount);
    if (await getEntityBalance(db, entityId, normalizedCurrency, 'cash') < amount) return reply.status(409).send({ error: 'Insufficient available balance' });
    const transferId = ulid();
    const sourceCash = `${entityId}_cash_${normalizedCurrency}`;
    const sourceClearing = `${entityId}_outbound_${normalizedCurrency}`;
    const targetCash = `${req.requesterEntityId}_cash_${normalizedCurrency}`;
    const targetClearing = `${req.requesterEntityId}_inbound_${normalizedCurrency}`;
    const existingAccounts = await db.select().from(ledgerAccounts).where(sql`${ledgerAccounts.id} IN (${sourceCash}, ${sourceClearing}, ${targetCash}, ${targetClearing})`);
    const existingIds = new Set(existingAccounts.map(account => account.id));
    const missingAccounts = [
      { id: sourceCash, entityId, name: `Available ${normalizedCurrency}`, type: 'ASSET' as const, currency: normalizedCurrency },
      { id: sourceClearing, entityId, name: `Outbound Clearing ${normalizedCurrency}`, type: 'LIABILITY' as const, currency: normalizedCurrency },
      { id: targetCash, entityId: req.requesterEntityId, name: `Available ${normalizedCurrency}`, type: 'ASSET' as const, currency: normalizedCurrency },
      { id: targetClearing, entityId: req.requesterEntityId, name: `Inbound Clearing ${normalizedCurrency}`, type: 'LIABILITY' as const, currency: normalizedCurrency },
    ].filter(account => !existingIds.has(account.id));
    if (missingAccounts.length) await db.insert(ledgerAccounts).values(missingAccounts);
    await db.insert(transfers).values({ id: transferId, entityId, dueTransferId: transferId, sourceCurrency: normalizedCurrency, targetCurrency: normalizedCurrency, sourceAmount: amount.toFixed(4), targetAmount: amount.toFixed(4), feeAmount: '0.0000', direction: 'DEBIT', settlementStatus: 'LEDGER_CREDITED', status: 'completed' });
    await db.insert(ledgerEntries).values([
      { id: ulid(), entityId, transactionId: `${transferId}_OUT`, ledgerAccountId: sourceCash, type: 'CREDIT', amount: amount.toFixed(4) },
      { id: ulid(), entityId, transactionId: `${transferId}_OUT`, ledgerAccountId: sourceClearing, type: 'DEBIT', amount: amount.toFixed(4) },
      { id: ulid(), entityId: req.requesterEntityId, transactionId: `${transferId}_IN`, ledgerAccountId: targetClearing, type: 'CREDIT', amount: amount.toFixed(4) },
      { id: ulid(), entityId: req.requesterEntityId, transactionId: `${transferId}_IN`, ledgerAccountId: targetCash, type: 'DEBIT', amount: amount.toFixed(4) },
    ]);
    await db.update(paymentRequests).set({ status: 'PAID', paidAt: new Date() }).where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, 'PENDING')));

    return reply.send({
      success: true,
      requestId,
      status: 'PAID',
      message: 'Payment completed.',
    });
  });

  /**
   * Decline a Payment Request
   */
  server.post('/api/payments/decline', async (request, reply) => {
    const { entityId, requestId } = request.body as { entityId: string; requestId: string };
    if (!requestId) return reply.status(400).send({ error: 'requestId is required' });

    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    const reqRows = await db.select().from(paymentRequests).where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.requesterEntityId, entityId))).limit(1);
    if (reqRows.length === 0) return reply.status(404).send({ error: 'Payment request not found' });
    await db.update(paymentRequests).set({ status: 'DECLINED' }).where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, 'PENDING')));

    return reply.send({
      success: true,
      requestId,
      status: 'DECLINED',
      message: 'Payment request declined.',
    });
  });
}
