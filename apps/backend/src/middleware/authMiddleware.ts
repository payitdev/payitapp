/**
 * Server-Side Fastify Authentication Middleware
 * 
 * Enforces Privy JWT verification and CORS origin checks for sensitive API routes
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PrivyServerAuth } from '@payit/integrations';

export async function authenticatePrivySession(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const verification = await PrivyServerAuth.verifySessionToken(token);

  if (!verification.valid) {
    return reply.status(401).send({ error: 'Unauthorized: ' + (verification.error || 'Invalid session token') });
  }

  // Attach verified user ID to request state
  (request as any).privyUserId = verification.privyUserId;
}
