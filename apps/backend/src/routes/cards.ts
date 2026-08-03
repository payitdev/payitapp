import { FastifyInstance } from 'fastify';
import { NuvionClient } from '@payit/integrations';
import { validateEntityAccess, validateCardEntityMatch } from '@payit/ledger';
import { createDbClient, eq, and } from '@payit/db';
import { cards, accounts, entities } from '@payit/db/schema';
import { ulid } from 'ulid';

const nuvion = new NuvionClient();
const db = createDbClient();

export async function cardRoutes(server: FastifyInstance) {

  /**
   * Issue virtual card — real Nuvion call, real DB insert.
   * Cardholder name is ALWAYS "<verified legal name>/PayIT"
   */
  server.post('/api/cards/issue', async (request, reply) => {
    const { session, entityId, accountId, brand, cardType } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      accountId?: string;
      brand: 'VISA' | 'MASTERCARD';
      cardType?: 'PERSONAL' | 'BUSINESS' | 'BURNER';
    };

    // 1. Entity guard validation
    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    // 2. Load entity from DB to get legal name (cardholder must be verified name)
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    // 3. Load account from DB (must belong to this entity)
    let nuvionAccountId: string;
    let cardAccountId: string;

    if (accountId) {
      const accountRows = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.entityId, entityId)))
        .limit(1);

      if (accountRows.length === 0) {
        return reply.status(403).send({ error: 'Account not found or does not belong to this entity' });
      }
      validateCardEntityMatch(entityId, accountRows[0].entityId);
      nuvionAccountId = accountRows[0].nuvionAccountId;
      cardAccountId = accountId;
    } else {
      // Use default account for this entity
      const defaultAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.entityId, entityId))
        .limit(1);

      if (defaultAccounts.length === 0) {
        return reply.status(400).send({ error: 'No account found for this entity. Complete KYC first.' });
      }
      nuvionAccountId = defaultAccounts[0].nuvionAccountId;
      cardAccountId = defaultAccounts[0].id;
    }

    // 4. Issue card via Nuvion API
    const cardholderName = `${entity.legalName}/PayIT`;
    let cardData: any;
    try {
      cardData = await nuvion.issueVirtualCard({
        nuvionEntityId: entity.nuvionEntityId || entityId,
        nuvionAccountId,
        brand: brand || 'VISA',
        cardholderName,
        cardType: cardType || (entity.kind === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL'),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Nuvion card issuance failed');
      return reply.status(502).send({ error: `Card issuance failed: ${err.message}` });
    }

    // 5. Store card in Neon DB — NEVER store PAN or CVV
    const cardId = ulid();
    await db.insert(cards).values({
      id: cardId,
      entityId,
      accountId: cardAccountId,
      nuvionCardId: cardData.nuvionCardId,
      last4: cardData.last4,
      brand: cardData.brand,
      status: 'active',
      createdAt: new Date(),
    });

    return reply.send({
      card: {
        id: cardId,
        entityId,
        accountId: cardAccountId,
        nuvionCardId: cardData.nuvionCardId,
        last4: cardData.last4,  // NEVER return full PAN or CVV
        brand: cardData.brand,
        cardholderName,
        cardType: cardData.cardType,
        issuanceFeeUsd: cardData.issuanceFeeUsd,
        status: 'active',
        feeSweep: cardData.feeSweep,
        createdAt: new Date().toISOString(),
      },
    });
  });

  /**
   * List cards — reads only from DB, filtered strictly by entity.
   */
  server.get('/api/cards', async (request, reply) => {
    const { activeEntityId } = request.query as { activeEntityId?: string };
    if (!activeEntityId) return reply.status(400).send({ error: 'activeEntityId query parameter required' });

    const entityCards = await db
      .select()
      .from(cards)
      .where(eq(cards.entityId, activeEntityId));

    return reply.send({ cards: entityCards });
  });

  /**
   * Freeze / unfreeze a card — updates status in DB.
   */
  server.patch('/api/cards/:cardId/status', async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const { status, entityId } = request.body as { status: 'frozen' | 'active'; entityId: string };

    // Verify card belongs to this entity before updating
    const cardRows = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.entityId, entityId)))
      .limit(1);

    if (cardRows.length === 0) {
      return reply.status(404).send({ error: 'Card not found for this entity' });
    }

    await db.update(cards).set({ status }).where(eq(cards.id, cardId));

    return reply.send({ success: true, cardId, status });
  });
}
