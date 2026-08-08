import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatParticleUserInfo } from './particleAuth.js';

describe('Particle Auth User Info Normalizer Unit Tests', () => {
  it('1. SHOULD normalize standard Particle useConnect response with wallets array', () => {
    const rawInfo = {
      wallets: [{ public_address: '0x1234567890abcdef1234567890abcdef12345678' }],
      uuid: 'uuid-12345678-abcd',
      email: 'alex@example.com',
      name: 'Alex Johnson',
      avatar: 'https://example.com/avatar.png',
    };

    const normalized = formatParticleUserInfo(rawInfo, 'google');

    assert.strictEqual(normalized.email, 'alex@example.com');
    assert.strictEqual(normalized.particleWalletAddress, '0x1234567890abcdef1234567890abcdef12345678');
    assert.strictEqual(normalized.token, 'uuid-12345678-abcd');
    assert.strictEqual(normalized.name, 'Alex Johnson');
    assert.strictEqual(normalized.avatar, 'https://example.com/avatar.png');
  });

  it('2. SHOULD unwrap nested rawUserInfo.userInfo payload structures', () => {
    const nestedRawInfo = {
      userInfo: {
        wallets: [{ public_address: '0x9999888877776666555544443333222211110000' }],
        uuid: 'uuid-nested-999',
        google_email: 'nested.user@gmail.com',
        name: 'Nested User',
      },
    };

    const normalized = formatParticleUserInfo(nestedRawInfo, 'google');

    assert.strictEqual(normalized.email, 'nested.user@gmail.com');
    assert.strictEqual(normalized.particleWalletAddress, '0x9999888877776666555544443333222211110000');
    assert.strictEqual(normalized.token, 'uuid-nested-999');
    assert.strictEqual(normalized.name, 'Nested User');
  });

  it('3. SHOULD prioritize default user email input if provided for email auth', () => {
    const rawInfo = {
      walletAddress: '0x7777888899990000111122223333444455556666',
      tokenPayload: { token: 'session_token_999' },
    };

    const normalized = formatParticleUserInfo(rawInfo, 'email', 'finance@company.com');

    assert.strictEqual(normalized.email, 'finance@company.com');
    assert.strictEqual(normalized.name, 'finance');
    assert.strictEqual(normalized.particleWalletAddress, '0x7777888899990000111122223333444455556666');
  });

  it('4. SHOULD return empty string for wallet address if SDK payload has no on-chain address yet', () => {
    const infoWithoutWallet = { email: 'test@example.com', uuid: 'session-123' };

    const normalized = formatParticleUserInfo(infoWithoutWallet, 'google');

    assert.strictEqual(normalized.email, 'test@example.com');
    assert.strictEqual(normalized.particleWalletAddress, '');
    assert.strictEqual(normalized.token, 'session-123');
  });
});

