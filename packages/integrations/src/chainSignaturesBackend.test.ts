import test from 'node:test';
import assert from 'node:assert/strict';

import { assertLiveFinanceEnabled, getLiveFinanceModeStatus } from './chainSignaturesBackend.js';

test('blocks live finance when feature flags are disabled', () => {
  const priorLive = process.env.ENABLE_LIVE_FINANCE;
  const priorPods = process.env.ENABLE_PODS_FINANCE;
  const priorOndo = process.env.ENABLE_ONDO_FINANCE;
  const priorRelayerId = process.env.NEAR_RELAYER_ACCOUNT_ID;
  const priorRelayerKey = process.env.NEAR_RELAYER_PRIVATE_KEY;

  try {
    delete process.env.ENABLE_LIVE_FINANCE;
    delete process.env.ENABLE_PODS_FINANCE;
    delete process.env.ENABLE_ONDO_FINANCE;
    delete process.env.NEAR_RELAYER_ACCOUNT_ID;
    delete process.env.NEAR_RELAYER_PRIVATE_KEY;

    assert.throws(() => assertLiveFinanceEnabled('Pods'), /disabled|missing/i);
    assert.equal(getLiveFinanceModeStatus().enabled, false);
  } finally {
    if (priorLive === undefined) delete process.env.ENABLE_LIVE_FINANCE; else process.env.ENABLE_LIVE_FINANCE = priorLive;
    if (priorPods === undefined) delete process.env.ENABLE_PODS_FINANCE; else process.env.ENABLE_PODS_FINANCE = priorPods;
    if (priorOndo === undefined) delete process.env.ENABLE_ONDO_FINANCE; else process.env.ENABLE_ONDO_FINANCE = priorOndo;
    if (priorRelayerId === undefined) delete process.env.NEAR_RELAYER_ACCOUNT_ID; else process.env.NEAR_RELAYER_ACCOUNT_ID = priorRelayerId;
    if (priorRelayerKey === undefined) delete process.env.NEAR_RELAYER_PRIVATE_KEY; else process.env.NEAR_RELAYER_PRIVATE_KEY = priorRelayerKey;
  }
});

test('allows live finance only when explicitly enabled and credentials are present', () => {
  const priorLive = process.env.ENABLE_LIVE_FINANCE;
  const priorPods = process.env.ENABLE_PODS_FINANCE;
  const priorRelayerId = process.env.NEAR_RELAYER_ACCOUNT_ID;
  const priorRelayerKey = process.env.NEAR_RELAYER_PRIVATE_KEY;

  try {
    process.env.ENABLE_LIVE_FINANCE = 'true';
    process.env.ENABLE_PODS_FINANCE = 'true';
    process.env.NEAR_RELAYER_ACCOUNT_ID = 'proximfi.near';
    process.env.NEAR_RELAYER_PRIVATE_KEY = 'ed25519:1111111111111111111111111111111111111111111111111111111111111111';

    assert.doesNotThrow(() => assertLiveFinanceEnabled('Pods'));
    assert.equal(getLiveFinanceModeStatus('Pods').enabled, true);
    assert.equal(getLiveFinanceModeStatus('Pods').feature, 'Pods');
  } finally {
    if (priorLive === undefined) delete process.env.ENABLE_LIVE_FINANCE; else process.env.ENABLE_LIVE_FINANCE = priorLive;
    if (priorPods === undefined) delete process.env.ENABLE_PODS_FINANCE; else process.env.ENABLE_PODS_FINANCE = priorPods;
    if (priorRelayerId === undefined) delete process.env.NEAR_RELAYER_ACCOUNT_ID; else process.env.NEAR_RELAYER_ACCOUNT_ID = priorRelayerId;
    if (priorRelayerKey === undefined) delete process.env.NEAR_RELAYER_PRIVATE_KEY; else process.env.NEAR_RELAYER_PRIVATE_KEY = priorRelayerKey;
  }
});
