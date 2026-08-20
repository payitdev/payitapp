import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnkeyService } from './turnkeyClient.js';

test('Turnkey integration smoke (requires TURNKEY env)', async (t) => {
  if (!process.env.TURNKEY_ORGANIZATION_ID || !process.env.TURNKEY_API_PUBLIC_KEY || !process.env.TURNKEY_API_PRIVATE_KEY) {
    t.skip('TURNKEY env vars not present; skipping integration test');
    return;
  }

  const userId = `test_${Date.now()}`;
  const email = `integration+${Date.now()}@example.com`;

  const res = await turnkeyService.createUserSubOrganization({ userId, email });

  assert.ok(res.subOrganizationId, 'expected subOrganizationId');
  assert.ok(res.personalWallet?.evmAddress, 'expected personal EVM address');
  assert.ok(res.businessWallet?.evmAddress, 'expected business EVM address');

  // If present, rootUserId should be a non-empty string
  if (res.rootUserId !== undefined) {
    assert.ok(typeof res.rootUserId === 'string');
  }

  console.log('Turnkey integration smoke passed for subOrg:', res.subOrganizationId);
});
