import { FastifyInstance } from 'fastify';
import { NuvionClient } from '@payit/integrations';
import { validateEntityAccess, validateCardEntityMatch } from '@payit/ledger';
import { createDbClient, eq, and } from '@payit/db';
import { cards, accounts, entities } from '@payit/db/schema';
import { ulid } from 'ulid';
import { assertEntityApproved } from './kyc.js';

const nuvion = new NuvionClient();
const db = createDbClient();

export async function cardRoutes(server: FastifyInstance) {

  /**
   * Issue virtual card — real Nuvion call, real DB insert.
   * Cardholder name is the user's verified legal name.
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

    // 2. Load entity from DB and enforce entity approval gate
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    try {
      assertEntityApproved(entity);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const cardholderName = entity.legalName || '';

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

    // 4. Issue virtual card via Nuvion
    let cardResult: any;
    try {
      cardResult = await nuvion.issueVirtualCard({
        nuvionEntityId: entity.nuvionEntityId || `nuvion_${entityId}`,
        nuvionAccountId,
        brand: brand || 'VISA',
        cardholderName,
        cardType: cardType || 'PERSONAL',
      });
    } catch (err: any) {
      server.log.error({ err }, 'Nuvion card issuance failed');
      return reply.status(502).send({ error: `Card issuance failed: ${err.message}` });
    }

    // 5. Insert card record into Neon DB
    const cardId = ulid();
    await db.insert(cards).values({
      id: cardId,
      entityId,
      accountId: cardAccountId,
      nuvionCardId: cardResult.nuvionCardId,
      last4: cardResult.last4,
      brand: brand || 'VISA',
      cardholderName,
      status: cardResult.status,
      createdAt: new Date(),
    });

    return reply.send({
      card: {
        id: cardId,
        entityId,
        accountId: cardAccountId,
        nuvionCardId: cardResult.nuvionCardId,
        last4: cardResult.last4,
        brand: brand || 'VISA',
        cardholderName,
        cardType: cardType || 'PERSONAL',
        issuanceFeeUsd: cardResult.issuanceFeeUsd,
        status: cardResult.status,
        createdAt: new Date().toISOString(),
      },
      feeSweep: cardResult.feeSweep,
    });
  });

  /**
   * List all virtual cards for an entity.
   */
  server.get('/api/cards', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId query parameter required' });

    const entityCards = await db.select().from(cards).where(eq(cards.entityId, entityId));
    return reply.send({ cards: entityCards });
  });
}
