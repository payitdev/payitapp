import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { entities } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();
const cardStore = new Map<string, any>();

export async function cardRoutes(server: FastifyInstance) {

  /**
   * List Virtual Cards for an Entity
   */
  server.get('/api/cards', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const cards = Array.from(cardStore.values()).filter(c => c.entityId === entityId);
    return reply.send({ success: true, cards });
  });

  /**
   * Issue Virtual Card for Proxim
   */
  server.post('/api/cards/issue', async (request, reply) => {
    const { entityId, brand = 'VISA', cardType = 'PERSONAL' } = request.body as {
      entityId: string;
      brand?: 'VISA' | 'MASTERCARD';
      cardType?: 'PERSONAL' | 'BUSINESS' | 'BURNER';
    };

    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) return reply.status(404).send({ error: 'Entity not found' });

    const entity = entityRows[0];
    const cardId = ulid();
    const last4 = String(Math.floor(1000 + Math.random() * 9000));

    const card = {
      id: cardId,
      entityId,
      brand,
      cardType,
      last4,
      cardholderName: entity.legalName,
      status: 'ACTIVE',
      currency: 'USD',
      balance: 0,
      createdAt: new Date().toISOString(),
    };

    cardStore.set(cardId, card);

    return reply.send({
      success: true,
      card,
    });
  });

  /**
   * Freeze / Unfreeze Virtual Card
   */
  server.post('/api/cards/freeze', async (request, reply) => {
    const { entityId, cardId, freeze } = request.body as {
      entityId: string;
      cardId: string;
      freeze?: boolean;
    };

    if (!cardId) return reply.status(400).send({ error: 'cardId is required' });

    const card = cardStore.get(cardId);
    if (card) {
      card.status = freeze ? 'FROZEN' : 'ACTIVE';
      cardStore.set(cardId, card);
    }

    return reply.send({
      success: true,
      cardId,
      status: freeze ? 'FROZEN' : 'ACTIVE',
    });
  });

  /**
   * Top up Virtual Card
   */
  server.post('/api/cards/top-up', async (request, reply) => {
    const { entityId, cardId, amount, currency = 'USD' } = request.body as {
      entityId: string;
      cardId: string;
      amount: number;
      currency?: string;
    };

    if (!cardId || !amount) return reply.status(400).send({ error: 'cardId and amount are required' });

    const card = cardStore.get(cardId);
    if (card) {
      card.balance = (card.balance || 0) + Number(amount);
      cardStore.set(cardId, card);
    }

    return reply.send({
      success: true,
      cardId,
      amount,
      currency,
      newBalance: card ? card.balance : amount,
    });
  });

  /**
   * Withdraw from Virtual Card back to balance
   */
  server.post('/api/cards/withdraw', async (request, reply) => {
    const { entityId, cardId, amount, currency = 'USD' } = request.body as {
      entityId: string;
      cardId: string;
      amount: number;
      currency?: string;
    };

    if (!cardId || !amount) return reply.status(400).send({ error: 'cardId and amount are required' });

    const card = cardStore.get(cardId);
    if (card) {
      card.balance = Math.max(0, (card.balance || 0) - Number(amount));
      cardStore.set(cardId, card);
    }

    return reply.send({
      success: true,
      cardId,
      amount,
      currency,
      newBalance: card ? card.balance : 0,
    });
  });
}
