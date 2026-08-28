import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EaseIDClient } from './easeIdClient.js';

test('EaseIDClient derivePublicFingerprint works for a valid PKCS#8 private key', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 65537,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const client = new EaseIDClient(privateKey.toString(), 'https://api.easeid.ai');
  const fingerprint = (client as any).derivePublicFingerprint();

  assert.equal(typeof fingerprint, 'string');
  assert.match(fingerprint, /^[a-f0-9]{32}$/);
});

test('EaseIDClient.lookupIdentity fails gracefully when credentials or provider routes are unavailable', async () => {
  const client = new EaseIDClient('', 'https://api.easeid.ai', '');

  await assert.rejects(
    () => client.lookupIdentity('nin', '12345678901', 'demo-entity', '0x0000000000000000000000000000000000000000'),
    /EASEID_API_KEY|EASEID_APP_ID|No supported EaseID identity lookup endpoint|EaseID.*unavailable/i,
  );
});
