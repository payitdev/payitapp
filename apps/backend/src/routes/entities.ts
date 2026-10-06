import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and } from '@payit/db';
import { entities } from '@payit/db/schema';

const db = createDbClient();

export async function entityRoutes(server: FastifyInstance) {

  /**
   * Switch active entity context — validates entity belongs to the user in DB.
   */
  server.post('/api/entities/switch-context', async (request, reply) => {
    const session = request.session;
    if (!session?.userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { targetEntityId, entityId } = (request.body || {}) as { targetEntityId?: string; entityId?: string };
    const target = targetEntityId ?? entityId;
    if (!target) {
      return reply.status(400).send({ error: 'targetEntityId is required' });
    }

    // Verify the target entity belongs to the authenticated user (userId
    // comes from the verified session, never from the request body).
    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, target), eq(entities.userId, session.userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(403).send({ error: 'Target entity does not belong to this user' });
    }

    return reply.send({
      activeEntityId: target,
      activeEntityKind: entityRows[0].kind,
      message: `Active session context switched to ${entityRows[0].kind} entity`,
    });
  });

  /**
   * Get all entities for a user from DB.
   */
  server.get('/api/entities', async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.status(400).send({ error: 'userId query parameter required' });

    const userEntities = await db
      .select()
      .from(entities)
      .where(eq(entities.userId, userId));

    return reply.send({ entities: userEntities });
  });
}
