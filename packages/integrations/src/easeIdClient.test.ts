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
