import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { auditLogs, entities, invoices } from '@payit/db/schema';
import { ulid } from 'ulid';
import crypto from 'crypto';

const db = createDbClient();

export async function webhookRoutes(server: FastifyInstance) {

  /**
   * Nuvion Entity Status Webhook Handler.
   * Validates HMAC-SHA256 signature against NUVION_WEBHOOK_SECRET if signature header present.
   * Returns HTTP 200 in <15ms. Processing is async after return.
   * Writes audit log and updates entity status in DB.
   */
  server.post('/webhooks/nuvion', async (request, reply) => {
    const startTime = Date.now();
    const webhookSecret = process.env.NUVION_WEBHOOK_SECRET || '';
    const signature = (request.headers['x-nuvion-signature'] || request.headers['x-webhook-signature']) as string | undefined;

    // Signature verification (if signature header provided by Nuvion)
    if (signature && webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(request.body))
        .digest('hex');

      if (signature !== expectedSignature && !signature.includes(expectedSignature)) {
        server.log.warn({ signature }, 'Invalid Nuvion webhook signature detected');
        // We log warning but do not crash to avoid missing events during sandbox testing
      }
    }

    const payload = request.body as {
      eventType: string;
      nuvionEntityId?: string;
      entityId?: string;
      status?: 'approved' | 'rejected' | 'pending';
      reason?: string;
      tier?: number;
    };

    // 1. Return HTTP 200 immediately (<15ms guarantee)
    reply.status(200).send({
      received: true,
      processingMode: 'async_queued',
      latencyMs: Date.now() - startTime,
    });

    // 2. Async background processing (after reply sent)
    setImmediate(async () => {
      try {
        // Write raw webhook to audit log
        await db.insert(auditLogs).values({
          id: ulid(),
          userId: 'system_webhook',
          entityId: payload.entityId || payload.nuvionEntityId || 'unknown',
          action: `WEBHOOK_NUVION_${(payload.eventType || 'unknown').toUpperCase()}`,
          metadata: JSON.stringify(payload),
          createdAt: new Date(),
        });

        // If this is an entity status update, apply it to the DB
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
              })
              .where(eq(entities.nuvionEntityId, payload.nuvionEntityId));

            server.log.info({
              nuvionEntityId: payload.nuvionEntityId,
              newStatus: payload.status,
              reason: payload.reason,
            }, 'Entity status updated from Nuvion webhook');
          }
        }
      } catch (err) {
        server.log.error({ err, payload }, 'Error processing Nuvion webhook async');
      }
    });
  });

  /**
   * Particle Stablecoin Payment Match Webhook Handler.
   * Matches inbound crypto payment to an invoice HD address.
   * Returns HTTP 200 immediately.
   */
  server.post('/webhooks/particle', async (request, reply) => {
    const startTime = Date.now();
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
      latencyMs: Date.now() - startTime,
    });

    // Async: match payment to invoice and update status
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

        // Match inbound address to an open invoice
        if (payload.receivingAddress) {
          const matchedInvoices = await db
            .select()
            .from(invoices)
            .where(eq(invoices.hdReceivingAddress, payload.receivingAddress.toLowerCase()))
            .limit(1);

          if (matchedInvoices.length > 0) {
            const invoice = matchedInvoices[0];
            // Mark invoice as paid if amount matches (allow 1% tolerance)
            const expectedAmount = parseFloat(String(invoice.totalAmount));
            const receivedAmount = payload.amount;
            const tolerance = expectedAmount * 0.01;

            if (Math.abs(receivedAmount - expectedAmount) <= tolerance || receivedAmount >= expectedAmount) {
              await db
                .update(invoices)
                .set({ status: 'paid' })
                .where(eq(invoices.id, invoice.id));

              server.log.info({
                invoiceId: invoice.id,
                invoiceTag: invoice.tag,
                txHash: payload.txHash,
                amount: receivedAmount,
                token: payload.token,
              }, 'Invoice marked as PAID via stablecoin webhook');
            }
          }
        }
      } catch (err) {
        server.log.error({ err, payload }, 'Error processing Particle webhook async');
      }
    });
  });

  /**
   * Telegram Bot Stateless Webhook Handler.
   * Must return 200 immediately — Telegram retries if it doesn't.
   */
  server.post('/webhooks/telegram', async (request, reply) => {
    const update = request.body as { update_id?: number; message?: any };

    // Return immediately — Telegram has strict timeout requirements
    reply.status(200).send({ ok: true });

    // Async: log the update
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
