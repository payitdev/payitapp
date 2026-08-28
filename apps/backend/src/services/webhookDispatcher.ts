import crypto from 'crypto';
import { ulid } from 'ulid';
import { createDbClient, eq, and, lte, or } from '@payit/db';
import { webhookEndpoints, webhookDeliveries } from '@payit/db/schema';
import { validateWebhookUrl } from '../utils/ssrfValidator.js';

const db = createDbClient();

export interface WebhookEventPayload {
  id: string;
  event: 'invoice.paid' | 'payout.completed' | 'deposit.detected' | 'treasury.swept';
  entityId: string;
  timestamp: string;
  data: Record<string, any>;
}

// Exponential backoff intervals in milliseconds: 1m, 5m, 15m, 1h, 6h
const RETRY_INTERVALS_MS = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
];

export class WebhookDispatcher {
  /**
   * Dispatch a signed webhook event to all active endpoints registered for the given entity
   * Uses Durable Outbox pattern with persistent delivery logs and automatic retry scheduling.
   */
  public static async dispatchEvent(entityId: string, event: WebhookEventPayload['event'], data: Record<string, any>) {
    try {
      const endpoints = await db
        .select()
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.entityId, entityId), eq(webhookEndpoints.isActive, true)));

      if (endpoints.length === 0) return;

      const eventPayload: WebhookEventPayload = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        event,
        entityId,
        timestamp: new Date().toISOString(),
        data,
      };

      const payloadString = JSON.stringify(eventPayload);
      const timestamp = Math.floor(Date.now() / 1000).toString();

      for (const endpoint of endpoints) {
        // Verify event subscription filter
        let subscribedEvents: string[] = [];
        try {
          subscribedEvents = JSON.parse(endpoint.events || '[]');
        } catch {
          subscribedEvents = ['*'];
        }

        if (!subscribedEvents.includes('*') && !subscribedEvents.includes(event)) {
          continue;
        }

        const signaturePayload = `${timestamp}.${payloadString}`;
        const signature = crypto
          .createHmac('sha256', endpoint.secret)
          .update(signaturePayload)
          .digest('hex');

        const deliveryId = ulid();

        // 1. Record Outbox Delivery Log
        await db.insert(webhookDeliveries).values({
          id: deliveryId,
          entityId,
          webhookEndpointId: endpoint.id,
          event,
          payload: payloadString,
          signature: `t=${timestamp},v1=${signature}`,
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
          createdAt: new Date(),
        });

        // 2. Perform Initial Delivery Attempt Asynchronously
        setImmediate(async () => {
          await this.executeDeliveryAttempt(deliveryId, endpoint.url, payloadString, timestamp, signature, 1);
        });
      }
    } catch (err: any) {
      console.warn('[Webhook Dispatcher Error]:', err.message);
    }
  }

  /**
   * Execute single delivery attempt with timeout and update outbox status
   */
  public static async executeDeliveryAttempt(
    deliveryId: string,
    url: string,
    payloadString: string,
    timestamp: string,
    signature: string,
    attemptNumber: number
  ) {
    try {
      // Dynamic SSRF & DNS Rebinding Security Check
      const validation = await validateWebhookUrl(url);
      if (!validation.valid) {
        await db
          .update(webhookDeliveries)
          .set({
            status: 'FAILED',
            attempts: attemptNumber,
            lastAttemptAt: new Date(),
            nextAttemptAt: null,
            errorMessage: `SSRF Security Violation: ${validation.error}`,
          })
          .where(eq(webhookDeliveries.id, deliveryId));
        return;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Proxim-Webhook/1.0',
          'X-Proxim-Signature': `t=${timestamp},v1=${signature}`,
          'X-Proxim-Delivery-Attempt': String(attemptNumber),
        },
        body: payloadString,
        signal: AbortSignal.timeout(6000), // 6s timeout
      });

      const responseText = await response.text().catch(() => '');

      if (response.ok) {
        // Success (2xx status)
        await db
          .update(webhookDeliveries)
          .set({
            status: 'DELIVERED',
            attempts: attemptNumber,
            lastAttemptAt: new Date(),
            nextAttemptAt: null,
            responseStatus: response.status,
            responseBody: responseText.slice(0, 1000),
            errorMessage: null,
          })
          .where(eq(webhookDeliveries.id, deliveryId));
      } else {
        // Partner server returned non-2xx error
        await this.handleDeliveryFailure(deliveryId, attemptNumber, response.status, responseText, `HTTP ${response.status}`);
      }
    } catch (err: any) {
      // Network error, DNS failure, or timeout
      await this.handleDeliveryFailure(deliveryId, attemptNumber, 0, null, err.message);
    }
  }

  /**
   * Handle delivery failure and schedule exponential backoff retry
   */
  private static async handleDeliveryFailure(
    deliveryId: string,
    attemptNumber: number,
    responseStatus: number,
    responseBody: string | null,
    errorMessage: string
  ) {
    const maxAttempts = 5;
    const isFinalFailure = attemptNumber >= maxAttempts;
    const nextRetryDelay = RETRY_INTERVALS_MS[attemptNumber - 1] || (6 * 60 * 60 * 1000);
    const nextAttemptAt = isFinalFailure ? null : new Date(Date.now() + nextRetryDelay);

    await db
      .update(webhookDeliveries)
      .set({
        status: isFinalFailure ? 'FAILED' : 'RETRYING',
        attempts: attemptNumber,
        lastAttemptAt: new Date(),
        nextAttemptAt,
        responseStatus,
        responseBody: responseBody ? responseBody.slice(0, 1000) : null,
        errorMessage,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  }

  /**
   * Process all pending retries due for execution (Background Cron Worker)
   */
  public static async processPendingRetries() {
    try {
      const now = new Date();
      const pendingDeliveries = await db
        .select({
          delivery: webhookDeliveries,
          endpointUrl: webhookEndpoints.url,
          endpointSecret: webhookEndpoints.secret,
        })
        .from(webhookDeliveries)
        .innerJoin(webhookEndpoints, eq(webhookDeliveries.webhookEndpointId, webhookEndpoints.id))
        .where(
          and(
            or(eq(webhookDeliveries.status, 'RETRYING'), eq(webhookDeliveries.status, 'PENDING')),
            lte(webhookDeliveries.nextAttemptAt, now)
          )
        )
        .limit(25);

      for (const item of pendingDeliveries) {
        try {
          const { delivery, endpointUrl, endpointSecret } = item;
          const nextAttempt = delivery.attempts + 1;
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const signaturePayload = `${timestamp}.${delivery.payload}`;
          const signature = crypto
            .createHmac('sha256', endpointSecret)
            .update(signaturePayload)
            .digest('hex');

          await this.executeDeliveryAttempt(delivery.id, endpointUrl, delivery.payload, timestamp, signature, nextAttempt);
        } catch {}
      }
    } catch {}
  }

  /**
   * Manual developer replay / resend from Dashboard
   */
  public static async replayDelivery(deliveryId: string) {
    const rows = await db
      .select({
        delivery: webhookDeliveries,
        endpointUrl: webhookEndpoints.url,
        endpointSecret: webhookEndpoints.secret,
      })
      .from(webhookDeliveries)
      .innerJoin(webhookEndpoints, eq(webhookDeliveries.webhookEndpointId, webhookEndpoints.id))
      .where(eq(webhookDeliveries.id, deliveryId))
      .limit(1);

    if (rows.length === 0) throw new Error('Delivery record not found.');
    const { delivery, endpointUrl, endpointSecret } = rows[0];

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signaturePayload = `${timestamp}.${delivery.payload}`;
    const signature = crypto
      .createHmac('sha256', endpointSecret)
      .update(signaturePayload)
      .digest('hex');

    await this.executeDeliveryAttempt(delivery.id, endpointUrl, delivery.payload, timestamp, signature, delivery.attempts + 1);
    return { success: true, message: 'Replay initiated.' };
  }
}
