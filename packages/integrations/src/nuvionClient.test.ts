import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyNuvionWebhookSignature, NuvionClient, NUVION_API_VERSION } from './nuvionClient';

describe('Nuvion Integration Tests', () => {
  it('has pinned API version 2026-02-06', () => {
    assert.equal(NUVION_API_VERSION, '2026-02-06');
  });

  it('correctly validates webhook HMAC-SHA256 signature with timingSafeEqual', () => {
    const secret = 'whsec_test_secret_key_12345';
    const timestamp = String(Date.now());
    const rawBody = JSON.stringify({
      event: 'entities.updated',
      data: { id: '01HXYZ1234567890', status: 'approved' },
    });

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const isValid = verifyNuvionWebhookSignature(rawBody, expectedSignature, timestamp, secret);
    assert.equal(isValid, true);
  });

  it('rejects tampered webhook payloads or invalid signatures', () => {
    const secret = 'whsec_test_secret_key_12345';
    const timestamp = String(Date.now());
    const rawBody = JSON.stringify({ event: 'entities.updated', data: { status: 'approved' } });
    const tamperedBody = JSON.stringify({ event: 'entities.updated', data: { status: 'rejected' } });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const isValid = verifyNuvionWebhookSignature(tamperedBody, signature, timestamp, secret);
    assert.equal(isValid, false);
  });

  it('rejects expired webhook timestamps beyond tolerance', () => {
    const secret = 'whsec_test_secret_key_12345';
    const oldTimestamp = String(Date.now() - 600000); // 10 minutes ago
    const rawBody = JSON.stringify({ event: 'inflows.completed' });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${oldTimestamp}.${rawBody}`)
      .digest('hex');

    const isValid = verifyNuvionWebhookSignature(rawBody, signature, oldTimestamp, secret, 300000);
    assert.equal(isValid, false);
  });

  it('instantiates NuvionClient with custom options', () => {
    const client = new NuvionClient({
      apiKey: 'nv_test_key',
      baseUrl: 'https://api.nuvion.dev',
      apiVersion: '2026-02-06',
    });
    assert.ok(client);
  });
});
