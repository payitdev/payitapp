import { FastifyInstance } from 'fastify';
import { and, createDbClient, eq } from '@payit/db';
import { accounts, brailsCards, brailsCollections, entities, invoices, kycVerifications, ledgerAccounts, ledgerEntries, payrollItems, rawWebhooks, schoolApplications, transfers } from '@payit/db/schema';
import { BrailsClient } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();
const brails = new BrailsClient();

function value(body: any, ...keys: string[]) {
  for (const key of keys) {
    if (body?.[key] !== undefined && body?.[key] !== null) return body[key];
    if (body?.data?.[key] !== undefined && body?.data?.[key] !== null) return body.data[key];
  }
  return undefined;
}

function normalizeCardStatus(value?: string | null) {
  const normalized = String(value || '').toUpperCase();
  if (['ACTIVE', 'OPEN', 'ENABLED', 'SUCCESS'].includes(normalized)) return 'ACTIVE';
  if (['FROZEN', 'BLOCKED', 'LOCKED'].includes(normalized)) return 'FROZEN';
  if (['TERMINATED', 'CANCELLED', 'REVOKED', 'CLOSED', 'DEACTIVATED'].includes(normalized)) return 'TERMINATED';
  if (['FAILED', 'ERROR', 'DECLINED'].includes(normalized)) return 'FAILED';
  if (['PENDING', 'PROCESSING', 'CREATED', 'INITIATED'].includes(normalized)) return 'PENDING';
  return 'ACTIVE';
}

export async function brailsRoutes(server: FastifyInstance) {
  server.get('/api/brails/deposit-options', async (request, reply) => {
    const entityId = (request.query as { entityId?: string }).entityId || request.session!.activeEntityId;
    if (!request.session!.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    const entity = (await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session!.userId))).limit(1))[0];
    if (!entity) return reply.status(404).send({ error: 'Entity not found' });
    const staticAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
    return reply.send({ success: true, entityId, options: { staticAccount: staticAccounts, transactionAccount: { available: true, supportedCountries: ['NG', 'KE', 'UG'] } } });
  });

  server.get('/api/brails/virtual-accounts', async (request, reply) => {
    const query = request.query as { entityId?: string; order?: 'ASC' | 'DESC'; page?: string; take?: string };
    const entityId = query.entityId || request.session!.activeEntityId;
    if (!request.session!.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    const entity = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session!.userId))).limit(1);
    if (!entity[0]) return reply.status(404).send({ error: 'Entity not found' });
    const page = Math.max(1, Number(query.page || 1));
    const take = Math.min(100, Math.max(1, Number(query.take || 10)));
    try {
      const provider = await brails.getVirtualAccounts({ page, take, order: query.order || 'ASC' });
      const local = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
      const customerRows = await db.select({ brailsCustomerId: kycVerifications.brailsCustomerId }).from(kycVerifications).where(and(eq(kycVerifications.entityId, entityId), eq(kycVerifications.status, 'approved')));
      const customerIds = new Set(customerRows.map(row => row.brailsCustomerId).filter(Boolean));
      const providerData = provider?.data || provider;
      const providerAccounts = Array.isArray(providerData?.virtualAccounts) ? providerData.virtualAccounts.filter((account: any) => customerIds.has(String(account.customerId || ''))) : [];
      return reply.send({ success: true, entityId, accounts: [...local, ...providerAccounts], meta: providerData?.meta || null });
    } catch (error: any) {
      const local = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
      return reply.send({ success: true, entityId, accounts: local, providerWarning: error.message });
    }
  });

  server.get('/api/brails/virtual-accounts/:accountId/transactions', async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const query = request.query as { order?: 'ASC' | 'DESC'; page?: string; take?: string };
    const entityId = request.session!.activeEntityId;
    if (!request.session!.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    const ownedAccount = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.entityId, entityId))).limit(1);
    if (!ownedAccount[0]) return reply.status(404).send({ error: 'Virtual account not found for this entity' });
    try {
      const result = await brails.getVirtualAccountTransactions(ownedAccount[0].dueVirtualAccountId, { order: query.order || 'ASC', page: Number(query.page || 1), take: Number(query.take || 10) });
      return reply.send({ success: true, entityId, accountId, result });
    } catch (error: any) {
      return reply.status(502).send({ error: 'Brails virtual-account transactions unavailable', details: error.message });
    }
  });

  server.post('/api/brails/collections', async (request, reply) => {
    const body = request.body as any;
    const entityId = body.entityId || request.session!.activeEntityId;
    if (!request.session!.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    const amount = Number(body.amount);
    const country = String(body.country || 'NG').toUpperCase();
    const currency = String(body.currency || 'NGN').toUpperCase();
    if (!Number.isSafeInteger(amount) || amount <= 0) return reply.status(400).send({ error: 'amount must be a positive integer in minor units' });
    if (!(['NG', 'KE', 'UG'] as string[]).includes(country)) return reply.status(400).send({ error: 'Unsupported Brails collection country' });
    const validCurrency = (country === 'NG' && currency === 'NGN') || (country === 'KE' && currency === 'KES') || (country === 'UG' && currency === 'UGX');
    if (!validCurrency) return reply.status(400).send({ error: 'Currency does not match collection country' });
    const reference = String(body.reference || `proxim_col_${ulid()}`);
    const existing = await db.select().from(brailsCollections).where(eq(brailsCollections.reference, reference)).limit(1);
    if (existing.length > 0) return reply.send({ success: true, collection: existing[0], duplicate: true });
    const payload: Record<string, string> = country === 'NG'
      ? { type: 'BANK', accountName: String(body.accountName || 'Customer') }
      : { network: String(body.network || (country === 'KE' ? 'MPESA' : 'MTN')).toUpperCase(), type: 'MOMO', accountNumber: String(body.accountNumber || ''), accountName: String(body.accountName || 'Customer') } as Record<string, string>;
    if (country !== 'NG' && !payload['accountNumber']) return reply.status(400).send({ error: 'Mobile money accountNumber is required' });
    try {
      const entity = (await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session!.userId))).limit(1))[0];
      const result = await brails.createCollection({ amount, country: country as any, currency: currency as any, channel: country === 'NG' ? 'bank_transfer' : 'mobile_money', email: request.session!.email, customerName: body.accountName, reference, description: String(body.description || 'Proxim collection'), payload });
      const data = result?.data || result;
      const account = data?.virtualAccount || data?.account || data;
      const collection = await db.insert(brailsCollections).values({ id: `col_${ulid()}`, entityId, invoiceId: body.invoiceId || null, reference, providerTransactionId: data?.id || null, providerAccountId: account?.id || null, country: country as any, currency, amountMinor: String(amount), mode: 'TRANSACTION_ACCOUNT', status: 'PENDING', accountNumber: account?.accountNumber || data?.accountNumber || null, bankName: account?.bankName || data?.bankName || null, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), updatedAt: new Date() }).returning();
      return reply.send({ success: true, collection: collection[0], provider: result });
    } catch (err: any) { return reply.status(502).send({ error: 'Brails collection initialization failed', details: err.message }); }
  });

  server.post('/webhooks/brails', { config: { rawBody: true } }, async (request, reply) => {
    const signature = String(request.headers['x-brails-signature'] || request.headers['x-webhook-signature'] || '');
    const raw = String((request as any).rawBody || '');
    if (!raw || !brails.verifyWebhookSignature(raw, signature)) return reply.status(401).send({ error: 'Invalid Brails webhook signature' });

    const body = request.body as any;
    const eventId = String(value(body, 'id', 'eventId', 'event_id') || '');
    if (!eventId) return reply.status(400).send({ error: 'Brails webhook event ID is required' });
    const existing = await db.select().from(rawWebhooks).where(eq(rawWebhooks.eventId, eventId)).limit(1);
    if (existing.length > 0) return reply.send({ received: true, duplicate: true });
    await db.insert(rawWebhooks).values({ id: `brails_${eventId}`, provider: 'BRAILS', eventId, payload: raw, status: 'RECEIVED' });

    const payoutId = String(value(body, 'payoutId', 'payout_id', 'transferId', 'transfer_id') || '');
    const status = String(value(body, 'status', 'payoutStatus', 'payout_status') || '').toUpperCase();
    if (payoutId && status) {
      const normalized = ['SUCCESS', 'COMPLETED', 'PAID', 'SETTLED'].includes(status) ? 'completed' : ['FAILED', 'REJECTED', 'CANCELLED'].includes(status) ? 'failed' : 'pending';
      await db.update(transfers).set({ status: normalized, settlementStatus: normalized === 'completed' ? 'LEDGER_CREDITED' : normalized === 'failed' ? 'FAILED' : 'SOURCE_SUBMITTED', settlementError: normalized === 'failed' ? String(value(body, 'reason', 'message', 'error') || 'Brails payout failed') : null })
        .where(eq(transfers.dueTransferId, payoutId));
      await db.update(payrollItems).set({ status: normalized === 'completed' ? 'success' : normalized === 'failed' ? 'failed' : 'pending', errorMessage: normalized === 'failed' ? String(value(body, 'reason', 'message', 'error') || 'Brails payout failed') : null }).where(eq(payrollItems.duePayoutId, payoutId));
    }
    const event = String(value(body, 'event') || '').toLowerCase();
    const applicationReference = String(value(body, 'reference', 'applicationId', 'application_id') || '');
    if (applicationReference.startsWith('school_app_') || event.includes('kyb') || event.includes('business')) {
      const providerData = body?.data || body;
      const providerStatus = String(value(providerData, 'status', 'kybStatus', 'kyb_status', 'state') || '').toUpperCase();
      if (applicationReference || providerData?.customerId || providerData?.customer_id) {
        const applicationRows = applicationReference
          ? await db.select().from(schoolApplications).where(eq(schoolApplications.id, applicationReference)).limit(1)
          : await db.select().from(schoolApplications).where(eq(schoolApplications.brailsCustomerId, String(value(providerData, 'customerId', 'customer_id', 'id') || ''))).limit(1);
        if (applicationRows[0] && providerStatus) {
          const normalized = ['APPROVED', 'ACTIVE', 'VERIFIED', 'SUCCESS'].includes(providerStatus) ? 'APPROVED' : ['REJECTED', 'FAILED', 'DECLINED'].includes(providerStatus) ? 'REJECTED' : 'KYB_REVIEW';
          await db.update(schoolApplications).set({ status: normalized, brailsStatus: providerStatus, brailsPayload: body }).where(eq(schoolApplications.id, applicationRows[0].id));
        }
      }
    }
    const reference = String(value(body, 'reference') || '');
    const collectionId = String(value(body, 'id') || '');
    const providerCardId = String(value(body, 'cardId', 'card_id', 'virtualCardId', 'virtual_card_id', 'id') || '');

    if (providerCardId && (event.includes('card') || String(value(body, 'objectType', 'resourceType') || '').toLowerCase().includes('card'))) {
      const cardRows = await db.select().from(brailsCards).where(eq(brailsCards.providerCardId, providerCardId)).limit(1);
      if (cardRows.length > 0) {
        const nextStatus = normalizeCardStatus(String(value(body, 'status', 'state', 'cardStatus') || ''));
        await db.update(brailsCards).set({ status: nextStatus, providerMetadata: { ...(cardRows[0].providerMetadata || {}), ...(body || {}) }, updatedAt: new Date() }).where(eq(brailsCards.id, cardRows[0].id));
      }
    }

    if (event === 'transaction.deposit.success' || event === 'collection.deposit.success' || event === 'collection.deposit.failed') {
      const collectionRows = reference ? await db.select().from(brailsCollections).where(eq(brailsCollections.reference, reference)).limit(1) : [];
      const collection = collectionRows[0];
      if (collection) {
        const successful = event.endsWith('.success');
        await db.update(brailsCollections).set({ providerTransactionId: collectionId || collection.providerTransactionId, amountReceivedMinor: String(value(body, 'amount') || collection.amountMinor), status: successful ? 'SUCCESS' : 'FAILED', failureReason: successful ? null : String(value(body, 'reason', 'message', 'error') || 'Brails collection failed'), updatedAt: new Date() }).where(and(eq(brailsCollections.id, collection.id), eq(brailsCollections.status, 'PENDING')));
        if (successful) {
          const accountId = `${collection.entityId}_cash_${collection.currency}`;
          const clearingId = `${collection.entityId}_brails_collection_${collection.currency}`;
          await db.insert(ledgerAccounts).values([{ id: accountId, entityId: collection.entityId, name: `Available ${collection.currency}`, type: 'ASSET', currency: collection.currency }, { id: clearingId, entityId: collection.entityId, name: `Brails Collection Clearing ${collection.currency}`, type: 'LIABILITY', currency: collection.currency }]).onConflictDoNothing();
          const amountMajor = Number(value(body, 'amount') || collection.amountMinor) / 100;
          await db.insert(transfers).values({ id: `tr_${collection.id}`, entityId: collection.entityId, dueTransferId: collection.providerTransactionId || collection.reference, sourceCurrency: collection.currency, targetCurrency: collection.currency, sourceAmount: amountMajor.toFixed(2), targetAmount: amountMajor.toFixed(2), feeAmount: '0', direction: 'CREDIT', settlementStatus: 'LEDGER_CREDITED', status: 'completed' }).onConflictDoNothing();
          await db.insert(ledgerEntries).values([{ id: ulid(), entityId: collection.entityId, transactionId: collection.id, ledgerAccountId: accountId, type: 'DEBIT', amount: amountMajor.toFixed(2) }, { id: ulid(), entityId: collection.entityId, transactionId: collection.id, ledgerAccountId: clearingId, type: 'CREDIT', amount: amountMajor.toFixed(2) }]).onConflictDoNothing();
        }
      }
    }
    // Stablecoin Receive & Send Webhook Handling
    if (event.startsWith('stablecoin.')) {
      const data = body?.data || body;
      const isSend = event.includes('.send.');
      const isReceive = event.includes('.receive.');
      const isSuccess = event.endsWith('.success');
      const isFailed = event.endsWith('.failed');
      const currency = event.includes('.usdt.') ? 'USDT' : 'USDC';
      const ref = String(data?.reference || reference || '');
      const txId = String(data?.id || collectionId || '');

      if (isReceive && isSuccess) {
        // Find matching entity by reference prefix or deposit address
        const matchingTransfers = ref ? await db.select().from(transfers).where(eq(transfers.dueTransferId, ref)).limit(1) : [];
        const targetEntityId = matchingTransfers[0]?.entityId || (await db.select().from(entities).limit(1))[0]?.id;

        if (targetEntityId) {
          const amountMajor = (Number(data?.centAmount || Number(data?.amount || 0) * 100) / 100).toFixed(2);
          const accountId = `${targetEntityId}_cash_${currency}`;
          const clearingId = `${targetEntityId}_brails_stablecoin_clearing_${currency}`;

          await db.insert(ledgerAccounts).values([
            { id: accountId, entityId: targetEntityId, name: `Available ${currency}`, type: 'ASSET', currency },
            { id: clearingId, entityId: targetEntityId, name: `Brails Stablecoin Clearing ${currency}`, type: 'LIABILITY', currency }
          ]).onConflictDoNothing();

          await db.insert(transfers).values({
            id: `tr_brails_${ulid()}`,
            entityId: targetEntityId,
            dueTransferId: txId || ref,
            sourceCurrency: currency,
            targetCurrency: currency,
            sourceAmount: amountMajor,
            targetAmount: amountMajor,
            feeAmount: '0',
            direction: 'CREDIT',
            settlementStatus: 'LEDGER_CREDITED',
            status: 'completed',
          }).onConflictDoNothing();

          await db.insert(ledgerEntries).values([
            { id: ulid(), entityId: targetEntityId, transactionId: txId || ref, ledgerAccountId: accountId, type: 'DEBIT', amount: amountMajor },
            { id: ulid(), entityId: targetEntityId, transactionId: txId || ref, ledgerAccountId: clearingId, type: 'CREDIT', amount: amountMajor },
          ]).onConflictDoNothing();
        }
      }

      if (isSend) {
        const nextStatus = isSuccess ? 'completed' : isFailed ? 'failed' : 'pending';
        if (ref) {
          await db.update(transfers).set({
            status: nextStatus,
            settlementStatus: isSuccess ? 'LEDGER_CREDITED' : isFailed ? 'FAILED' : 'SOURCE_SUBMITTED',
            settlementError: isFailed ? String(data?.reason || data?.message || 'Brails stablecoin transfer failed') : null,
          }).where(eq(transfers.dueTransferId, ref));
        }
      }
    }

    await db.update(rawWebhooks).set({ status: 'PROCESSED' }).where(and(eq(rawWebhooks.eventId, eventId), eq(rawWebhooks.status, 'RECEIVED')));
    return reply.send({ received: true });
  });

  // Brails Stablecoin Endpoints (Base Chain)
  server.post('/api/brails/stablecoin/send', async (request, reply) => {
    const body = request.body as any;
    const entityId = body.entityId || request.session!.activeEntityId;
    if (!request.session!.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const currency = (body.currency || 'USDC').toUpperCase() as 'USDC' | 'USDT';
    const amountCents = Number(body.amountCents || body.amount || 0);
    const address = String(body.address || '').trim();
    const chain = (body.chain || 'base').toLowerCase() as any;
    const description = String(body.description || 'Proxim Stablecoin Transfer');
    const reference = String(body.reference || `brails_send_${ulid()}`);

    if (amountCents <= 0 || !Number.isSafeInteger(amountCents)) {
      return reply.status(400).send({ error: 'amountCents must be a positive integer in cents' });
    }
    if (!address) {
      return reply.status(400).send({ error: 'Recipient address is required' });
    }

    try {
      const result = await brails.sendStablecoin(currency, {
        amount: amountCents,
        address,
        chain,
        reference,
        description,
        customerEmail: request.session!.email || 'finance@proxim.financial',
        callbackUrl: body.callbackUrl,
      });

      // Record outbound transfer
      const amountMajor = (amountCents / 100).toFixed(2);
      await db.insert(transfers).values({
        id: `tr_${reference}`,
        entityId,
        dueTransferId: result?.data?.id || reference,
        sourceCurrency: currency,
        targetCurrency: currency,
        sourceAmount: amountMajor,
        targetAmount: amountMajor,
        feeAmount: '2.00', // Brails standard $2.00 fee
        direction: 'DEBIT',
        settlementStatus: 'SOURCE_SUBMITTED',
        status: 'pending',
      }).onConflictDoNothing();

      return reply.send({ success: true, result, reference });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Brails stablecoin send failed', details: err.message });
    }
  });

  server.post('/api/brails/stablecoin/deposit-address', async (request, reply) => {
    const body = request.body as any;
    const entityId = body.entityId || request.session!.activeEntityId;
    if (!request.session!.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const currency = (body.currency || 'USDC').toUpperCase() as 'USDC' | 'USDT';
    const chain = (body.chain || 'base').toLowerCase() as any;
    const reference = String(body.reference || `dep_${entityId}_${ulid()}`);
    const description = String(body.description || `Proxim ${currency} Deposit Address`);

    try {
      const result = await brails.generateDepositAddress(currency, {
        chain,
        reference,
        description,
        customerEmail: request.session!.email || 'finance@proxim.financial',
        callbackUrl: body.callbackUrl,
      });

      return reply.send({ success: true, depositAddress: result?.data || result });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Failed to generate Brails deposit address', details: err.message });
    }
  });

  server.get('/api/brails/stablecoin/deposit-addresses', async (request, reply) => {
    const query = request.query as any;
    const entityId = query.entityId || request.session!.activeEntityId;
    if (!request.session!.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    try {
      const result = await brails.listDepositAddresses({
        chain: query.chain || 'base',
        currency: query.currency,
        active: query.active !== undefined ? query.active === 'true' : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });

      return reply.send({ success: true, data: result?.data || result });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Failed to list Brails deposit addresses', details: err.message });
    }
  });

  server.patch('/api/brails/stablecoin/deposit-address/:addressId/deactivate', async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    try {
      const result = await brails.deactivateDepositAddress(addressId);
      return reply.send({ success: true, result });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Failed to deactivate Brails deposit address', details: err.message });
    }
  });

  server.get('/api/brails/transactions/:transactionId', async (request, reply) => {
    const { transactionId } = request.params as { transactionId: string };
    try {
      const result = await brails.verifyTransactionStatus(transactionId);
      return reply.send({ success: true, transaction: result?.data || result });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Failed to fetch Brails transaction status', details: err.message });
    }
  });

  server.get('/api/transfers/brails-status/:payoutId', async (request, reply) => {
    const { payoutId } = request.params as { payoutId: string };
    const rows = await db.select().from(transfers).where(and(eq(transfers.dueTransferId, payoutId), eq(transfers.entityId, request.session!.activeEntityId))).limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'Brails payout not found' });
    if (!['completed', 'failed'].includes(rows[0].status)) {
      try {
        const providerStatus = await brails.getPayoutStatus(payoutId);
        const status = String(value(providerStatus, 'status', 'payoutStatus', 'payout_status') || '').toUpperCase();
        if (status) {
          const next = ['SUCCESS', 'COMPLETED', 'PAID', 'SETTLED'].includes(status) ? 'completed' : ['FAILED', 'REJECTED', 'CANCELLED'].includes(status) ? 'failed' : 'pending';
          await db.update(transfers).set({ status: next, settlementStatus: next === 'completed' ? 'LEDGER_CREDITED' : next === 'failed' ? 'FAILED' : 'SOURCE_SUBMITTED' }).where(and(eq(transfers.id, rows[0].id), eq(transfers.status, 'pending')));
        }
      } catch {
        return reply.status(502).send({ error: 'Brails payout status unavailable' });
      }
    }
    const refreshed = (await db.select().from(transfers).where(eq(transfers.id, rows[0].id)).limit(1))[0];
    return reply.send({ success: true, payoutId, status: refreshed.status, settlementStatus: refreshed.settlementStatus });
  });
}