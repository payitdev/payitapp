import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { auditLogs, entities, invoices } from '@payit/db/schema';
import { ulid } from 'ulid';
import crypto from 'crypto';
import { env } from '../env.js';

const db = createDbClient();

function timingSafeCheck(receivedSignature?: string, expectedSignature?: string): boolean {
  if (!receivedSignature || !expectedSignature) return false;
  const a = Buffer.from(receivedSignature, 'utf-8');
  const b = Buffer.from(expectedSignature, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function webhookRoutes(server: FastifyInstance) {

  /**
   * Nuvion Entity Status Webhook Handler.
   * Enforces timing-safe HMAC-SHA256 signature verification against NUVION_WEBHOOK_SECRET.
   * Rejects HTTP 401 if signature is missing or invalid.
   */
  server.post('/webhooks/nuvion', async (request, reply) => {
    const webhookSecret = env.NUVION_WEBHOOK_SECRET;
    const signature = (request.headers['x-nuvion-signature'] || request.headers['x-webhook-signature']) as string | undefined;

    const rawBody = JSON.stringify(request.body || {});
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!signature || !timingSafeCheck(signature, expectedSignature)) {
      server.log.warn({ signature }, 'Unauthorized Nuvion webhook signature rejection');
      return reply.status(401).send({ error: 'Invalid or missing webhook signature' });
    }

    const payload = request.body as {
      eventType: string;
      nuvionEntityId?: string;
      entityId?: string;
      status?: 'approved' | 'rejected' | 'pending';
      reason?: string;
      legal_name?: string;
      verified_legal_name?: string;
      tier?: number;
    };

    const confirmedName = payload.verified_legal_name || payload.legal_name;

    // Return HTTP 200 immediately (<15ms SLA guarantee)
    reply.status(200).send({
      received: true,
      processingMode: 'async_queued',
    });

    // Async background processing after reply
    setImmediate(async () => {
      try {
        await db.insert(auditLogs).values({
          id: ulid(),
          userId: 'system_webhook',
          entityId: payload.entityId || payload.nuvionEntityId || 'unknown',
          action: `WEBHOOK_NUVION_${(payload.eventType || 'unknown').toUpperCase()}`,
          metadata: JSON.stringify(payload),
          createdAt: new Date(),
        });

        if (payload.nuvionEntityId && payload.status) {
          const entityRows = await db
            .select()
            .from(entities)
            .where(eq(entities.nuvionEntityId, payload.nuvionEntityId))
            .limit(1);

          if (entityRows.length > 0) {
            await db
              .update(entities)
              .set({
                nuvionStatus: payload.status,
                ...(payload.tier ? { nuvionTier: payload.tier } : {}),
                ...(confirmedName ? { legalName: confirmedName } : {}),
              })
              .where(eq(entities.nuvionEntityId, payload.nuvionEntityId));

            server.log.info({
              nuvionEntityId: payload.nuvionEntityId,
              newStatus: payload.status,
              confirmedName,
              reason: payload.reason,
            }, 'Entity status and verified name updated from Nuvion webhook');
          }
        }
      } catch (err) {
        server.log.error({ err, payload }, 'Error processing Nuvion webhook async');
      }
    });
  });

  /**
   * Particle Stablecoin Payment Webhook Handler.
   * Enforces timing-safe HMAC signature verification with PARTICLE_SERVER_KEY.
   * Rejects HTTP 401 if missing or invalid.
   */
  server.post('/webhooks/particle', async (request, reply) => {
    const signature = request.headers['x-particle-signature'] as string | undefined;
    const rawBody = JSON.stringify(request.body || {});
    const expectedSignature = crypto
      .createHmac('sha256', env.PARTICLE_SERVER_KEY)
      .update(rawBody)
      .digest('hex');

    if (!signature || !timingSafeCheck(signature, expectedSignature)) {
      server.log.warn({ signature }, 'Unauthorized Particle webhook signature rejection');
      return reply.status(401).send({ error: 'Invalid or missing Particle webhook signature' });
    }

    const payload = request.body as {
      txHash: string;
      receivingAddress: string;
      amount: number;
      token: 'USDC' | 'USDT';
      chainId?: number;
      confirmedAt?: string;
    };

    reply.status(200).send({
      received: true,
      processingMode: 'async_queued',
    });

    setImmediate(async () => {
      try {
        await db.insert(auditLogs).values({
          id: ulid(),
          userId: 'system_webhook',
          entityId: 'stablecoin_payment',
          action: 'WEBHOOK_PARTICLE_PAYMENT_RECEIVED',
          metadata: JSON.stringify(payload),
          createdAt: new Date(),
        });

        if (payload.receivingAddress) {
          const targetAddress = payload.receivingAddress.toLowerCase();
          const matchedInvoices = await db
            .select()
            .from(invoices)
            .where(eq(invoices.hdReceivingAddress, targetAddress))
            .limit(1);

          if (matchedInvoices.length > 0) {
            const invoice = matchedInvoices[0];
            const expectedAmount = parseFloat(String(invoice.totalAmount));
            const receivedAmount = payload.amount;
            const tolerance = expectedAmount * 0.01;

            let newStatus: 'pending' | 'paid' | 'partially_paid' | 'overpaid' | 'overdue' | 'cancelled' = 'paid';
            if (receivedAmount < (expectedAmount - tolerance)) {
              newStatus = 'partially_paid';
            } else if (receivedAmount > (expectedAmount + tolerance)) {
              newStatus = 'overpaid';
            }

            await db
              .update(invoices)
              .set({ status: newStatus })
              .where(eq(invoices.id, invoice.id));

            server.log.info({
              invoiceId: invoice.id,
              status: newStatus,
              txHash: payload.txHash,
              receivedAmount,
              expectedAmount,
            }, 'Invoice payment status updated via verified Particle webhook');
          }
        }
      } catch (err) {
        server.log.error({ err, payload }, 'Error processing Particle webhook async');
      }
    });
  });

  /**
   * Telegram Bot Webhook Handler.
   */
  server.post('/webhooks/telegram', async (request, reply) => {
    const update = request.body as { update_id?: number; message?: any };
    reply.status(200).send({ ok: true });

    if (update.update_id) {
      setImmediate(async () => {
        try {
          await db.insert(auditLogs).values({
            id: ulid(),
            userId: String(update.message?.from?.id || 'telegram_bot'),
            entityId: 'telegram_channel',
            action: 'WEBHOOK_TELEGRAM_UPDATE',
            metadata: JSON.stringify({ updateId: update.update_id, chatId: update.message?.chat?.id }),
            createdAt: new Date(),
          });
        } catch (err) {
          server.log.error({ err }, 'Error logging Telegram webhook');
        }
      });
    }
  });
}
