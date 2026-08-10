import { FastifyInstance } from 'fastify';
import { createDbClient, eq, or } from '@payit/db';
import { auditLogs, entities, accounts, invoices, rawWebhooks, ledgerAccounts, ledgerEntries } from '@payit/db/schema';
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

export async function onEntityApproved(dbClient: any, localEntityId: string, nuvionEntityId: string, kind: 'PERSONAL' | 'BUSINESS', legalName?: string) {
  const existingAccounts = await dbClient
    .select()
    .from(accounts)
    .where(eq(accounts.entityId, localEntityId));

  const targetCurrencies: ('NGN' | 'USD')[] = kind === 'BUSINESS' ? ['USD', 'NGN'] : ['NGN'];

  for (const currency of targetCurrencies) {
    const hasCurr = existingAccounts.some((a: any) => a.currency === currency);
    if (!hasCurr) {
      try {
        const created = await nuvion.createVirtualAccountForEntity({
          entityId: nuvionEntityId,
          currency,
          displayName: legalName || `${kind} ${currency} Account`,
        });

        const accId = ulid();
        await dbClient.insert(accounts).values({
          id: accId,
          entityId: localEntityId,
          nuvionAccountId: created.nuvionAccountId,
          accountNumber: created.accountNumber,
          bankName: created.bankName,
          accountHolderName: created.accountHolderName,
          currency: created.currency,
          status: created.status,
          createdAt: new Date(),
        });
      } catch (err: any) {
        console.error(`[onEntityApproved] Failed to open virtual account for entity ${localEntityId} (${currency}):`, err.message);
      }
    }
  }
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

        // Defensive parsing for entities.updated / entity status events
        const targetNuvionEntityId = payload.nuvionEntityId || payload.entityId || (payload as any).entity_id || (payload as any).data?.id || (payload as any).id;
        const newStatus = payload.status || (payload as any).data?.status;

        if (targetNuvionEntityId && newStatus) {
          const entityRows = await db
            .select()
            .from(entities)
            .where(eq(entities.nuvionEntityId, targetNuvionEntityId))
            .limit(1);

          if (entityRows.length > 0) {
            const currentEntity = entityRows[0];
            const updatedTier = payload.tier || (currentEntity.kind === 'BUSINESS' ? 2 : 1);

            await db
              .update(entities)
              .set({
                nuvionStatus: newStatus,
                nuvionTier: updatedTier,
                ...(confirmedName ? { legalName: confirmedName } : {}),
              })
              .where(eq(entities.nuvionEntityId, targetNuvionEntityId));

            server.log.info({
              nuvionEntityId: targetNuvionEntityId,
              newStatus,
              confirmedName,
              reason: payload.reason,
            }, 'Entity status updated from Nuvion webhook');

            // Step 10: Trigger account creation when status reaches "approved"
            if (newStatus === 'approved') {
              await onEntityApproved(db, currentEntity.id, targetNuvionEntityId, currentEntity.kind as 'PERSONAL' | 'BUSINESS', confirmedName || currentEntity.legalName);
            }
          }
        }

        // Dispatch for account_details.created & account_details.updated events
        const eventType = (payload.eventType || (payload as any).type || (payload as any).event_type || '').toLowerCase();
        if (eventType === 'account_details.created' || eventType === 'account_details.updated') {
          const detailData = (payload as any).data || payload;
          const detailStatus = detailData.status || 'active';
          const accId = detailData.account_id || detailData.accountId;
          const accNum = detailData.account_number || detailData.iban || detailData.sort_code;
          const bankName = detailData.issuer?.name || detailData.bank_name;

          if (accId && detailStatus === 'active' && accNum) {
            await db
              .update(accounts)
              .set({
                accountNumber: String(accNum),
                ...(bankName ? { bankName: String(bankName) } : {}),
                status: 'active',
              })
              .where(eq(accounts.nuvionAccountId, String(accId)));
            server.log.info({ accId, accNum, bankName }, 'Updated stored accountNumber and bankName from account_details webhook event');
          }
        }

        // Dispatch for outflows.completed & outflows.failed events
        if (eventType.startsWith('outflows.')) {
          const payoutId = (payload as any).data?.id || (payload as any).id || (payload as any).payout_id;
          const payoutStatus = eventType.split('.')[1] || 'processing';
          if (payoutId) {
            await db.insert(auditLogs).values({
              id: ulid(),
              userId: 'system_webhook',
              entityId: (payload as any).entity_id || 'system',
              action: `NUVION_OUTFLOW_${payoutStatus.toUpperCase()}`,
              metadata: JSON.stringify({ payoutId, status: payoutStatus, rawPayload: payload }),
              createdAt: new Date(),
            });
            server.log.info({ payoutId, status: payoutStatus }, 'Updated payout outflow record status from Nuvion webhook');
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
            const currUpper = (currency || 'NGN').toUpperCase();
            const ledgerAccId = `${userEntity.id}_cash_${currUpper}`;
            const ledgerClearId = `${userEntity.id}_inbound_${currUpper}`;

            const existingLedgerAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
            if (existingLedgerAcc.length === 0) {
              await db.insert(ledgerAccounts).values([
                { id: ledgerAccId, entityId: userEntity.id, name: `Cash / Wallet (${currUpper})`, type: 'ASSET', currency: currUpper, createdAt: new Date() },
                { id: ledgerClearId, entityId: userEntity.id, name: `Inbound Deposit Clearing (${currUpper})`, type: 'LIABILITY', currency: currUpper, createdAt: new Date() },
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
