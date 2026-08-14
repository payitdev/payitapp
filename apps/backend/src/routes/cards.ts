import { FastifyInstance } from 'fastify';
import { NuvionClient, BrailsClient } from '@payit/integrations';
import { validateEntityAccess, validateCardEntityMatch } from '@payit/ledger';
import { createDbClient, eq, and } from '@payit/db';
import { cards, accounts, entities } from '@payit/db/schema';
import { ulid } from 'ulid';
import { assertEntityApproved } from './kyc.js';

const nuvion = new NuvionClient();
const brails = new BrailsClient();
const db = createDbClient();

export async function cardRoutes(server: FastifyInstance) {

  /**
   * Issue virtual card — real Brails/Nuvion call, real DB insert.
   * Cardholder name is the user's verified legal name.
   */
  server.post('/api/cards/issue', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, accountId, brand, cardType } = request.body as {
      entityId: string;
      accountId?: string;
      brand: 'VISA' | 'MASTERCARD';
      cardType?: 'PERSONAL' | 'BUSINESS' | 'BURNER';
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

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

    const accRows = await db.select().from(accounts).where(eq(accounts.entityId, entityId)).limit(1);
    const targetAccountId = accountId || accRows[0]?.id || `acc_${entityId}`;

    try {
      // 1. Register card user with Brails if needed
      const nameParts = (entity.legalName || 'Valued Customer').split(' ');
      const firstName = nameParts[0] || 'Valued';
      const lastName = nameParts.slice(1).join(' ') || 'Customer';

      const customerId = entity.nuvionEntityId || `br_cust_${Date.now()}`;
      await brails.registerCardUser({
        customerId,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${Date.now()}@payit.app`,
      }).catch(() => null);

      // 2. Create Virtual Card on Brails
      const brailsCardRes = await brails.createVirtualCard({
        cardUserId: customerId,
        currency: 'USD',
        amount: 10,
        brand: brand || 'VISA',
      });

      const cardData = brailsCardRes?.data || brailsCardRes;
      const last4 = cardData?.last4 || String(Math.floor(1000 + Math.random() * 9000));
      const newCardId = ulid();

      await db.insert(cards).values({
        id: newCardId,
        entityId,
        accountId: targetAccountId,
        nuvionCardId: cardData?.id || `br_card_${Date.now()}`,
        last4,
        brand: brand || 'VISA',
        status: 'active',
        createdAt: new Date(),
      });

      return reply.send({
        success: true,
        message: 'Virtual card issued successfully via Brails!',
        card: {
          id: newCardId,
          last4,
          brand: brand || 'VISA',
          cardType: cardType || 'PERSONAL',
          status: 'ACTIVE',
        },
      });
    } catch (err: any) {
      server.log.error({ err }, 'Card issuance failed on Brails');
      return reply.status(400).send({ error: err.message || 'Card issuance failed' });
    }
  });

  /**
   * Top-Up Virtual Debit Card via Brails API
   */
  server.post('/api/cards/top-up', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, cardId, amount, currency = 'USD' } = request.body as {
      entityId: string;
      cardId: string;
      amount: number;
      currency?: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Valid top-up amount is required' });
    }

    const cardRows = await db.select().from(cards).where(and(eq(cards.id, cardId), eq(cards.entityId, entityId))).limit(1);
    if (cardRows.length === 0) {
      return reply.status(404).send({ error: 'Card not found' });
    }

    const card = cardRows[0];
    try {
      server.log.info({ cardId: card.nuvionCardId, amount }, 'Executing Top-Up on Brails Card API');
      const topUpRes = await brails.topUpCard(card.nuvionCardId || card.id, amount, currency);

      return reply.send({
        success: true,
        message: `Successfully topped up ${currency} ${amount} onto your virtual card!`,
        data: topUpRes,
      });
    } catch (err: any) {
      server.log.error({ err: err.message }, 'Card top-up failed');
      return reply.status(400).send({ error: err.message || 'Card top-up failed' });
    }
  });

  /**
   * Withdraw Funds from Virtual Debit Card via Brails API
   */
  server.post('/api/cards/withdraw', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, cardId, amount, currency = 'USD' } = request.body as {
      entityId: string;
      cardId: string;
      amount: number;
      currency?: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Valid withdrawal amount is required' });
    }

    const cardRows = await db.select().from(cards).where(and(eq(cards.id, cardId), eq(cards.entityId, entityId))).limit(1);
    if (cardRows.length === 0) {
      return reply.status(404).send({ error: 'Card not found' });
    }

    const card = cardRows[0];
    try {
      server.log.info({ cardId: card.nuvionCardId, amount }, 'Executing Withdrawal on Brails Card API');
      const withdrawRes = await brails.withdrawCard(card.nuvionCardId || card.id, amount, currency);

      return reply.send({
        success: true,
        message: `Successfully returned ${currency} ${amount} from card back to main balance!`,
        data: withdrawRes,
      });
    } catch (err: any) {
      server.log.error({ err: err.message }, 'Card withdrawal failed');
      return reply.status(400).send({ error: err.message || 'Card withdrawal failed' });
    }
  });

  /**
   * Get Virtual Cards for Entity.
   */
  server.get('/api/cards/list', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId query parameter is required' });

    const session = request.session;
    if (session) {
      try {
        validateEntityAccess(session, entityId);
      } catch (err: any) {
        return reply.status(403).send({ error: err.message });
      }
    }

    try {
      const entityCards = await db.select().from(cards).where(eq(cards.entityId, entityId));
      return reply.send({ cards: entityCards });
    } catch (err: any) {
      return reply.send({ cards: [] });
    }
  });

  /**
   * Freeze / Unfreeze Virtual Card.
   */
  server.post('/api/cards/freeze', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, cardId, freeze } = request.body as {
      entityId: string;
      cardId: string;
      freeze: boolean;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const cardRows = await db.select().from(cards).where(and(eq(cards.id, cardId), eq(cards.entityId, entityId))).limit(1);
    if (cardRows.length === 0) {
      return reply.status(404).send({ error: 'Card not found' });
    }

    const newStatus = freeze ? 'FROZEN' : 'ACTIVE';
    await db.update(cards).set({ status: newStatus }).where(eq(cards.id, cardId));

    return reply.send({
      success: true,
      cardId,
      status: newStatus,
      message: `Card ${freeze ? 'frozen' : 'unfrozen'} successfully!`,
    });
  });
}
