import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and } from '@payit/db';
import { entities } from '@payit/db/schema';

const db = createDbClient();

export async function entityRoutes(server: FastifyInstance) {

  /**
   * Switch active entity context — validates entity belongs to the user in DB.
   */
  server.post('/api/entities/switch-context', async (request, reply) => {
    const { userId, targetEntityId } = request.body as { userId: string; targetEntityId: string };

    if (!userId || !targetEntityId) {
      return reply.status(400).send({ error: 'userId and targetEntityId are required' });
    }

    // Verify the target entity belongs to this user
    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, targetEntityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(403).send({ error: 'Target entity does not belong to this user' });
    }

    return reply.send({
      activeEntityId: targetEntityId,
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
