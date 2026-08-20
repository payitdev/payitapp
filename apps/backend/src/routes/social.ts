import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, sql } from '@payit/db';
import { entities, contacts } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();
const friendRequestStore = new Map<string, any>();

export async function socialRoutes(server: FastifyInstance) {

  /**
   * Real-time Username Availability Check
   */
  server.get('/api/users/check-username', async (request, reply) => {
    const { username } = request.query as { username?: string };
    if (!username) return reply.status(400).send({ available: false, error: 'Username is required' });

    const clean = username.replace(/^@/, '').toLowerCase().trim();
    const existing = await db
      .select()
      .from(entities)
      .where(sql`LOWER(${entities.username}) = LOWER(${clean})`)
      .limit(1);

    if (existing.length > 0) {
      return reply.send({ available: false, message: 'Username is taken' });
    }

    return reply.send({ available: true, username: `@${clean}`, message: 'Username is available' });
  });

  /**
   * Resolve PayIT / Proxim User Identity for Payment Requests & Transfers
   */
  server.get('/api/users/resolve-identity', async (request, reply) => {
    const { query, entityId } = request.query as { query?: string; entityId?: string };
    if (!query) return reply.status(400).send({ found: false, error: 'Query is required' });

    const clean = query.replace(/^@/, '').toLowerCase().trim();
    const matched = await db
      .select({
        id: entities.id,
        legalName: entities.legalName,
        username: entities.username,
        kind: entities.kind,
        dueStatus: entities.dueStatus,
        evmDepositAddress: entities.evmDepositAddress,
      })
      .from(entities)
      .where(sql`LOWER(${entities.username}) = LOWER(${clean}) OR LOWER(${entities.legalName}) = LOWER(${clean}) OR ${entities.id} = ${clean}`)
      .limit(1);

    if (matched.length === 0) {
      return reply.send({
        found: false,
        message: 'Proxim user not found',
      });
    }

    const foundEntity = matched[0];
    let isMutualContact = false;

    if (entityId) {
      const contactRows = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.entityId, entityId), eq(contacts.targetEntityId, foundEntity.id)))
        .limit(1);
      isMutualContact = contactRows.length > 0;
    }

    return reply.send({
      found: true,
      identity: {
        entityId: foundEntity.id,
        legalName: foundEntity.legalName,
        username: foundEntity.username || clean,
        kind: foundEntity.kind,
        verified: foundEntity.dueStatus === 'approved',
        isMutualContact,
      },
    });
  });

  /**
   * One-time Username Customization Update
   */
  server.post('/api/users/update-username', async (request, reply) => {
    const { entityId, newUsername } = request.body as { entityId: string; newUsername: string };
    if (!entityId || !newUsername) return reply.status(400).send({ error: 'entityId and newUsername are required' });

    const clean = newUsername.replace(/^@/, '').toLowerCase().trim();
    const existing = await db
      .select()
      .from(entities)
      .where(sql`LOWER(${entities.username}) = LOWER(${clean}) AND ${entities.id} != ${entityId}`)
      .limit(1);

    if (existing.length > 0) {
      return reply.status(400).send({ error: 'Username is already taken' });
    }

    await db
      .update(entities)
      .set({ username: clean, usernameCustomized: 1 })
      .where(eq(entities.id, entityId));

    return reply.send({ success: true, username: clean });
  });

  /**
   * Search Proxim Users by Paytag / Username
   */
  server.get('/api/users/search', async (request, reply) => {
    const { query } = request.query as { query?: string };
    if (!query || query.length < 2) return reply.send({ users: [] });

    const clean = query.replace(/^@/, '').toLowerCase().trim();
    const matched = await db
      .select({
        id: entities.id,
        legalName: entities.legalName,
        username: entities.username,
        kind: entities.kind,
      })
      .from(entities)
      .where(sql`LOWER(${entities.username}) LIKE LOWER(${'%' + clean + '%'})`)
      .limit(10);

    return reply.send({ success: true, users: matched });
  });

  /**
   * List Friends / Contacts for an Entity
   */
  server.get('/api/friends/list', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const contactList = await db.select().from(contacts).where(eq(contacts.entityId, entityId));
    return reply.send({ success: true, friends: contactList });
  });

  /**
   * Send Friend Request
   */
  server.post('/api/friends/request', async (request, reply) => {
    const { entityId, targetUsername } = request.body as { entityId: string; targetUsername: string };
    if (!entityId || !targetUsername) return reply.status(400).send({ error: 'entityId and targetUsername are required' });

    const clean = targetUsername.replace(/^@/, '').toLowerCase().trim();
    const targetRows = await db.select().from(entities).where(sql`LOWER(${entities.username}) = LOWER(${clean})`).limit(1);

    if (targetRows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const target = targetRows[0];
    const requestId = ulid();
    friendRequestStore.set(requestId, { id: requestId, senderEntityId: entityId, targetEntityId: target.id, status: 'PENDING' });

    return reply.send({ success: true, message: 'Friend request sent', requestId });
  });

  /**
   * List Saved Contacts / Beneficiaries for an Entity
   */
  server.get('/api/contacts', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const contactList = await db.select().from(contacts).where(eq(contacts.entityId, entityId));
    return reply.send({ success: true, contacts: contactList });
  });

  /**
   * Add Saved Contact
   */
  server.post('/api/contacts', async (request, reply) => {
    const { entityId, name, paytag, accountNumber, bankName, phoneOrMomo, type = 'EXTERNAL' } = request.body as {
      entityId: string;
      name: string;
      paytag?: string;
      accountNumber?: string;
      bankName?: string;
      phoneOrMomo?: string;
      type?: 'INTERNAL' | 'EXTERNAL';
    };

    if (!entityId || !name) return reply.status(400).send({ error: 'entityId and name are required' });

    const contactId = ulid();
    await db.insert(contacts).values({
      id: contactId,
      entityId,
      name,
      paytag,
      accountNumber,
      bankName,
      phoneOrMomo,
      type,
    });

    return reply.send({ success: true, contactId });
  });
}
