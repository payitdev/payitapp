import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { createDbClient, eq, and, desc } from '@payit/db';
import { apiKeys, webhookEndpoints, apiLogs, entities, webhookDeliveries } from '@payit/db/schema';
import { WebhookDispatcher } from '../services/webhookDispatcher.js';
import { hashApiKey } from '../middleware/apiKeyAuth.js';
import { validateWebhookUrl } from '../utils/ssrfValidator.js';

const db = createDbClient();

export async function developerRoutes(server: FastifyInstance) {
  /**
   * List active API keys for an entity (redacted)
   */
  server.get('/api/developer/keys', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        environment: apiKeys.environment,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.entityId, entityId), eq(apiKeys.isActive, true)))
      .orderBy(desc(apiKeys.createdAt));

    return reply.send({ success: true, keys });
  });

  /**
   * Generate a new API secret key (returned in full ONCE upon creation)
   */
  server.post('/api/developer/keys', async (request, reply) => {
    const { entityId, name = 'Default API Key', environment = 'live', scopes } = request.body as {
      entityId: string;
      name?: string;
      environment?: 'live' | 'test';
      scopes?: string[];
    };

    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) return reply.status(404).send({ error: 'Entity not found' });

    const randomEntropy = crypto.randomBytes(24).toString('hex');
    const prefix = environment === 'test' ? 'px_test_sk_' : 'px_live_sk_';
    const secretKey = `${prefix}${randomEntropy}`;
    const keyPrefix = secretKey.slice(0, 16);
    const hashedKey = hashApiKey(secretKey);

    const defaultScopes = scopes && scopes.length > 0
      ? scopes
      : ['invoices:all', 'wallets:all', 'payouts:all', 'reports:all', 'treasury:all'];

    const keyId = ulid();

    await db.insert(apiKeys).values({
      id: keyId,
      entityId,
      name: name.trim(),
      keyPrefix,
      hashedKey,
      environment: environment === 'test' ? 'test' : 'live',
      scopes: JSON.stringify(defaultScopes),
      isActive: true,
    });

    return reply.send({
      success: true,
      message: 'API Key generated successfully. Save this secret key now; you will not be able to view it again.',
      apiKey: {
        id: keyId,
        name: name.trim(),
        secretKey, // Returned ONLY on creation
        keyPrefix,
        environment,
        scopes: defaultScopes,
      },
    });
  });

  /**
   * Revoke an API key
   */
  server.delete('/api/developer/keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.entityId, entityId)));

    return reply.send({ success: true, message: 'API key revoked successfully' });
  });

  /**
   * List webhook endpoints
   */
  server.get('/api/developer/webhooks', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.entityId, entityId))
      .orderBy(desc(webhookEndpoints.createdAt));

    return reply.send({ success: true, endpoints });
  });

  /**
   * Register a new webhook endpoint
   */
  server.post('/api/developer/webhooks', async (request, reply) => {
    const { entityId, url, events } = request.body as {
      entityId: string;
      url: string;
      events?: string[];
    };

    if (!entityId || !url) {
      return reply.status(400).send({ error: 'entityId and url are required' });
    }

    // SSRF Security Check
    const urlValidation = await validateWebhookUrl(url.trim());
    if (!urlValidation.valid) {
      return reply.status(400).send({
        error: `SSRF Security Error: ${urlValidation.error}`,
      });
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const endpointId = ulid();
    const defaultEvents = events && events.length > 0
      ? events
      : ['invoice.paid', 'payout.completed', 'deposit.detected', 'treasury.swept'];

    await db.insert(webhookEndpoints).values({
      id: endpointId,
      entityId,
      url: url.trim(),
      secret,
      events: JSON.stringify(defaultEvents),
      isActive: true,
    });

    return reply.send({
      success: true,
      message: 'Webhook endpoint registered successfully',
      endpoint: {
        id: endpointId,
        url: url.trim(),
        secret,
        events: defaultEvents,
      },
    });
  });

  /**
   * Delete a webhook endpoint
   */
  server.delete('/api/developer/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    await db
      .delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.entityId, entityId)));

    return reply.send({ success: true, message: 'Webhook endpoint deleted.' });
  });

  /**
   * Trigger a test ping event
   */
  server.post('/api/developer/webhooks/test-ping', async (request, reply) => {
    const { entityId, event = 'invoice.paid' } = request.body as {
      entityId: string;
      event?: any;
    };

    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const testData = {
      test: true,
      simulatedAt: new Date().toISOString(),
      invoiceId: `test_inv_${ulid()}`,
      amount: 150.00,
      currency: 'USD',
      customer: 'Test Developer Ltd',
      network: 'Base',
    };

    await WebhookDispatcher.dispatchEvent(entityId, event, testData);

    return reply.send({
      success: true,
      message: `Simulated event '${event}' dispatched with test payload and HMAC signature.`,
      testData,
    });
  });

  /**
   * List webhook outbox deliveries
   */
  server.get('/api/developer/webhooks/deliveries', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.entityId, entityId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(50);

    return reply.send({ success: true, deliveries });
  });

  /**
   * Replay / resend a failed or past webhook delivery
   */
  server.post('/api/developer/webhooks/deliveries/:id/resend', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await WebhookDispatcher.replayDelivery(id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Get recent API Request Logs for telemetry & debugging
   */
  server.get('/api/developer/logs', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const logs = await db
      .select()
      .from(apiLogs)
      .where(eq(apiLogs.entityId, entityId))
      .orderBy(desc(apiLogs.createdAt))
      .limit(50);

    return reply.send({ success: true, logs });
  });

  /**
   * Get Developer / SME Entity Billing Profile
   */
  server.get('/api/developer/billing/profile', async (request, reply) => {
    const { FeeEngine } = await import('../utils/feeEngine.js');
    const { entityId = 'default_entity' } = request.query as { entityId: string };
    const profile = FeeEngine.getProfile(entityId);
    return reply.send({ success: true, profile });
  });

  /**
   * Update Developer / SME Entity Billing Profile (Switch Plan / Modules)
   */
  server.post('/api/developer/billing/profile', async (request, reply) => {
    const { FeeEngine } = await import('../utils/feeEngine.js');
    const { entityId = 'default_entity', plan = 'PAY_AS_YOU_GO', activeModules = [] } = request.body as {
      entityId?: string;
      plan: 'PAY_AS_YOU_GO' | 'MODULAR_SAAS';
      activeModules: any[];
    };

    const updated = FeeEngine.updateProfile(entityId, plan, activeModules);
    return reply.send({
      success: true,
      message: `Billing profile updated to '${plan}'. Anti-double-charging protections are active.`,
      profile: updated,
    });
  });
}
