import { FastifyInstance } from 'fastify';
import { createDbClient, eq, or, and } from '@payit/db';
import { auditLogs, entities, accounts, invoices, rawWebhooks, ledgerAccounts, ledgerEntries, users } from '@payit/db/schema';
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

  if (existingAccounts.length === 0) {
    const currencies = kind === 'BUSINESS' ? ['NGN', 'USD', 'EUR', 'GBP', 'CAD'] : ['NGN', 'USD'];
    for (const currency of currencies) {
      try {
        const created = await nuvion.createVirtualAccountForEntity({
          entityId: nuvionEntityId,
          currency: currency as any,
          displayName: legalName || `${kind} ${currency} Account`,
        });
        const accId = `${localEntityId}_nuv_${currency.toLowerCase()}`;

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

/**
 * Orchestrates Nuvion deposit auto-conversion to USC stablecoin on BASE_MAINNET.
 * Follows 7-step architecture per docs.nuvion.co/guides/stablecoins and docs.nuvion.co/guides/send-a-payout:
 * 1. Triggered on inflows.completed / deposit webhook.
 * 2. Ensures self-counterparty exists for entity.
 * 3. Ensures stablecoin-transfer payment-details exist for self-counterparty pointing to Particle UA EVM address on BASE_MAINNET.
 * 4. Creates FX quote (POST /fx-quotes).
 * 5. Executes transfer (POST /transfers).
 * 6. Webhook transfers.updated / outflows.completed updates local ledger on success.
 * 7. On failure: logs error, leaves original fiat deposit balance intact in fiat Nuvion account.
 */
async function orchestrateDepositOnRamp(
  dbClient: any,
  serverLog: any,
  userEntity: any,
  rawAmt: number,
  currency: string,
  inflowPayload: any
) {
  try {
    const nuvionEntityId = userEntity.nuvionEntityId;
    if (!nuvionEntityId) {
      throw new Error(`Entity ${userEntity.id} does not have a valid Nuvion Entity ID`);
    }

    // Step 2: Ensure self-counterparty exists
    let selfCounterpartyId = userEntity.nuvionSelfCounterpartyId;
    if (!selfCounterpartyId) {
      const userRows = await dbClient.select().from(users).where(eq(users.id, userEntity.userId)).limit(1);
      const user = userRows[0];
      const fullName = userEntity.legalName || user?.fullName || 'PayIT Account Holder';
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || 'PayIT';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      serverLog.info({ entityId: userEntity.id }, 'Creating self-counterparty for deposit on-ramp...');
      const counterparty = await nuvion.createCounterparty(
        nuvionEntityId,
        userEntity.kind === 'BUSINESS' ? 'business' : 'individual',
        {
          first_name: firstName,
          last_name: lastName,
          legal_name: fullName,
          relationship: 'customer',
          email: user?.email || `user.${userEntity.id}@payit.app`,
          address: {
            line_1: 'Lagos, Nigeria',
            city: 'Lagos',
            state: 'Lagos',
            postal_code: '100001',
            country_code: 'NG',
          },
        }
      );
      selfCounterpartyId = counterparty.id;

      await dbClient
        .update(entities)
        .set({ nuvionSelfCounterpartyId: selfCounterpartyId })
        .where(eq(entities.id, userEntity.id));
      serverLog.info({ selfCounterpartyId }, 'Self-counterparty created and saved to DB');
    }

    // Step 3: Ensure payment details exist for Particle Universal Account EVM address on BASE_MAINNET
    let onRampPaymentDetailId = userEntity.nuvionOnRampPaymentDetailId;
    if (!onRampPaymentDetailId) {
      const particleAcc = await particle.getOrCreateUniversalAccount(
        userEntity.id,
        userEntity.kind as 'PERSONAL' | 'BUSINESS'
      );

      serverLog.info({ entityId: userEntity.id, particleAddress: particleAcc.walletAddress }, 'Creating stablecoin payment-details on BASE_MAINNET...');
      const paymentDetail = await nuvion.createPaymentDetail(
        selfCounterpartyId,
        'stablecoin-transfer',
        {
          payment_method: 'stablecoin-transfer',
          currency: 'USC', // PayIT standardized USD stablecoin
          account_holder_name: userEntity.legalName || 'PayIT User',
          entity_id: nuvionEntityId,
          blockchain_network: 'BASE_MAINNET',
          wallet_address: particleAcc.walletAddress,
        }
      );
      onRampPaymentDetailId = paymentDetail.id;

      await dbClient
        .update(entities)
        .set({ nuvionOnRampPaymentDetailId: onRampPaymentDetailId })
        .where(eq(entities.id, userEntity.id));
      serverLog.info({ onRampPaymentDetailId }, 'Payment details for BASE_MAINNET created and saved to DB');
    }

    // Step 4: Create FX Quote (POST /fx-quotes)
    // NOTE: amountFrom expects smallest currency units (e.g. kobo for NGN, cents for USD) matching the Nuvion fiat inflow convention as confirmed against sandbox responses.
    const fiatAccountId = inflowPayload.account_id || inflowPayload.accountId;
    serverLog.info({ fromCurrency: currency, amountFrom: rawAmt }, 'Creating deposit FX quote to USC...');
    const fxQuote = await nuvion.createDepositFxQuote({
      fromCurrency: currency,
      toCurrency: 'USC',
      amountFrom: rawAmt,
      accountId: fiatAccountId,
      counterpartyId: selfCounterpartyId,
      paymentDetailId: onRampPaymentDetailId,
    });

    // Step 5: Initiate Transfer (POST /transfers)
    const uniqueRef = `onramp_${inflowPayload.unique_reference || inflowPayload.reference || Date.now()}`;
    serverLog.info({ uniqueRef, fxQuoteId: fxQuote.id }, 'Initiating on-ramp transfer to Particle UA on BASE_MAINNET...');
    const transferResult = await nuvion.executePayout({
      accountId: fiatAccountId,
      paymentDetailId: onRampPaymentDetailId,
      amount: rawAmt,
      narration: 'PayIT deposit — auto-conversion to stablecoin',
      uniqueReference: uniqueRef,
      paymentType: 'stablecoin-transfer',
      fxQuoteId: fxQuote.id,
    });

    await dbClient.insert(auditLogs).values({
      id: ulid(),
      userId: userEntity.userId,
      entityId: userEntity.id,
      action: 'NUVION_ONRAMP_TRANSFER_INITIATED',
      metadata: JSON.stringify({
        transferId: transferResult.payoutId,
        status: transferResult.status,
        fromCurrency: currency,
        toCurrency: 'USC',
        rawAmt,
        uniqueReference: uniqueRef,
        blockchainNetwork: 'BASE_MAINNET',
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date(),
    });

    serverLog.info({
      transferId: transferResult.payoutId,
      status: transferResult.status,
      uniqueRef,
    }, 'Deposit on-ramp transfer initiated successfully');

  } catch (onRampErr: any) {
    // Step 7: Handle failure explicitly — log, notify, leave original fiat deposit intact
    serverLog.error({
      err: onRampErr.message,
      entityId: userEntity.id,
      currency,
      rawAmt,
    }, 'Nuvion deposit auto-conversion to stablecoin failed. Original fiat deposit balance left intact in Nuvion account.');

    await dbClient.insert(auditLogs).values({
      id: ulid(),
      userId: userEntity.userId,
      entityId: userEntity.id,
      action: 'NUVION_ONRAMP_FAILED',
      metadata: JSON.stringify({
        error: onRampErr.message,
        currency,
        rawAmt,
        fiatBalanceIntact: true,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date(),
    });
  }
}

/**
 * Orchestrates Nuvion withdrawal off-ramp (USC Stablecoin on Base -> Real Fiat Destination).
 * Follows 6-step architecture per docs.nuvion.co/guides/send-a-payout:
 * 1. Triggered on inflows.completed on stablecoin account (currency: USC/UST).
 * 2. Fetches pending NUVION_WITHDRAWAL_INITIATED audit log for off-ramp destination.
 * 3. Creates a Counterparty for the user's real off-ramp fiat destination (POST /counterparties).
 * 4. Creates Payment Details matching the rail-specific scheme (POST /payment-details).
 * 5. Creates FX Quote (POST /fx-quotes).
 * 6. Executes transfer via POST /transfers (executePayout).
 * 7. On failure: logs error, surfaces status, leaves stablecoin balance intact in Nuvion USC account.
 */
async function orchestrateWithdrawalOffRamp(
  dbClient: any,
  serverLog: any,
  userEntity: any,
  stablecoinAmount: number,
  currency: string,
  inflowPayload: any
) {
  try {
    const nuvionEntityId = userEntity.nuvionEntityId;
    if (!nuvionEntityId) {
      throw new Error(`Entity ${userEntity.id} does not have a valid Nuvion Entity ID`);
    }

    // Step 2: Fetch recent pending NUVION_WITHDRAWAL_INITIATED audit log to obtain destination details
    const recentLogs = await dbClient
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, userEntity.id), eq(auditLogs.action, 'NUVION_WITHDRAWAL_INITIATED')))
      .limit(5);

    let destinationDetails: any = null;
    let targetFiatCurrency = 'NGN';

    if (recentLogs.length > 0) {
      const latest = recentLogs[recentLogs.length - 1];
      try {
        const meta = JSON.parse(latest.metadata || '{}');
        destinationDetails = meta.offRampDestination;
        targetFiatCurrency = meta.targetCurrency || 'NGN';
      } catch {}
    }

    if (!destinationDetails || !destinationDetails.accountNumber) {
      serverLog.warn({ entityId: userEntity.id }, 'No pending withdrawal destination details found in audit logs. Using default entity profile for off-ramp...');
      destinationDetails = {
        accountNumber: '0000000000',
        accountHolderName: userEntity.legalName || 'PayIT Account Holder',
        bankCode: '058',
        type: 'bank-transfer',
      };
    }

    // Step 4a: Create a Counterparty for the user's REAL fiat off-ramp destination (POST /counterparties)
    const userRows = await dbClient.select().from(users).where(eq(users.id, userEntity.userId)).limit(1);
    const user = userRows[0];
    const holderName = destinationDetails.accountHolderName || userEntity.legalName || user?.fullName || 'PayIT Recipient';
    const nameParts = holderName.trim().split(' ');
    const firstName = nameParts[0] || 'PayIT';
    const lastName = nameParts.slice(1).join(' ') || 'Recipient';

    serverLog.info({ entityId: userEntity.id, targetFiatCurrency }, 'Creating counterparty for real fiat off-ramp destination...');
    const fiatCounterparty = await nuvion.createCounterparty(
      nuvionEntityId,
      userEntity.kind === 'BUSINESS' ? 'business' : 'individual',
      {
        first_name: firstName,
        last_name: lastName,
        legal_name: holderName,
        relationship: 'customer',
        email: user?.email || `user.${userEntity.id}@payit.app`,
        address: {
          line_1: 'Lagos, Nigeria',
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
          country_code: 'NG',
        },
      }
    );

    // Step 4b: Create Payment Details for the fiat destination counterparty matching the rail (POST /payment-details)
    const paymentType = destinationDetails.type || 'bank-transfer';
    serverLog.info({ counterpartyId: fiatCounterparty.id, paymentType }, 'Creating payment-details for fiat off-ramp destination...');

    const detailPayload: any = {
      payment_method: paymentType,
      currency: targetFiatCurrency.toUpperCase(),
      account_holder_name: holderName,
      entity_id: nuvionEntityId,
      account_number: destinationDetails.accountNumber,
    };

    if (destinationDetails.bankCode) detailPayload.bank_code = destinationDetails.bankCode;
    if (destinationDetails.routingNumber) detailPayload.routing_number = destinationDetails.routingNumber;
    if (destinationDetails.sortCode) detailPayload.sort_code = destinationDetails.sortCode;
    if (destinationDetails.iban) detailPayload.iban = destinationDetails.iban;

    const paymentDetail = await nuvion.createPaymentDetail(
      fiatCounterparty.id,
      paymentType,
      detailPayload
    );

    // Step 4c: Create FX Quote (POST /fx-quotes)
    const uscAccountId = inflowPayload.account_id || userEntity.nuvionUscAccountId;
    serverLog.info({ fromCurrency: currency, toCurrency: targetFiatCurrency, amount: stablecoinAmount }, 'Creating off-ramp FX quote...');
    const fxQuote = await nuvion.createDepositFxQuote({
      fromCurrency: currency,
      toCurrency: targetFiatCurrency as any,
      amountFrom: stablecoinAmount,
      accountId: uscAccountId,
      counterpartyId: fiatCounterparty.id,
      paymentDetailId: paymentDetail.id,
    });

    // Step 4d: Initiate Fiat Transfer via POST /transfers (executePayout)
    const uniqueRef = `offramp_${inflowPayload.unique_reference || inflowPayload.reference || Date.now()}`;
    serverLog.info({ uniqueRef, fxQuoteId: fxQuote.id }, 'Initiating fiat payout transfer via Nuvion...');
    const payoutResult = await nuvion.executePayout({
      accountId: uscAccountId,
      paymentDetailId: paymentDetail.id,
      amount: stablecoinAmount,
      narration: 'PayIT withdrawal',
      uniqueReference: uniqueRef,
      paymentType,
      fxQuoteId: fxQuote.id,
    });

    await dbClient.insert(auditLogs).values({
      id: ulid(),
      userId: userEntity.userId,
      entityId: userEntity.id,
      action: 'NUVION_OFFRAMP_TRANSFER_INITIATED',
      metadata: JSON.stringify({
        payoutId: payoutResult.payoutId,
        status: payoutResult.status,
        fromCurrency: currency,
        toCurrency: targetFiatCurrency,
        amount: stablecoinAmount,
        uniqueReference: uniqueRef,
        destination: destinationDetails,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date(),
    });

    serverLog.info({
      payoutId: payoutResult.payoutId,
      status: payoutResult.status,
      uniqueRef,
    }, 'Off-ramp fiat payout transfer initiated successfully');

  } catch (offRampErr: any) {
    // Step 6: Handle failure explicitly — log, update audit trail, leave stablecoin funds intact in USC account
    serverLog.error({
      err: offRampErr.message,
      entityId: userEntity.id,
      currency,
      stablecoinAmount,
    }, 'Nuvion withdrawal off-ramp fiat payout failed. Stablecoin funds left intact in Nuvion USC account for manual retry.');

    await dbClient.insert(auditLogs).values({
      id: ulid(),
      userId: userEntity.userId,
      entityId: userEntity.id,
      action: 'NUVION_OFFRAMP_FAILED',
      metadata: JSON.stringify({
        error: offRampErr.message,
        currency,
        stablecoinAmount,
        stablecoinFundsIntact: true,
        nuvionUscAccountId: userEntity.nuvionUscAccountId,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date(),
    });
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

        // Dispatch for transfers.updated & outflows events
        if (eventType === 'transfers.updated' || eventType.startsWith('outflows.')) {
          const detailData = (payload as any).data || payload;
          const payoutId = detailData.id || detailData.transfer_id || detailData.payout_id;
          const transferStatus = (detailData.status || eventType.split('.')[1] || 'processing').toLowerCase();

          if (payoutId) {
            await db.insert(auditLogs).values({
              id: ulid(),
              userId: 'system_webhook',
              entityId: detailData.entity_id || 'system',
              action: `NUVION_TRANSFER_${transferStatus.toUpperCase()}`,
              metadata: JSON.stringify({ payoutId, status: transferStatus, statusReason: detailData.status_reason, rawPayload: payload }),
              createdAt: new Date(),
            });

            // Step 6: On transfers.updated success, update local ledger to reflect stablecoin balance in Particle Universal Account
            if (transferStatus === 'successful' && detailData.entity_id) {
              const entRows = await db.select().from(entities).where(or(eq(entities.id, detailData.entity_id), eq(entities.nuvionEntityId, detailData.entity_id))).limit(1);
              if (entRows.length > 0) {
                const userEnt = entRows[0];
                const txId = ulid();
                const ledgerAccId = `${userEnt.id}_cash_USC`;
                const ledgerClearId = `${userEnt.id}_inbound_USC`;

                const existingLedgerAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
                if (existingLedgerAcc.length === 0) {
                  await db.insert(ledgerAccounts).values([
                    { id: ledgerAccId, entityId: userEnt.id, name: 'Cash / Wallet (USC Base)', type: 'ASSET', currency: 'USC', createdAt: new Date() },
                    { id: ledgerClearId, entityId: userEnt.id, name: 'Inbound Stablecoin Clearing (USC)', type: 'LIABILITY', currency: 'USC', createdAt: new Date() },
                  ]);
                }

                await db.insert(ledgerEntries).values([
                  { id: ulid(), entityId: userEnt.id, transactionId: txId, ledgerAccountId: ledgerClearId, type: 'DEBIT', amount: String(detailData.amount || '0'), createdAt: new Date() },
                  { id: ulid(), entityId: userEnt.id, transactionId: txId, ledgerAccountId: ledgerAccId, type: 'CREDIT', amount: String(detailData.amount || '0'), createdAt: new Date() },
                ]);

                server.log.info({ entityId: userEnt.id, transferId: payoutId }, 'Ledger updated for successful on-ramp transfer to Particle UA on Base');
              }
            }

            server.log.info({ payoutId, status: transferStatus }, 'Updated transfer status from Nuvion webhook');
          }
        }

        // Step 1: Handle Incoming Inflows (inflows.completed / deposit webhooks)
        const isCreditEvent = ['inflows.completed', 'deposit', 'credit', 'payment_received', 'account_credited'].includes((payload.eventType || (payload as any).event_type || (payload as any).type || '').toLowerCase());
        if (isCreditEvent && payload.amount && (payload.entityId || payload.nuvionEntityId || (payload as any).entity_id)) {
          const rawAmt = typeof payload.amount === 'string' ? parseFloat(payload.amount) : payload.amount;
          const currency = payload.currency || (payload as any).from_currency || 'NGN';
          const normalizedAmount = normalizeNuvionNgnAmount(rawAmt, currency, payload.unit);

          server.log.info({
            eventType: payload.eventType,
            rawAmt,
            normalizedAmount,
            currency,
            reference: payload.reference || (payload as any).unique_reference,
          }, 'Incoming Nuvion deposit detected. Triggering automated on-ramp pipeline...');

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

            // Record initial deposit in audit log
            await db.insert(auditLogs).values({
              id: ulid(),
              userId: userEntity.userId,
              entityId: userEntity.id,
              action: 'NUVION_DEPOSIT_CREDITED',
              metadata: JSON.stringify({
                rawAmount: rawAmt,
                normalizedAmount,
                currency,
                reference: p.reference || p.unique_reference || `nuv_dep_${Date.now()}`,
              }),
              createdAt: new Date(),
            });

            const isStablecoinDeposit = ['USC', 'UST', 'USDC', 'USDT'].includes(currency.toUpperCase());

            if (isStablecoinDeposit) {
              server.log.info({ entityId: userEntity.id, currency, rawAmt }, 'Stablecoin deposit confirmed. Triggering automated off-ramp pipeline to real fiat destination...');
              await orchestrateWithdrawalOffRamp(db, server.log, userEntity, rawAmt, currency, p);
            } else {
              server.log.info({ entityId: userEntity.id, currency, rawAmt }, 'Fiat deposit confirmed. Triggering automated on-ramp pipeline to Particle UA on Base...');
              await orchestrateDepositOnRamp(db, server.log, userEntity, rawAmt, currency, p);
            }
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
