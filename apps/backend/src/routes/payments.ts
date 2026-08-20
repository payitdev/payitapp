import { FastifyInstance } from 'fastify';
import { createDbClient, eq, sql } from '@payit/db';
import { entities, contacts } from '@payit/db/schema';
import { ulid } from 'ulid';

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

const paymentRequestStore = new Map<string, StoredPaymentRequest>();

export async function paymentRoutes(server: FastifyInstance) {

  /**
   * List Inbound and Outbound Payment Requests
   */
  server.get('/api/payments/requests', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    const username = entityRows[0]?.username?.toLowerCase();

    const allRequests = Array.from(paymentRequestStore.values());

    // Inbound: where this entity is the payer
    const inbound = allRequests.filter(r =>
      r.payerEntityId === entityId || (username && r.payerUsername?.toLowerCase() === username)
    );

    // Outbound: where this entity is the requester
    const outbound = allRequests.filter(r => r.requesterEntityId === entityId);

    // Mutual contacts check
    const contactList = await db.select().from(contacts).where(eq(contacts.entityId, entityId));
    const contactEntityIds = new Set(contactList.map(c => c.targetEntityId).filter(Boolean));

    const formatRequest = async (req: StoredPaymentRequest) => {
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

    const newReq: StoredPaymentRequest = {
      id: requestId,
      requesterEntityId: entityId,
      payerEntityId: payer?.id,
      payerUsername: payer?.username || clean,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      narration: narration || 'Payment Request',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    paymentRequestStore.set(requestId, newReq);

    return reply.send({
      success: true,
      requestId,
      message: 'Payment request sent successfully',
      request: newReq,
    });
  });

  /**
   * Fulfill / Pay a Payment Request
   */
  server.post('/api/payments/fulfill', async (request, reply) => {
    const { entityId, requestId } = request.body as { entityId: string; requestId: string };
    if (!requestId) return reply.status(400).send({ error: 'requestId is required' });

    const req = paymentRequestStore.get(requestId);
    if (req) {
      req.status = 'PAID';
      paymentRequestStore.set(requestId, req);
    }

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

    const req = paymentRequestStore.get(requestId);
    if (req) {
      req.status = 'DECLINED';
      paymentRequestStore.set(requestId, req);
    }

    return reply.send({
      success: true,
      requestId,
      status: 'DECLINED',
      message: 'Payment request declined.',
    });
  });
}
