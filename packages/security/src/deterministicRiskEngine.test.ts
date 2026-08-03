import assert from 'node:assert';
import { test, describe } from 'node:test';
import { DeterministicRiskEngine } from './deterministicRiskEngine.js';

describe('Deterministic Risk Engine Unit Tests', () => {
  test('1. SHOULD evaluate normal transaction as LOW risk', () => {
    const engine = new DeterministicRiskEngine();
    const result = engine.evaluate({
      userId: 'user_1',
      entityId: 'ent_1',
      amount: 500,
      recipientTagOrAccount: 'david.doe',
      deviceId: 'dev_123',
      userKnownRecipients: ['david.doe'],
      userHistory: [
        { amount: 450, recipientTagOrAccount: 'david.doe', deviceId: 'dev_123', createdAt: new Date(Date.now() - 86400000) },
        { amount: 550, recipientTagOrAccount: 'david.doe', deviceId: 'dev_123', createdAt: new Date(Date.now() - 172800000) },
        { amount: 500, recipientTagOrAccount: 'alice.smith', deviceId: 'dev_123', createdAt: new Date(Date.now() - 259200000) },
      ],
    });

    assert.strictEqual(result.riskLevel, 'LOW');
    assert.strictEqual(result.requiresStepUpAuth, false);
    assert.strictEqual(result.isHeldForReview, false);
  });

  test('2. SHOULD trigger MEDIUM risk & Step-Up Auth for first time recipient + high amount', () => {
    const engine = new DeterministicRiskEngine();
    const result = engine.evaluate({
      userId: 'user_1',
      entityId: 'ent_1',
      amount: 15000,
      recipientTagOrAccount: 'stranger_danger',
      deviceId: 'dev_123',
      userKnownRecipients: ['david.doe'],
      userHistory: [
        { amount: 500, recipientTagOrAccount: 'david.doe', deviceId: 'dev_123', createdAt: new Date(Date.now() - 86400000) },
      ],
    });

    assert.strictEqual(result.riskLevel, 'MEDIUM');
    assert.strictEqual(result.requiresStepUpAuth, true);
    assert.ok(result.rulesTriggered.includes('FIRST_TIME_RECIPIENT'));
  });

  test('3. SHOULD trigger HIGH risk & hold for review on multiple anomalies', () => {
    const engine = new DeterministicRiskEngine();
    const result = engine.evaluate({
      userId: 'user_1',
      entityId: 'ent_1',
      amount: 250000,
      recipientTagOrAccount: 'unknown_acc',
      deviceId: 'new_hacker_phone',
      currentIpGeo: 'US-NY',
      registeredIpGeo: 'NG-LA',
      userKnownRecipients: [],
      userHistory: [
        { amount: 500, recipientTagOrAccount: 'a', deviceId: 'dev_123', createdAt: new Date(Date.now() - 1000) },
        { amount: 500, recipientTagOrAccount: 'b', deviceId: 'dev_123', createdAt: new Date(Date.now() - 2000) },
        { amount: 500, recipientTagOrAccount: 'c', deviceId: 'dev_123', createdAt: new Date(Date.now() - 3000) },
        { amount: 500, recipientTagOrAccount: 'd', deviceId: 'dev_123', createdAt: new Date(Date.now() - 4000) },
        { amount: 500, recipientTagOrAccount: 'e', deviceId: 'dev_123', createdAt: new Date(Date.now() - 5000) },
      ],
    });

    assert.strictEqual(result.riskLevel, 'HIGH');
    assert.strictEqual(result.isHeldForReview, true);
    assert.ok(result.rulesTriggered.includes('VELOCITY_LIMIT_EXCEEDED'));
    assert.ok(result.rulesTriggered.includes('UNRECOGNIZED_DEVICE'));
    assert.ok(result.rulesTriggered.includes('GEO_FINGERPRINT_MISMATCH'));
  });
});
