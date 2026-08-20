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
    rawBody?: string;
  }
}

const PUBLIC_PREFIXES = [
  '/health',
  '/api/auth/',
  '/webhooks/',
  '/api/waitlist',
  '/api/invoices/public/',
  '/api/fx/rates',
  '/api/users/check-username',
  '/api/kamino/',
  '/api/ondo/',
  '/api/pods/',
  '/api/intents/',
  '/api/admin/',
  '/api/dev/',
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

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
    
    let userEntities: any[] = [];
    const cached = userEntitiesCache.get(payload.userId);
    if (cached && cached.expiresAt > Date.now()) {
      userEntities = cached.entities;
    } else {
      userEntities = await db.select().from(entities).where(eq(entities.userId, payload.userId));
      if (userEntities.length > 0) {
        userEntitiesCache.set(payload.userId, { entities: userEntities, expiresAt: Date.now() + 60000 });
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

    // Protect against client-supplied session injection in request body
    if (request.body && typeof request.body === 'object') {
      const body = request.body as Record<string, any>;
      delete body.session;
      delete body.userId;
      delete body.userEntityIds;
    }
  } catch (err: any) {
    return reply.status(401).send({ error: 'Invalid or expired session token. Please sign in again.' });
  }
}
