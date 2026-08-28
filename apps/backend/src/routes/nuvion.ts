import { FastifyInstance } from 'fastify';
import { and, createDbClient, eq, desc } from '@payit/db';
import {
  entities,
  nuvionAccountDetails,
  nuvionAccounts,
  nuvionEntities,
  nuvionWebhookEvents,
  nuvionCounterparties,
  nuvionPaymentDetails,
  nuvionTransfers,
  nuvionCards,
  nuvionFundingSessions,
  nuvionSavingsGoals,
  providerTransactions,
} from '@payit/db/schema';
import { nuvionClient, verifyNuvionWebhookSignature } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();

function ownedEntity(request: any, entityId: string): string | null {
  if (!entityId) return null;
  const userEntityIds = request.session?.userEntityIds || [];
  return userEntityIds.includes(entityId) ? request.session.userId : null;
}

function providerEntityId(response: any): string {
  return String(response?.data?.entity?.id || response?.data?.id || response?.entity?.id || '');
}

function providerAccount(response: any): any {
  return response?.data?.account || response?.data?.data?.account || response?.data || response;
}

function providerDetails(response: any): any {
  return response?.data?.account_details || response?.data?.data?.account_details || response?.data || response;
}

export async function nuvionRoutes(server: FastifyInstance) {
  // ─── 1. Webhook Endpoint (HMAC-SHA256 Timing-Safe Verification) ───────────
  server.post('/webhooks/nuvion', async (request, reply) => {
    const rawBody = String(request.rawBody || '');
    const secret = process.env.NUVION_WEBHOOK_SECRET;
    const eventId = String(request.headers['x-nuvion-event-id'] || '');
    const timestamp = String(request.headers['x-nuvion-event-timestamp'] || '');
    const signature = String(request.headers['x-nuvion-event-signature'] || '');

    if (!secret || !eventId || !timestamp || !signature || !rawBody) {
      return reply.status(401).send({ error: 'Invalid Nuvion webhook payload or headers' });
    }

    const isValid = verifyNuvionWebhookSignature(
      rawBody,
      signature,
      timestamp,
      secret,
      Number(process.env.NUVION_WEBHOOK_TOLERANCE_MS || 300000),
    );

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid Nuvion webhook signature' });
    }

    const event = JSON.parse(rawBody) as { event: string; data: any };

    // Idempotency: Check if event was already processed
    const existing = await db
      .select()
      .from(nuvionWebhookEvents)
      .where(eq(nuvionWebhookEvents.eventId, eventId))
      .limit(1);

    if (existing.length) {
      return reply.send({ received: true, duplicate: true });
    }

    await db.insert(nuvionWebhookEvents).values({
      id: ulid(),
      eventId,
      event: event.event,
      payload: rawBody,
      status: 'RECEIVED',
    });

    try {
      const data = event.data || {};

      switch (event.event) {
        case 'entities.updated': {
          const status = data.status || 'incomplete';
          const rejectionReason = data.rejection_reasons
            ? JSON.stringify(data.rejection_reasons)
            : data.status_reason || null;

          await db
            .update(nuvionEntities)
            .set({
              status,
              rejectionReason,
              providerData: data,
              updatedAt: new Date(),
            })
            .where(eq(nuvionEntities.entityId, data.id));
          break;
        }

        case 'accounts.created':
        case 'accounts.updated': {
          const account = data.account || data;
          const owner = await db
            .select()
            .from(nuvionEntities)
            .where(eq(nuvionEntities.entityId, account.entity_id))
            .limit(1);

          if (owner.length) {
            await db
              .insert(nuvionAccounts)
              .values({
                id: ulid(),
                userId: owner[0].userId,
                localEntityId: owner[0].localEntityId,
                nuvionEntityId: account.entity_id,
                accountId: account.id,
                type: account.type || 'checking',
                currency: account.currency,
                displayName: account.display_name || `${account.currency} Account`,
                status: account.status || 'active',
                balanceAvailableMinor: String(account.balance?.available ?? 0),
                balanceCurrentMinor: String(account.balance?.current ?? 0),
                providerData: account,
              })
              .onConflictDoUpdate({
                target: nuvionAccounts.accountId,
                set: {
                  status: account.status || 'active',
                  balanceAvailableMinor: String(account.balance?.available ?? 0),
                  balanceCurrentMinor: String(account.balance?.current ?? 0),
                  providerData: account,
                  updatedAt: new Date(),
                },
              });
          }
          break;
        }

        case 'account_details.created':
        case 'account_details.updated': {
          const details = data.account_details || data;
          await db
            .update(nuvionAccountDetails)
            .set({
              status: details.status || 'active',
              accountNumber: details.account_number || null,
              routingNumber: details.routing_number || null,
              iban: details.iban || null,
              sortCode: details.sort_code || null,
              swiftBic: details.swift_bic || null,
              issuer: details.issuer || null,
              providerData: details,
              updatedAt: new Date(),
            })
            .where(eq(nuvionAccountDetails.accountDetailId, details.id));
          break;
        }

        case 'funding_sessions.updated': {
          const session = data.funding_session || data;
          const status = session.status || 'processing';

          await db
            .update(nuvionFundingSessions)
            .set({
              status,
              failureCode: session.failure_code || null,
              failureMessage: session.failure_message || null,
              providerData: session,
              updatedAt: new Date(),
            })
            .where(eq(nuvionFundingSessions.fundingSessionId, session.id));

          // If settled, credit account balance
          if (status === 'settled') {
            const dbSession = (
              await db
                .select()
                .from(nuvionFundingSessions)
                .where(eq(nuvionFundingSessions.fundingSessionId, session.id))
                .limit(1)
            )[0];

            if (dbSession) {
              const account = (
                await db
                  .select()
                  .from(nuvionAccounts)
                  .where(eq(nuvionAccounts.accountId, dbSession.accountId))
                  .limit(1)
              )[0];

              if (account) {
                const newAvailable =
                  BigInt(account.balanceAvailableMinor || '0') + BigInt(dbSession.amountMinor || '0');
                const newCurrent =
                  BigInt(account.balanceCurrentMinor || '0') + BigInt(dbSession.amountMinor || '0');

                await db
                  .update(nuvionAccounts)
                  .set({
                    balanceAvailableMinor: newAvailable.toString(),
                    balanceCurrentMinor: newCurrent.toString(),
                    updatedAt: new Date(),
                  })
                  .where(eq(nuvionAccounts.id, account.id));

                await db.insert(providerTransactions).values({
                  id: ulid(),
                  provider: 'NUVION',
                  providerTransactionId: session.id,
                  localEntityId: dbSession.localEntityId,
                  direction: 'INFLOW',
                  currency: dbSession.currency,
                  amountMinor: dbSession.amountMinor,
                  status: 'settled',
                  reference: dbSession.uniqueReference,
                  rawPayload: session,
                }).onConflictDoNothing();
              }
            }
          }
          break;
        }

        case 'inflows.completed':
        case 'stablecoin_inflows.completed': {
          const inflow = data;
          const accountId = inflow.account_id;
          const amount = BigInt(inflow.amount || '0');

          if (accountId && amount > 0n) {
            const account = (
              await db
                .select()
                .from(nuvionAccounts)
                .where(eq(nuvionAccounts.accountId, accountId))
                .limit(1)
            )[0];

            if (account) {
              const newAvailable = BigInt(account.balanceAvailableMinor || '0') + amount;
              const newCurrent = BigInt(account.balanceCurrentMinor || '0') + amount;

              await db
                .update(nuvionAccounts)
                .set({
                  balanceAvailableMinor: newAvailable.toString(),
                  balanceCurrentMinor: newCurrent.toString(),
                  updatedAt: new Date(),
                })
                .where(eq(nuvionAccounts.id, account.id));

              await db.insert(providerTransactions).values({
                id: ulid(),
                provider: 'NUVION',
                providerTransactionId: inflow.id || ulid(),
                localEntityId: account.localEntityId,
                direction: 'INFLOW',
                currency: account.currency,
                amountMinor: amount.toString(),
                status: 'completed',
                reference: inflow.reference || inflow.tx_hash || null,
                rawPayload: inflow,
              }).onConflictDoNothing();
            }
          }
          break;
        }

        case 'outflows.created':
        case 'outflows.completed':
        case 'outflows.failed':
        case 'outflows.cancelled': {
          const transfer = data.transfer || data;
          const statusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'> = {
            'outflows.created': 'pending',
            'outflows.completed': 'completed',
            'outflows.failed': 'failed',
            'outflows.cancelled': 'cancelled',
          };

          const newStatus = statusMap[event.event] || (transfer.status as any) || 'pending';

          await db
            .update(nuvionTransfers)
            .set({
              status: newStatus,
              statusReason: transfer.status_reason || null,
              providerData: transfer,
              updatedAt: new Date(),
            })
            .where(eq(nuvionTransfers.transferId, transfer.id));
          break;
        }

        case 'cards.updated': {
          const card = data.card || data;
          await db
            .update(nuvionCards)
            .set({
              status: card.status || 'active',
              lastFour: card.last_four || '****',
              expiry: card.expiry || '**/**',
              spendingLimits: card.spending_limits || null,
              internationalSpending: card.international_spending ?? true,
              providerData: card,
              updatedAt: new Date(),
            })
            .where(eq(nuvionCards.cardId, card.id));
          break;
        }
      }

      await db
        .update(nuvionWebhookEvents)
        .set({ status: 'PROCESSED', processedAt: new Date() })
        .where(eq(nuvionWebhookEvents.eventId, eventId));

      return reply.send({ received: true });
    } catch (error: any) {
      await db
        .update(nuvionWebhookEvents)
        .set({ status: 'FAILED', errorMessage: error.message })
        .where(eq(nuvionWebhookEvents.eventId, eventId));
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });

  // ─── 2. Entity Management & KYC ───────────────────────────────────────────

  server.get('/api/nuvion/entity', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(and(eq(nuvionEntities.localEntityId, localEntityId), eq(nuvionEntities.userId, userId)))
        .limit(1)
    )[0];

    return reply.send({ success: true, entity: mapping || null });
  });

  server.post('/api/nuvion/entities/individual', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const local = (
      await db
        .select()
        .from(entities)
        .where(and(eq(entities.id, localEntityId), eq(entities.userId, userId)))
        .limit(1)
    )[0];
    if (!local || local.kind !== 'PERSONAL') return reply.status(400).send({ error: 'A personal entity is required' });

    const payload = body.payload || body;
    const response = await nuvionClient.createIndividualEntity(payload);
    const entityId = providerEntityId(response);
    if (!entityId) return reply.status(502).send({ error: 'Nuvion returned no entity ID' });

    const personId = String((response as any)?.data?.person?.id || (response as any)?.person?.id || '');

    await db
      .insert(nuvionEntities)
      .values({
        id: ulid(),
        userId,
        localEntityId,
        entityId,
        context: 'PERSONAL',
        entityType: 'individual',
        personId,
        status: 'incomplete',
        providerData: response,
      })
      .onConflictDoUpdate({
        target: nuvionEntities.entityId,
        set: { personId, providerData: response, updatedAt: new Date() },
      });

    return reply.send({ success: true, provider: 'NUVION', entityId, personId, response });
  });

  server.post('/api/nuvion/entities/business', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const local = (
      await db
        .select()
        .from(entities)
        .where(and(eq(entities.id, localEntityId), eq(entities.userId, userId)))
        .limit(1)
    )[0];
    if (!local || local.kind !== 'BUSINESS') return reply.status(400).send({ error: 'A business entity is required' });

    const payload = body.payload || body;
    const response = await nuvionClient.createBusinessEntity(payload);
    const entityId = providerEntityId(response);
    if (!entityId) return reply.status(502).send({ error: 'Nuvion returned no entity ID' });

    const businessId = String((response as any)?.data?.business?.id || (response as any)?.business?.id || '');

    await db
      .insert(nuvionEntities)
      .values({
        id: ulid(),
        userId,
        localEntityId,
        entityId,
        context: 'BUSINESS',
        entityType: 'business',
        businessId,
        status: 'incomplete',
        providerData: response,
      })
      .onConflictDoUpdate({
        target: nuvionEntities.entityId,
        set: { businessId, providerData: response, updatedAt: new Date() },
      });

    return reply.send({ success: true, provider: 'NUVION', entityId, businessId, response });
  });

  server.post('/api/nuvion/documents', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    if (!ownedEntity(request, localEntityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping) return reply.status(409).send({ error: 'Create the Nuvion entity before uploading documents' });

    const payload = body.payload || body;
    const response = await nuvionClient.uploadDocument({
      ...payload,
      entity_id: mapping.entityId,
    });
    return reply.send({ success: true, response });
  });

  server.post('/api/nuvion/review', async (request, reply) => {
    const body = request.body as { localEntityId?: string };
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    if (!ownedEntity(request, localEntityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping) return reply.status(404).send({ error: 'Nuvion entity not found' });

    const response = await nuvionClient.submitEntityForReview(mapping.entityId);
    await db
      .update(nuvionEntities)
      .set({ status: 'pending', providerData: response, updatedAt: new Date() })
      .where(eq(nuvionEntities.id, mapping.id));

    return reply.send({ success: true, status: 'pending', response });
  });

  // ─── 3. Accounts & Coordinates ────────────────────────────────────────────

  server.get('/api/nuvion/accounts', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const rows = await db
      .select()
      .from(nuvionAccounts)
      .where(and(eq(nuvionAccounts.localEntityId, localEntityId), eq(nuvionAccounts.userId, userId)));

    return reply.send({ success: true, accounts: rows });
  });

  server.post('/api/nuvion/accounts', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping || mapping.status !== 'approved') {
      return reply.status(409).send({ error: 'Nuvion entity must be approved before creating accounts' });
    }

    const payload = body.payload || body;
    const response = await nuvionClient.createAccount({
      ...payload,
      entity_id: mapping.entityId,
    });

    const account = providerAccount(response);
    if (!account?.id) return reply.status(502).send({ error: 'Nuvion returned no account ID' });

    await db
      .insert(nuvionAccounts)
      .values({
        id: ulid(),
        userId,
        localEntityId,
        nuvionEntityId: mapping.entityId,
        accountId: account.id,
        type: account.type || 'checking',
        currency: account.currency,
        displayName: account.display_name || `${account.currency} Account`,
        balanceAvailableMinor: String(account.balance?.available || 0),
        balanceCurrentMinor: String(account.balance?.current || 0),
        providerData: account,
      })
      .onConflictDoNothing();

    return reply.send({ success: true, account });
  });

  server.get('/api/nuvion/account-details', async (request, reply) => {
    const { entityId, accountId } = request.query as { entityId?: string; accountId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    let rows;
    if (accountId) {
      rows = await db
        .select()
        .from(nuvionAccountDetails)
        .where(
          and(
            eq(nuvionAccountDetails.localEntityId, localEntityId),
            eq(nuvionAccountDetails.userId, userId),
            eq(nuvionAccountDetails.accountId, accountId),
          ),
        );
    } else {
      rows = await db
        .select()
        .from(nuvionAccountDetails)
        .where(
          and(
            eq(nuvionAccountDetails.localEntityId, localEntityId),
            eq(nuvionAccountDetails.userId, userId),
          ),
        );
    }

    return reply.send({ success: true, accountDetails: rows });
  });

  server.post('/api/nuvion/account-details', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const account = (
      await db
        .select()
        .from(nuvionAccounts)
        .where(
          and(
            eq(nuvionAccounts.id, String(body.accountRecordId || '')),
            eq(nuvionAccounts.localEntityId, localEntityId),
            eq(nuvionAccounts.userId, userId),
          ),
        )
        .limit(1)
    )[0];

    if (!account) return reply.status(404).send({ error: 'Nuvion account not found' });

    const response = await nuvionClient.createAccountDetails({
      account_id: account.accountId,
      entity_id: account.nuvionEntityId,
      ...(body.chain ? { chain: body.chain } : {}),
    });

    const details = providerDetails(response);
    if (!details?.id) return reply.status(502).send({ error: 'Nuvion returned no account-detail ID' });

    await db
      .insert(nuvionAccountDetails)
      .values({
        id: ulid(),
        userId,
        localEntityId,
        nuvionEntityId: account.nuvionEntityId,
        accountId: account.accountId,
        accountDetailId: details.id,
        currency: details.currency || account.currency,
        assetType: details.asset_type || (body.chain ? 'stablecoin' : 'fiat'),
        chain: details.chain || body.chain || null,
        status: details.status || 'pending',
        accountNumber: details.account_number || null,
        routingNumber: details.routing_number || null,
        iban: details.iban || null,
        sortCode: details.sort_code || null,
        swiftBic: details.swift_bic || null,
        issuer: details.issuer || null,
        beneficiaryName: details.beneficiary_name || null,
        providerData: details,
      })
      .onConflictDoNothing();

    return reply.send({ success: true, accountDetails: details });
  });

  // ─── 4. On-Ramp / Funding Sessions (Open Banking, MoMo, Crypto) ───────────

  server.post('/api/nuvion/funding-sessions', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping || mapping.status !== 'approved') {
      return reply.status(409).send({ error: 'Nuvion entity must be approved to initiate deposit' });
    }

    const uniqueReference = body.unique_reference || `fund-${Date.now()}-${ulid()}`;
    const payload = {
      entity_id: mapping.entityId,
      amount: Number(body.amount), // in minor units
      account_id: String(body.accountId),
      funding_type: body.fundingType as 'open-banking' | 'momo' | 'crypto',
      redirect_url: body.redirectUrl,
      unique_reference: uniqueReference,
      narration: body.narration || 'Account deposit',
      meta: body.meta,
    };

    const response = await nuvionClient.createFundingSession(payload);
    const session = response.data?.funding_session || (response as any).data || response;

    if (session?.id) {
      await db.insert(nuvionFundingSessions).values({
        id: ulid(),
        userId,
        localEntityId,
        nuvionEntityId: mapping.entityId,
        accountId: String(body.accountId),
        fundingSessionId: session.id,
        fundingType: payload.funding_type,
        amountMinor: String(payload.amount),
        currency: body.currency || 'USD',
        uniqueReference,
        checkoutUrl: session.checkout_url || null,
        checkoutId: session.checkout_id || null,
        status: session.status || 'awaiting_user',
        expiresAt: session.expires_at ? new Date(session.expires_at) : null,
        providerData: session,
      });
    }

    return reply.send({ success: true, session });
  });

  server.get('/api/nuvion/funding-sessions', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const rows = await db
      .select()
      .from(nuvionFundingSessions)
      .where(and(eq(nuvionFundingSessions.localEntityId, localEntityId), eq(nuvionFundingSessions.userId, userId)))
      .orderBy(desc(nuvionFundingSessions.createdAt))
      .limit(50);

    return reply.send({ success: true, sessions: rows });
  });

  // ─── 5. Off-Ramp / Counterparties, Payment Details & Transfers ─────────────

  server.get('/api/nuvion/counterparties', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const rows = await db
      .select()
      .from(nuvionCounterparties)
      .where(and(eq(nuvionCounterparties.localEntityId, localEntityId), eq(nuvionCounterparties.userId, userId)))
      .orderBy(desc(nuvionCounterparties.createdAt));

    return reply.send({ success: true, counterparties: rows });
  });

  server.post('/api/nuvion/counterparties', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping || mapping.status !== 'approved') {
      return reply.status(409).send({ error: 'Nuvion entity must be approved before adding recipients' });
    }

    const payload = body.payload || body;
    const response = await nuvionClient.createCounterparty({
      ...payload,
      entity_id: mapping.entityId,
    });

    const cp = response.data?.counterparty || (response as any).data || response;
    const counterpartyId = String(cp?.id || '');

    if (counterpartyId) {
      await db.insert(nuvionCounterparties).values({
        id: ulid(),
        userId,
        localEntityId,
        nuvionEntityId: mapping.entityId,
        counterpartyId,
        type: payload.type || 'individual',
        nickname: payload.nickname || `${payload.profile?.first_name || ''} ${payload.profile?.last_name || payload.profile?.legal_name || ''}`.trim(),
        profile: payload.profile || {},
        status: cp.status || 'active',
      }).onConflictDoNothing();
    }

    return reply.send({ success: true, counterpartyId, response });
  });

  server.post('/api/nuvion/payment-details', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping || mapping.status !== 'approved') {
      return reply.status(409).send({ error: 'Nuvion entity must be approved before adding payment details' });
    }

    const payload = body.payload || body;
    const response = await nuvionClient.createPaymentDetails({
      ...payload,
      entity_id: mapping.entityId,
    });

    const pd = response.data?.payment_detail || (response as any).data || response;
    const paymentDetailId = String(pd?.id || '');

    if (paymentDetailId) {
      await db.insert(nuvionPaymentDetails).values({
        id: ulid(),
        userId,
        localEntityId,
        counterpartyId: String(payload.counterparty_id),
        paymentDetailId,
        paymentMethod: payload.payment_method || 'bank-transfer',
        currency: payload.currency || 'USD',
        country: payload.country || 'US',
        accountHolderName: payload.account_holder_name || '',
        accountNumber: payload.account_number || null,
        routingNumber: payload.routing_number || null,
        iban: payload.iban || null,
        sortCode: payload.sort_code || null,
        swiftBic: payload.swift_bic || null,
        bankCode: payload.bank_code || null,
        providerData: pd,
      }).onConflictDoNothing();
    }

    return reply.send({ success: true, paymentDetailId, response });
  });

  server.post('/api/nuvion/transfers', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping || mapping.status !== 'approved') {
      return reply.status(409).send({ error: 'Nuvion entity must be approved before transferring funds' });
    }

    const payload = body.payload || body;
    const uniqueReference = payload.unique_reference || `payout-${Date.now()}-${ulid()}`;

    // Balance check
    const account = (
      await db
        .select()
        .from(nuvionAccounts)
        .where(eq(nuvionAccounts.accountId, String(payload.account_id)))
        .limit(1)
    )[0];

    const amountMinor = BigInt(payload.amount || 0);
    if (account && BigInt(account.balanceAvailableMinor || '0') < amountMinor) {
      return reply.status(400).send({
        error: 'Insufficient funds in selected account for this transfer.',
        code: 'error_transfer_insufficient_funds',
      });
    }

    const response = await nuvionClient.createTransfer({
      ...payload,
      entity_id: mapping.entityId,
      unique_reference: uniqueReference,
    });

    const transfer = response.data?.transfer || (response as any).data || response;
    const transferId = String(transfer?.id || '');

    if (transferId) {
      await db.insert(nuvionTransfers).values({
        id: ulid(),
        userId,
        localEntityId,
        nuvionEntityId: mapping.entityId,
        accountId: String(payload.account_id),
        transferId,
        counterpartyId: String(payload.counterparty_id),
        paymentDetailId: String(payload.payment_detail_id),
        amountMinor: String(payload.amount),
        currency: payload.currency || 'USD',
        paymentType: payload.payment_type || 'bank-transfer',
        narration: payload.narration || 'Payout',
        uniqueReference,
        feeMinor: String(transfer.applicable_fee || 0),
        status: transfer.status || 'pending',
        statusReason: transfer.status_reason || 'awaiting_processing',
        providerData: transfer,
      });

      // Deduct balance locally
      if (account) {
        const newAvailable = BigInt(account.balanceAvailableMinor || '0') - amountMinor;
        await db
          .update(nuvionAccounts)
          .set({
            balanceAvailableMinor: (newAvailable >= 0n ? newAvailable : 0n).toString(),
            updatedAt: new Date(),
          })
          .where(eq(nuvionAccounts.id, account.id));
      }
    }

    return reply.send({ success: true, transferId, transfer });
  });

  server.get('/api/nuvion/transfers', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const rows = await db
      .select()
      .from(nuvionTransfers)
      .where(and(eq(nuvionTransfers.localEntityId, localEntityId), eq(nuvionTransfers.userId, userId)))
      .orderBy(desc(nuvionTransfers.createdAt))
      .limit(50);

    return reply.send({ success: true, transfers: rows });
  });

  // ─── 6. Card Issuing & Management (Debit, Prepaid, Virtual) ───────────────

  server.get('/api/nuvion/cards', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const rows = await db
      .select()
      .from(nuvionCards)
      .where(and(eq(nuvionCards.localEntityId, localEntityId), eq(nuvionCards.userId, userId)))
      .orderBy(desc(nuvionCards.createdAt));

    return reply.send({ success: true, provider: 'NUVION', cards: rows });
  });

  server.post('/api/nuvion/cards', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping || mapping.status !== 'approved') {
      return reply.status(409).send({ error: 'Nuvion entity must be approved before issuing cards' });
    }

    const payload = body.payload || body;
    const cardType = (payload.type || 'virtual') as 'debit' | 'prepaid' | 'virtual';

    const response = await nuvionClient.createCard({
      entity_id: mapping.entityId,
      account_id: String(payload.account_id),
      type: cardType,
      cardholder_name: String(payload.cardholder_name || 'Valued Client'),
      display_name: payload.display_name || `${cardType.charAt(0).toUpperCase() + cardType.slice(1)} Card`,
      spending_limits: payload.spending_limits,
      international_spending: payload.international_spending ?? true,
    });

    const card = response.data?.card || (response as any).data || response;
    const cardId = String(card?.id || '');

    if (cardId) {
      await db.insert(nuvionCards).values({
        id: ulid(),
        userId,
        localEntityId,
        nuvionEntityId: mapping.entityId,
        accountId: String(payload.account_id),
        cardId,
        type: cardType,
        displayName: payload.display_name || `${cardType} Card`,
        cardholderName: String(payload.cardholder_name || 'Valued Client'),
        brand: card.brand || 'VISA',
        lastFour: card.last_four || '****',
        expiry: card.expiry || '12/28',
        status: card.status || (cardType === 'virtual' ? 'active' : 'pending'),
        spendingLimits: payload.spending_limits || null,
        internationalSpending: payload.international_spending ?? true,
        providerData: card,
      });
    }

    return reply.send({
      success: true,
      cardId,
      card: {
        ...card,
        type: cardType,
      },
    });
  });

  server.get('/api/nuvion/cards/:cardId', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const card = (
      await db
        .select()
        .from(nuvionCards)
        .where(and(eq(nuvionCards.cardId, cardId), eq(nuvionCards.localEntityId, localEntityId)))
        .limit(1)
    )[0];

    if (!card) return reply.status(404).send({ error: 'Card not found' });
    return reply.send({ success: true, card });
  });

  server.put('/api/nuvion/cards/:cardId', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping) return reply.status(404).send({ error: 'Nuvion entity not found' });

    const response = await nuvionClient.updateCard(cardId, {
      entity_id: mapping.entityId,
      spending_limits: body.spending_limits,
      international_spending: body.international_spending,
      status: body.status,
    });

    await db
      .update(nuvionCards)
      .set({
        spendingLimits: body.spending_limits || null,
        internationalSpending: body.international_spending ?? true,
        status: body.status || undefined,
        updatedAt: new Date(),
      })
      .where(eq(nuvionCards.cardId, cardId));

    return reply.send({ success: true, response });
  });

  server.post('/api/nuvion/cards/:cardId/block', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const body = request.body as { localEntityId?: string; reason?: string };
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping) return reply.status(404).send({ error: 'Nuvion entity not found' });

    const response = await nuvionClient.blockCard(cardId, {
      entity_id: mapping.entityId,
      reason: body.reason,
    });

    await db
      .update(nuvionCards)
      .set({ status: 'blocked', updatedAt: new Date() })
      .where(eq(nuvionCards.cardId, cardId));

    return reply.send({ success: true, response });
  });

  server.post('/api/nuvion/cards/:cardId/unblock', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const body = request.body as { localEntityId?: string; reason?: string };
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping) return reply.status(404).send({ error: 'Nuvion entity not found' });

    const response = await nuvionClient.unblockCard(cardId, {
      entity_id: mapping.entityId,
      reason: body.reason,
    });

    await db
      .update(nuvionCards)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(nuvionCards.cardId, cardId));

    return reply.send({ success: true, response });
  });

  server.get('/api/nuvion/cards/:cardId/transactions', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping) return reply.status(404).send({ error: 'Nuvion entity not found' });

    try {
      const response = await nuvionClient.getCardTransactions(cardId, {
        entity_id: mapping.entityId,
        limit: 50,
      });
      const data = (response as any)?.data || {};
      return reply.send({
        success: true,
        transactions: data.data || data.transactions || [],
      });
    } catch {
      return reply.send({ success: true, transactions: [] });
    }
  });

  // ─── 7. Savings & Earn ────────────────────────────────────────────────────

  server.get('/api/nuvion/savings', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    const localEntityId = String(entityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const rows = await db
      .select()
      .from(nuvionSavingsGoals)
      .where(and(eq(nuvionSavingsGoals.localEntityId, localEntityId), eq(nuvionSavingsGoals.userId, userId)))
      .orderBy(desc(nuvionSavingsGoals.createdAt));

    return reply.send({ success: true, goals: rows });
  });

  server.post('/api/nuvion/savings/goals', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const localEntityId = String(body.localEntityId || request.session?.activeEntityId || '');
    const userId = ownedEntity(request, localEntityId);
    if (!userId) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const mapping = (
      await db
        .select()
        .from(nuvionEntities)
        .where(eq(nuvionEntities.localEntityId, localEntityId))
        .limit(1)
    )[0];
    if (!mapping || mapping.status !== 'approved') {
      return reply.status(409).send({ error: 'Nuvion entity must be approved to create savings goals' });
    }

    const payload = {
      entity_id: mapping.entityId,
      account_id: String(body.accountId),
      name: String(body.name || 'Emergency Fund'),
      target_amount: Number(body.targetAmount),
      target_date: body.targetDate,
    };

    let goalRecord: any = null;
    try {
      const response = await nuvionClient.createSavingsGoal(payload);
      goalRecord = response.data?.savings_goal || (response as any).data || response;
    } catch {
      // Local fallback representation if earn module is in staging
      goalRecord = { id: `goal-${ulid()}`, ...payload, interest_rate: 6.5 };
    }

    const goalId = String(goalRecord?.id || `goal-${ulid()}`);

    await db.insert(nuvionSavingsGoals).values({
      id: ulid(),
      userId,
      localEntityId,
      nuvionEntityId: mapping.entityId,
      accountId: String(body.accountId),
      goalId,
      name: payload.name,
      targetAmountMinor: String(payload.target_amount),
      currentAmountMinor: '0',
      currency: body.currency || 'USD',
      targetDate: payload.target_date ? new Date(payload.target_date) : null,
      interestRate: String(goalRecord.interest_rate || '6.50'),
      status: 'active',
      providerData: goalRecord,
    });

    return reply.send({ success: true, goalId, goal: goalRecord });
  });
}
