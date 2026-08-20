import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NEARIntentsClient } from './nearIntentsClient.js';

describe('NEARIntentsClient Integration Test', () => {
  const client = new NEARIntentsClient();

  it('should fetch supported tokens across chains', async () => {
    const response = await client.getSupportedTokens();
    assert.ok(response);
    assert.ok(response.tokens);
    assert.ok(Array.isArray(response.tokens));
  });

  it('should generate an intent quote for 1-click cross-chain swap', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v0/tokens')) {
        return new Response(JSON.stringify([
          { assetId: 'nep141:arb-usdc', blockchain: 'arb', symbol: 'USDC', decimals: 6 },
          { assetId: 'nep141:sol-usdc', blockchain: 'sol', symbol: 'USDC', decimals: 6 },
        ]), { status: 200 });
      }
      assert.strictEqual(url, 'https://1click.chaindefuser.com/v0/quote');
      const body = JSON.parse(String(init?.body));
      assert.strictEqual(body.originAsset, 'nep141:arb-usdc');
      assert.strictEqual(body.destinationAsset, 'nep141:sol-usdc');
      assert.strictEqual(body.amount, '100000000');
      return new Response(JSON.stringify({ quote: { depositAddress: 'deposit_test_123' } }), { status: 200 });
    }) as typeof fetch;
    const intent = await client.generateIntentForSigning({ originAsset: 'arbitrum:usdc', destinationAsset: 'solana:usdc', amount: '100', recipientAddress: '11111111111111111111111111111111' });
    globalThis.fetch = originalFetch;

    assert.ok(intent);
    assert.strictEqual(intent.success, true);
    assert.ok(intent.intentId);
  });

  it('should reject status lookup for an unknown deposit address', async () => {
    await assert.rejects(() => client.checkSwapExecutionStatus('intent_test_999'));
  });
});
