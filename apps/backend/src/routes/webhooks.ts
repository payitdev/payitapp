import { FastifyInstance } from 'fastify';
import { createDbClient, eq, or } from '@payit/db';
import { auditLogs, entities, invoices, rawWebhooks, ledgerAccounts, ledgerEntries } from '@payit/db/schema';
import { normalizeNuvionNgnAmount, NuvionClient, ParticleClient } from '@payit/integrations';
import { ulid } from 'ulid';
import crypto from 'crypto';
import { env } from '../env.js';

const db = createDbClient();
const nuvion = new NuvionClient();
const particle = new ParticleClient();

function timingSafeCheck(receivedSignature?: string, expectedSignature?: string): boolean {
  if (!receivedSignature || !expectedSignature) return false;
  const a = Buffer.from(receivedSignature, 'utf-8');
  const b = Buffer.from(expectedSignature, 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function webhookRoutes(server: FastifyInstance) {

  /**
   * Nuvion Entity Status & Deposit Webhook Handler.
   * Enforces timing-safe HMAC-SHA256 signature verification against NUVION_WEBHOOK_SECRET.
   * Handles NGN deposits with automatic Kobo-to-Naira normalization.
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
      amount?: number | string;
      currency?: string;
      unit?: string;
      reference?: string;
      senderName?: string;
    };

    const confirmedName = payload.verified_legal_name || payload.legal_name;

    const eventId = (request.headers['x-nuvion-event-id'] || request.headers['x-event-id'] || ulid()) as string;

    // Edge Case #2 Protection: Check if event_id has already been processed
    const existingWebhook = await db
      .select()
      .from(rawWebhooks)
      .where(eq(rawWebhooks.eventId, eventId))
      .limit(1);

    if (existingWebhook.length > 0 && existingWebhook[0].status === 'PROCESSED') {
      server.log.info({ eventId }, 'Duplicate Nuvion webhook event ignored (Idempotent OK)');
      return reply.status(200).send({ received: true, duplicate: true, status: 'already_processed' });
    }

    // Journal raw webhook to raw_webhooks table
    if (existingWebhook.length === 0) {
      await db.insert(rawWebhooks).values({
        id: ulid(),
        provider: 'NUVION',
        eventId,
        payload: rawBody,
        status: 'RECEIVED',
        createdAt: new Date(),
      });
    }

    // Return HTTP 200 immediately (<15ms SLA guarantee)
    reply.status(200).send({
      received: true,
      eventId,
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

        // Handle Incoming NGN & Fiat Deposit/Credit Webhooks with Kobo Normalization
        const isCreditEvent = ['deposit', 'credit', 'payment_received', 'account_credited'].includes((payload.eventType || '').toLowerCase());
        if (isCreditEvent && payload.amount && (payload.entityId || payload.nuvionEntityId)) {
          const rawAmt = payload.amount;
          const currency = payload.currency || 'NGN';
          const normalizedAmount = normalizeNuvionNgnAmount(rawAmt, currency, payload.unit);

          server.log.info({
            eventType: payload.eventType,
            rawAmt,
            normalizedAmount,
            currency,
            reference: payload.reference,
          }, 'Incoming Nuvion deposit normalized from Kobo/minor units to standard Naira');

          const p = payload as any;
          const targetEntityId = p.entityId || p.nuvionEntityId || p.entity_id;
          let ent = targetEntityId
            ? await db.select().from(entities).where(or(eq(entities.id, targetEntityId), eq(entities.nuvionEntityId, targetEntityId))).limit(1)
            : [];

          if (ent.length === 0) {
            server.log.error({ targetEntityId, eventId }, 'Nuvion deposit webhook target entity not found. Quarantining event.');
            await db.update(rawWebhooks).set({ status: 'FAILED' }).where(eq(rawWebhooks.eventId, eventId));
            return;
          }

          if (ent.length > 0) {
            const userEntity = ent[0];
            const payitFeeAmount = normalizedAmount * 0.03;
            const netUserAmount = normalizedAmount * 0.97;
            const treasuryWallet = env.PAYIT_TREASURY_FEE_WALLET;

            // 1. Log Deposit in Audit Trail
            await db.insert(auditLogs).values({
              id: ulid(),
              userId: userEntity.userId,
              entityId: userEntity.id,
              action: 'NUVION_DEPOSIT_CREDITED',
              metadata: JSON.stringify({
                rawAmount: rawAmt,
                normalizedAmount,
                netUserAmount,
                payitFeeAmount,
                currency,
                unit: p.unit,
                senderName: p.senderName || p.sender_name || 'Bank Transfer',
                reference: p.reference || p.unique_reference || `nuv_dep_${Date.now()}`,
              }),
              createdAt: new Date(),
            });

            // 1b. Record double-entry ledger entries for deposit
            const txId = ulid();
            const ledgerAccId = `${userEntity.id}_cash`;
            const ledgerClearId = `${userEntity.id}_inbound`;

            const existingLedgerAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
            if (existingLedgerAcc.length === 0) {
              await db.insert(ledgerAccounts).values([
                { id: ledgerAccId, entityId: userEntity.id, name: 'Cash / Wallet', type: 'ASSET', currency, createdAt: new Date() },
                { id: ledgerClearId, entityId: userEntity.id, name: 'Inbound Deposit Clearing', type: 'LIABILITY', currency, createdAt: new Date() },
              ]);
            }

            await db.insert(ledgerEntries).values([
              { id: ulid(), entityId: userEntity.id, transactionId: txId, ledgerAccountId: ledgerClearId, type: 'DEBIT', amount: String(normalizedAmount), createdAt: new Date() },
              { id: ulid(), entityId: userEntity.id, transactionId: txId, ledgerAccountId: ledgerAccId, type: 'CREDIT', amount: String(normalizedAmount), createdAt: new Date() },
            ]);

            // 2. Execute on-chain / Nuvion Treasury Fee Sweep (H11)
            const feeSweep = nuvion.sweepFeeToTreasury({
              feeAmountUsd: payitFeeAmount,
              feeAmountLocal: payitFeeAmount,
              currency: currency as any,
              feeType: 'ON_RAMP_FX',
              sourceTransactionId: txId,
            });

            // 3. Particle Network Universal Account On-Ramp Auto-Sweep (Net Amount)
            const particleAcc = await particle.getOrCreateUniversalAccount(userEntity.id, userEntity.kind as 'PERSONAL' | 'BUSINESS');
            const particleAddr = particleAcc.walletAddress;

            // Execute real transfer to user's Particle Universal Account on Polygon (chainId 137)
            const sweepResult = await particle.executeGaslessTransfer({
              senderEntityId: userEntity.id,
              senderKind: userEntity.kind as 'PERSONAL' | 'BUSINESS',
              recipientAddress: particleAddr,
              amount: String(netUserAmount),
              asset: 'USDC',
              chainId: 137,
            });

            await db.insert(auditLogs).values({
              id: ulid(),
              userId: userEntity.userId,
              entityId: userEntity.id,
              action: 'PARTICLE_SWEEP_EXECUTED',
              metadata: JSON.stringify({
                particleNetworkAddress: particleAddr,
                txHash: sweepResult.transactionId,
                onRampAmountNgn: netUserAmount,
                grossAmountNgn: normalizedAmount,
                feeAmountNgn: payitFeeAmount,
                currency,
                feeSweepId: feeSweep.sweepId,
                treasuryWallet,
                status: 'SWEPT_TO_PARTICLE_UNIVERSAL_ACCOUNT',
                timestamp: new Date().toISOString(),
              }),
              createdAt: new Date(),
            });

            server.log.info({
              entityId: userEntity.id,
              particleAddress: particleAddr,
              txHash: sweepResult.transactionId,
              grossAmount: normalizedAmount,
              netAmount: netUserAmount,
              payitFeeSwept: payitFeeAmount,
              sweepId: feeSweep.sweepId,
              treasuryWallet,
            }, 'On-ramp deposit processed: 3% swept to PayIT Treasury, 97% swept to Particle Universal Account on-chain');
          }
        }

        await db
          .update(rawWebhooks)
          .set({ status: 'PROCESSED' })
          .where(eq(rawWebhooks.eventId, eventId));
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
