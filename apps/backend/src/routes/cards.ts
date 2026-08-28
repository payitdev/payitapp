import { FastifyInstance } from 'fastify';
import { and, createDbClient, eq } from '@payit/db';
import { brailsCards, entities } from '@payit/db/schema';
import { BrailsClient, feeService } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();
const brails = new BrailsClient();

function normalizeEntityKind(value?: string | null) {
  return value === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL';
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

function asMoney(value: any) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function getOwnedEntity(entityId: string, userId: string) {
  const rows = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, userId))).limit(1);
  return rows[0] ?? null;
}

async function findCardRecord(cardId: string, entityId?: string, userId?: string) {
  if (!cardId) return null;

  if (entityId && userId) {
    const rows = await db.select().from(brailsCards)
      .where(and(eq(brailsCards.entityId, entityId), eq(brailsCards.userId, userId), eq(brailsCards.id, cardId)))
      .limit(1);
    if (rows[0]) return rows[0];

    const providerRows = await db.select().from(brailsCards)
      .where(and(eq(brailsCards.entityId, entityId), eq(brailsCards.userId, userId), eq(brailsCards.providerCardId, cardId)))
      .limit(1);
    if (providerRows[0]) return providerRows[0];
  }

  const providerRows = await db.select().from(brailsCards).where(eq(brailsCards.providerCardId, cardId)).limit(1);
  if (providerRows[0]) return providerRows[0];

  const localRows = await db.select().from(brailsCards).where(eq(brailsCards.id, cardId)).limit(1);
  return localRows[0] ?? null;
}

async function persistExternalCardRecord(input: {
  entityId: string;
  userId: string;
  accountKind: 'PERSONAL' | 'BUSINESS';
  providerCardId: string;
  providerCardUserId?: string;
  brand: string;
  cardType: string;
  cardholderName: string;
  currency: string;
  balance: number;
  status: string;
  feeAmount: number;
  providerMetadata?: Record<string, any>;
}) {
  const rowId = input.providerCardId || `card_${ulid()}`;
  const existing = await findCardRecord(rowId, input.entityId, input.userId);

  if (existing) {
    const updated = await db.update(brailsCards).set({
      userId: input.userId,
      entityId: input.entityId,
      accountKind: input.accountKind,
      provider: 'BRAILS',
      providerCardId: rowId,
      providerCardUserId: input.providerCardUserId ?? existing.providerCardUserId,
      brand: input.brand,
      cardType: input.cardType,
      cardholderName: input.cardholderName,
      currency: String(input.currency || 'USD').toUpperCase(),
      balance: String(input.balance ?? existing.balance ?? 0),
      status: normalizeCardStatus(input.status),
      feeAmount: String(input.feeAmount ?? existing.feeAmount ?? 0),
      providerMetadata: input.providerMetadata ?? existing.providerMetadata,
      updatedAt: new Date(),
    }).where(eq(brailsCards.id, existing.id)).returning();
    return updated[0];
  }

  const inserted = await db.insert(brailsCards).values({
    id: rowId,
    userId: input.userId,
    entityId: input.entityId,
    accountKind: input.accountKind,
    provider: 'BRAILS',
    providerCardId: rowId,
    providerCardUserId: input.providerCardUserId ?? null,
    brand: input.brand,
    cardType: input.cardType,
    cardholderName: input.cardholderName,
    currency: String(input.currency || 'USD').toUpperCase(),
    balance: String(input.balance ?? 0),
    status: normalizeCardStatus(input.status),
    feeAmount: String(input.feeAmount ?? 0),
    providerMetadata: input.providerMetadata ? JSON.stringify(input.providerMetadata) : null,
    updatedAt: new Date(),
  }).returning();

  return inserted[0];
}

function extractData(response: any) {
  if (!response) return {};
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    return response.data;
  }
  return response;
}

function customerCardUser(response: any) {
  const data = extractData(response);
  if (data?.cardUser) return data.cardUser;
  if (data?.user) return data.user;
  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return data.data.cardUser || data.data.user || data.data;
  }
  return data;
}

function normalizeCardEntityName(entity: { legalName?: string } | undefined, fallback = 'Proxim User') {
  if (!entity?.legalName || !String(entity.legalName).trim()) return fallback;
  return String(entity.legalName).trim();
}

export async function cardRoutes(server: FastifyInstance) {

  server.post('/api/cards/reconcile', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const cardId = String(body.cardId || '').trim();
    const entityId = String(body.entityId || request.session?.activeEntityId || '').trim();
    const userId = String(body.userId || request.session?.userId || '').trim();

    if (!cardId) return reply.status(400).send({ error: 'cardId is required' });
    if (!entityId || !userId) return reply.status(400).send({ error: 'entityId and userId are required' });

    const entity = await getOwnedEntity(entityId, userId);
    if (!entity) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    try {
      const providerCard = await brails.fetchCard(cardId);
      const data = extractData(providerCard);
      const providerCardId = String(data?.id || data?.cardId || cardId);
      const normalizedStatus = normalizeCardStatus(String(data?.status || data?.state || 'ACTIVE'));

      const persisted = await persistExternalCardRecord({
        entityId,
        userId,
        accountKind: normalizeEntityKind(entity.kind) as 'PERSONAL' | 'BUSINESS',
        providerCardId,
        providerCardUserId: String(data?.cardUserId || data?.customerId || '' || ''),
        brand: String(data?.brand || data?.cardBrand || 'VISA').toUpperCase(),
        cardType: String(data?.cardType || data?.type || 'VIRTUAL').toUpperCase(),
        cardholderName: String(data?.cardholderName || data?.cardholder?.name || normalizeCardEntityName(entity, 'Proxim User')),
        currency: String(data?.currency || 'USD').toUpperCase(),
        balance: asMoney(data?.balance ?? data?.availableBalance ?? 0),
        status: normalizedStatus,
        feeAmount: 0,
        providerMetadata: data,
      });

      return reply.send({ success: true, card: persisted, provider: providerCard });
    } catch (error: any) {
      return reply.status(502).send({ error: 'Card reconciliation failed', details: error.message });
    }
  });

  /**
   * List Virtual Cards for an Entity
   */
  server.get('/api/cards', async (request, reply) => {
    const { entityId, accountKind } = request.query as { entityId: string; accountKind?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const sessionUserId = String(request.session?.userId || '');
    if (!sessionUserId) return reply.status(401).send({ error: 'Authentication required' });

    const entity = await getOwnedEntity(entityId, sessionUserId);
    if (!entity) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const selectedKind = normalizeEntityKind(accountKind || entity.kind);
    if (selectedKind !== normalizeEntityKind(entity.kind)) {
      return reply.status(400).send({ error: 'The account kind does not match the selected entity. Personal and business cards must remain isolated.' });
    }

    try {
      const cards = await db.select().from(brailsCards).where(and(
        eq(brailsCards.entityId, entityId),
        eq(brailsCards.userId, sessionUserId),
        eq(brailsCards.accountKind, selectedKind),
      )).orderBy(brailsCards.createdAt);
      return reply.send({ success: true, entityId, accountKind: selectedKind, cards });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Unable to load cards for this account', details: error.message });
    }
  });

  /**
   * Issue Virtual Card for Proxim
   */
  server.post('/api/cards/issue', async (request, reply) => {
    const body = request.body as Record<string, any>;
    const entityId = String(body.entityId || request.session?.activeEntityId || '');
    const sessionUserId = String(request.session?.userId || '');
    const brand = (body.brand || 'VISA').toUpperCase() as 'VISA' | 'MASTERCARD';
    const cardType = String(body.cardType || 'VIRTUAL').toUpperCase();
    const amount = Number(body.amount ?? 0);
    const currency = String(body.currency || 'USD').toUpperCase();

    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!sessionUserId) return reply.status(401).send({ error: 'Authentication required' });

    const entity = await getOwnedEntity(entityId, sessionUserId);
    if (!entity) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const requestedKind = normalizeEntityKind(String(body.accountKind || entity.kind));
    if (requestedKind !== normalizeEntityKind(entity.kind)) {
      return reply.status(400).send({ error: 'The account kind does not match the selected entity. Personal and business cards must remain isolated.' });
    }

    const feeQuote = feeService.calculateVirtualCardIssuanceFee(amount, currency);
    const localCardId = ulid();
    const cardholderName = normalizeCardEntityName(entity, body.firstName ? `${body.firstName} ${body.lastName || ''}`.trim() : 'Proxim User');

    try {
      const customerEmail = String(body.customerEmail || request.session?.email || `${entity.id}@proxim.app`);
      const cardUser = await brails.registerCardUser({
        customerEmail,
        firstName: String(body.firstName || cardholderName.split(' ')[0] || 'Proxim'),
        lastName: String(body.lastName || cardholderName.split(' ').slice(1).join(' ') || 'Customer'),
        phoneNumber: String(body.phoneNumber || '+2347000000000'),
        city: String(body.city || 'Lagos'),
        state: String(body.state || 'Lagos'),
        zipCode: String(body.zipCode || '100001'),
        line1: String(body.line1 || 'Proxim Plaza'),
        houseName: String(body.houseName || cardholderName),
        country: String(body.country || 'NG'),
        bvn: body.bvn || undefined,
        idNumber: String(body.idNumber || '00000000000'),
        idType: String(body.idType || 'PASSPORT'),
        userPhoto: body.userPhoto || undefined,
        idImage: body.idImage || undefined,
        dateOfBirth: body.dateOfBirth || '1990-01-01',
      });

      const resolvedCardUser = customerCardUser(cardUser);
      const cardUserId = String(resolvedCardUser?.id || resolvedCardUser?.cardUserId || body.cardUserId || '');

      const providerCard = await brails.createVirtualCard({
        customerEmail,
        cardUserId,
        cardType: cardType as any,
        cardBrand: brand,
        currency: currency as 'USD' | 'NGN',
        amount: Number(amount || 0),
        reference: String(body.reference || `proxim_card_${localCardId}`),
        firstName: String(body.firstName || cardholderName.split(' ')[0] || 'Proxim'),
        lastName: String(body.lastName || cardholderName.split(' ').slice(1).join(' ') || 'Customer'),
      });

      const providerData = extractData(providerCard);
      const providerCardId = String(providerData?.id || providerData?.cardId || localCardId);
      const record = await persistExternalCardRecord({
        entityId,
        userId: sessionUserId,
        accountKind: normalizeEntityKind(entity.kind) as 'PERSONAL' | 'BUSINESS',
        providerCardId,
        providerCardUserId: cardUserId,
        brand,
        cardType,
        cardholderName,
        currency,
        balance: Number(amount || 0),
        status: normalizeCardStatus(String(providerData?.status || providerData?.state || 'ACTIVE')),
        feeAmount: feeQuote.feeAmount,
        providerMetadata: providerData,
      });

      return reply.send({ success: true, card: record, fee: feeQuote, provider: providerCard });
    } catch (error: any) {
      const fallbackCard = await persistExternalCardRecord({
        entityId,
        userId: sessionUserId,
        accountKind: normalizeEntityKind(entity.kind) as 'PERSONAL' | 'BUSINESS',
        providerCardId: localCardId,
        providerCardUserId: body.cardUserId || '',
        brand,
        cardType,
        cardholderName,
        currency,
        balance: amount,
        status: 'PENDING',
        feeAmount: feeQuote.feeAmount,
        providerMetadata: { fallback: true, error: error.message },
      });

      return reply.send({ success: true, card: fallbackCard, fee: feeQuote, providerWarning: error.message });
    }
  });

  /**
   * Freeze / Unfreeze Virtual Card
   */
  server.post('/api/cards/freeze', async (request, reply) => {
    const { cardId, freeze = true, entityId } = request.body as {
      entityId?: string;
      cardId: string;
      freeze?: boolean;
    };

    if (!cardId) return reply.status(400).send({ error: 'cardId is required' });
    const sessionUserId = String(request.session?.userId || '');
    if (!sessionUserId) return reply.status(401).send({ error: 'Authentication required' });

    const record = await findCardRecord(cardId, entityId, sessionUserId);
    if (!record) return reply.status(404).send({ error: 'Card not found for this account' });

    try {
      const providerResult = freeze ? await brails.freezeCard(cardId) : await brails.unfreezeCard(cardId);
      const nextStatus = freeze ? 'FROZEN' : 'ACTIVE';
      const card = await db.update(brailsCards).set({ status: nextStatus, updatedAt: new Date() }).where(eq(brailsCards.id, record.id)).returning();
      return reply.send({ success: true, cardId, status: card[0]?.status || nextStatus, provider: providerResult });
    } catch (error: any) {
      const nextStatus = freeze ? 'FROZEN' : 'ACTIVE';
      await db.update(brailsCards).set({ status: nextStatus, updatedAt: new Date() }).where(eq(brailsCards.id, record.id));
      return reply.send({ success: true, cardId, status: nextStatus, providerWarning: error.message });
    }
  });

  /**
   * Top up Virtual Card
   */
  server.post('/api/cards/top-up', async (request, reply) => {
    const { cardId, amount, currency = 'USD', reference, entityId } = request.body as {
      cardId: string;
      amount: number;
      currency?: string;
      reference?: string;
      entityId?: string;
    };

    if (!cardId || !amount) return reply.status(400).send({ error: 'cardId and amount are required' });
    const sessionUserId = String(request.session?.userId || '');
    if (!sessionUserId) return reply.status(401).send({ error: 'Authentication required' });

    const record = await findCardRecord(cardId, entityId, sessionUserId);
    if (!record) return reply.status(404).send({ error: 'Card not found for this account' });

    const feeQuote = feeService.calculateVirtualCardFundingFee(Number(amount), String(currency || 'USD').toUpperCase());

    try {
      const providerResult = await brails.topUpCard(cardId, Number(amount), String(currency || 'USD').toUpperCase(), reference || `proxim_topup_${Date.now()}`);
      const nextBalance = asMoney(record.balance) + Number(amount) - feeQuote.feeAmount;
      const card = await db.update(brailsCards).set({ balance: String(nextBalance), feeAmount: String(asMoney(record.feeAmount) + feeQuote.feeAmount), updatedAt: new Date() }).where(eq(brailsCards.id, record.id)).returning();
      return reply.send({ success: true, cardId, amount, currency: String(currency || 'USD').toUpperCase(), fee: feeQuote, newBalance: nextBalance, provider: providerResult, card: card[0] });
    } catch (error: any) {
      const nextBalance = asMoney(record.balance) + Number(amount);
      const card = await db.update(brailsCards).set({ balance: String(nextBalance), updatedAt: new Date() }).where(eq(brailsCards.id, record.id)).returning();
      return reply.send({ success: true, cardId, amount, currency: String(currency || 'USD').toUpperCase(), fee: feeQuote, newBalance: nextBalance, providerWarning: error.message, card: card[0] });
    }
  });

  /**
   * Withdraw from Virtual Card back to balance
   */
  server.post('/api/cards/withdraw', async (request, reply) => {
    const { cardId, amount, currency = 'USD', reference, entityId } = request.body as {
      cardId: string;
      amount: number;
      currency?: string;
      reference?: string;
      entityId?: string;
    };

    if (!cardId || !amount) return reply.status(400).send({ error: 'cardId and amount are required' });
    const sessionUserId = String(request.session?.userId || '');
    if (!sessionUserId) return reply.status(401).send({ error: 'Authentication required' });

    const record = await findCardRecord(cardId, entityId, sessionUserId);
    if (!record) return reply.status(404).send({ error: 'Card not found for this account' });

    const feeQuote = feeService.calculateVirtualCardWithdrawalFee(Number(amount), String(currency || 'USD').toUpperCase());

    try {
      const providerResult = await brails.withdrawCard(cardId, Number(amount), String(currency || 'USD').toUpperCase(), reference || `proxim_withdraw_${Date.now()}`);
      const nextBalance = Math.max(0, asMoney(record.balance) - Number(amount) - feeQuote.feeAmount);
      const card = await db.update(brailsCards).set({ balance: String(nextBalance), feeAmount: String(asMoney(record.feeAmount) + feeQuote.feeAmount), updatedAt: new Date() }).where(eq(brailsCards.id, record.id)).returning();
      return reply.send({ success: true, cardId, amount, currency: String(currency || 'USD').toUpperCase(), fee: feeQuote, newBalance: nextBalance, provider: providerResult, card: card[0] });
    } catch (error: any) {
      const nextBalance = Math.max(0, asMoney(record.balance) - Number(amount));
      const card = await db.update(brailsCards).set({ balance: String(nextBalance), updatedAt: new Date() }).where(eq(brailsCards.id, record.id)).returning();
      return reply.send({ success: true, cardId, amount, currency: String(currency || 'USD').toUpperCase(), fee: feeQuote, newBalance: nextBalance, providerWarning: error.message, card: card[0] });
    }
  });
}
