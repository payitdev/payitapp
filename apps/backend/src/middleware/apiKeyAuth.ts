import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { createDbClient, eq, and, or } from '@payit/db';
import { apiKeys, entities, apiLogs } from '@payit/db/schema';

const db = createDbClient();
const API_KEY_PEPPER = process.env.API_KEY_PEPPER || 'proxim_enterprise_vault_pepper_2026';

export interface ApiAuthContext {
  apiKeyId: string;
  entityId: string;
  environment: 'live' | 'test';
  scopes: string[];
  entity: any;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiAuth?: ApiAuthContext;
    requestStartTime?: number;
  }
}

// In-Memory Token Bucket Rate Limiter
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}
const rateLimitBuckets = new Map<string, RateLimitBucket>();

const MAX_TOKENS_PER_MINUTE = 120;
const DERIVE_MAX_TOKENS_PER_MINUTE = 25;

// Super Admin circuit breaker overrides
export const entityStatusOverrides = new Map<
  string,
  { status: 'ACTIVE' | 'THROTTLED' | 'SUSPENDED_PAYOUTS' | 'FROZEN'; reason?: string; updatedAt: string }
>();

export function hashApiKey(rawKey: string): string {
  // HMAC-SHA256 with Pepper for server-side key stretching & database leak protection
  return crypto.createHmac('sha256', API_KEY_PEPPER).update(rawKey).digest('hex');
}

/**
 * Middleware for authenticating Developer & BaaS API requests via Bearer API Keys (px_live_sk_... / px_test_sk_...)
 * Enforces Peppered Hashing, Scoped Permissions, and Token-Bucket Rate Limiting.
 */
export async function requireApiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  request.requestStartTime = Date.now();
  const path = request.url.split('?')[0];

  // Allow public root discovery endpoint
  if (path === '/v1' || path === '/v1/') {
    return;
  }

  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header. Pass your API secret key as `Bearer px_live_sk_...` or `Bearer px_test_sk_...`.',
        doc_url: 'https://proxim.finance/developers#authentication',
      },
    });
  }

  const rawKey = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!rawKey.startsWith('px_live_sk_') && !rawKey.startsWith('px_test_sk_')) {
    return reply.status(401).send({
      error: {
        code: 'INVALID_API_KEY_FORMAT',
        message: 'API keys must begin with `px_live_sk_` (Production) or `px_test_sk_` (Sandbox).',
        doc_url: 'https://proxim.finance/developers#authentication',
      },
    });
  }

  const hashedKey = crypto
    .createHmac('sha256', API_KEY_PEPPER)
    .update(rawKey)
    .digest('hex');

  const keyRows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.hashedKey, hashedKey), eq(apiKeys.isActive, true)))
    .limit(1);

  if (keyRows.length === 0) {
    return reply.status(401).send({
      error: {
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid, inactive, or has been revoked.',
        doc_url: 'https://proxim.finance/developers#authentication',
      },
    });
  }

  const keyRecord = keyRows[0];

  // Super Admin Circuit Breaker Check
  const override = entityStatusOverrides.get(keyRecord.entityId);
  if (override) {
    if (override.status === 'FROZEN') {
      return reply.status(403).send({
        error: {
          code: 'ENTITY_FROZEN',
          message: `API access for this account has been suspended by Proxim Security: ${override.reason || 'Security hold'}.`,
          doc_url: 'https://proxim.finance/support',
        },
      });
    }
    if (override.status === 'SUSPENDED_PAYOUTS' && request.url.includes('/payouts')) {
      return reply.status(403).send({
        error: {
          code: 'PAYOUTS_SUSPENDED',
          message: `Outbound disbursements for this account are temporarily paused by Proxim Compliance: ${override.reason || 'Disbursal hold'}.`,
          doc_url: 'https://proxim.finance/support',
        },
      });
    }
  }

  // Fetch associated business entity
  const entityRows = await db.select().from(entities).where(eq(entities.id, keyRecord.entityId)).limit(1);
  if (entityRows.length === 0) {
    return reply.status(403).send({
      error: { code: 'ENTITY_NOT_FOUND', message: 'Associated business entity not found.' },
    });
  }

  let parsedScopes: string[] = [];
  try {
    parsedScopes = JSON.parse(keyRecord.scopes || '[]');
  } catch {
    parsedScopes = ['all'];
  }

  // Rate Limiting Check (Token Bucket)
  const isDeriveRoute = request.url.includes('/wallets/derive');
  let capacity = isDeriveRoute ? DERIVE_MAX_TOKENS_PER_MINUTE : MAX_TOKENS_PER_MINUTE;
  if (override?.status === 'THROTTLED') {
    capacity = 5; // Throttle malicious/spamming entities to 5 req/min
  }
  const now = Date.now();
  const bucketKey = `${keyRecord.id}_${isDeriveRoute ? 'derive' : 'std'}`;

  let bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    rateLimitBuckets.set(bucketKey, bucket);
  } else {
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const refillRate = capacity / 60; // Tokens per second
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillRate);
    bucket.lastRefill = now;
  }

  const resetSeconds = Math.ceil(60 - ((now % 60000) / 1000));
  reply.header('X-RateLimit-Limit', capacity);
  reply.header('X-RateLimit-Remaining', Math.max(0, Math.floor(bucket.tokens)));
  reply.header('X-RateLimit-Reset', Math.floor(now / 1000) + resetSeconds);

  if (bucket.tokens < 1) {
    reply.header('Retry-After', resetSeconds);
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `API rate limit exceeded (${capacity} requests per minute). Please retry in ${resetSeconds} seconds.`,
        retryAfterSeconds: resetSeconds,
        doc_url: 'https://proxim.finance/developers#rate-limits',
      },
    });
  }

  bucket.tokens -= 1;

  request.apiAuth = {
    apiKeyId: keyRecord.id,
    entityId: keyRecord.entityId,
    environment: keyRecord.environment as 'live' | 'test',
    scopes: parsedScopes,
    entity: entityRows[0],
  };

  // Strict Multi-Tenant Isolation: Block cross-tenant impersonation & sanitize body
  if (request.body && typeof request.body === 'object') {
    const body = request.body as Record<string, any>;
    if (body.entityId && body.entityId !== keyRecord.entityId) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN_ENTITY_ACCESS',
          message: 'Cross-tenant impersonation attempt detected. The provided entityId does not match your API key.',
          doc_url: 'https://proxim.finance/developers#errors',
        },
      });
    }
    body.entityId = keyRecord.entityId;
  }

  // Update lastUsedAt asynchronously
  setImmediate(async () => {
    try {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id));
    } catch {}
  });
}

/**
 * Hook to log API request metrics into apiLogs table
 */
export async function logApiRequestMetrics(request: FastifyRequest, reply: FastifyReply) {
  if (!request.apiAuth) return;

  const durationMs = request.requestStartTime ? Date.now() - request.requestStartTime : 0;
  const ipAddress = (request.headers['x-forwarded-for'] as string) || request.ip || '127.0.0.1';

  try {
    await db.insert(apiLogs).values({
      id: ulid(),
      entityId: request.apiAuth.entityId,
      apiKeyId: request.apiAuth.apiKeyId,
      method: request.method,
      endpoint: request.url.split('?')[0],
      statusCode: reply.statusCode,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress.split(',')[0].trim(),
      durationMs,
    });
  } catch (err: any) {
    console.warn('[API Log Note]:', err.message);
  }
}
