import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { createDbClient, eq } from '@payit/db';
import { entities } from '@payit/db/schema';
import { env } from '../env.js';

const db = createDbClient();

export interface VerifiedSession {
  userId: string;
  email: string;
  activeEntityId: string;
  userEntityIds: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: VerifiedSession;
    rawBody?: string | Buffer;
  }
}

const PUBLIC_PREFIXES = [
  '/health',
  '/favicon.ico',
  '/api/auth/',
  '/webhooks/',
  '/api/waitlist',
  '/api/invoices/public/',
  '/api/schools/applications',
  '/v1',
  '/v1/',
  '/api/fx/rates',
  '/api/transfers/fx-quote',
  '/api/users/check-username',
  '/api/pods/strategies',
  '/api/pods/base-strategies',
  '/api/intents/supported-tokens',
];


const userEntitiesCache = new Map<string, { entities: any[]; expiresAt: number }>();

export async function requireAuthHook(request: FastifyRequest, reply: FastifyReply) {
  const url = request.url.split('?')[0];

  // Allow public routes
  if (PUBLIC_PREFIXES.some(prefix => url.startsWith(prefix))) {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Authentication required. Missing or malformed Bearer token.' });
  }

  const token = authHeader.slice(7);

  let payload: { userId: string; email: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
  } catch (jwtErr: any) {
    return reply.status(401).send({ error: 'Invalid or expired session token. Please sign in again.' });
  }

  let userEntities: any[] = [];
  const cached = userEntitiesCache.get(payload.userId);
  if (cached && cached.expiresAt > Date.now()) {
    userEntities = cached.entities;
  } else {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        userEntities = await db.select().from(entities).where(eq(entities.userId, payload.userId));
        if (userEntities.length > 0) {
          userEntitiesCache.set(payload.userId, { entities: userEntities, expiresAt: Date.now() + 60000 });
          break;
        }
      } catch (dbErr: any) {
        if (attempt === 2) {
          console.warn('[requireAuth DB Connection Retry Warning]:', dbErr.message);
          return reply.status(503).send({ error: 'Database service is temporarily reconnecting. Please retry.' });
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  if (userEntities.length === 0) {
    return reply.status(401).send({ error: 'User session entity not found' });
  }

  const userEntityIds = userEntities.map(e => e.id);
  const headerEntityId = (request.headers['x-entity-id'] || request.headers['X-Entity-Id']) as string | undefined;

  let activeEntityId = userEntities[0]?.id || '';
  if (headerEntityId && userEntityIds.includes(headerEntityId)) {
    activeEntityId = headerEntityId;
  }

  request.session = {
    userId: payload.userId,
    email: payload.email,
    activeEntityId,
    userEntityIds,
  };

  const query = request.query as Record<string, any> | undefined;
  const body = request.body as Record<string, any> | undefined;
  const requestedUserId = body?.userId || query?.userId;
  if (requestedUserId && requestedUserId !== payload.userId) {
    return reply.status(403).send({ error: 'The requested user does not match the authenticated session' });
  }

  const requestedEntityId = body?.entityId || query?.entityId;
  if (requestedEntityId && !userEntityIds.includes(String(requestedEntityId))) {
    return reply.status(403).send({ error: 'The requested entity does not belong to the authenticated session' });
  }

  // Protect against client-supplied session injection in request body
  if (body) {
    delete body.session;
    delete body.userId;
    delete body.userEntityIds;
  }
}
