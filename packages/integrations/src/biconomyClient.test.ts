import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BiconomyClient } from './biconomyClient.js';

describe('BiconomyClient Integration Test', () => {
  const client = new BiconomyClient({ apiKey: 'test-api-key', projectId: 'test-project', baseUrl: 'https://biconomy.test' });
  const originalFetch = globalThis.fetch;

  it.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should fetch orchestrator contract addresses', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, addresses: {} }), { status: 200 })) as typeof fetch;
    const addresses = await client.getOrchestratorAddresses();
    assert.ok(addresses);
    assert.strictEqual(addresses.success, true);
  });

  it('should compose instructions and return a quote', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ quote: { userOp: { sender: '0xabc' } } }), { status: 200 })) as typeof fetch;
    const quote = await client.composeInstructionsAndGenerateQuote({
      userOp: {},
      chainId: 8453,
      mode: 'gasless',
      sponsor: true,
      instructions: [
        {
          to: '0x1111111111111111111111111111111111111111',
          data: '0x',
          value: '0',
        },
      ],
    });

    assert.ok(quote);
    assert.ok(quote.userOp);
  });

  it('should submit a supertransaction payload', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, transactionHash: '0xtest' }), { status: 200 })) as typeof fetch;
    const result = await client.submitSupertransaction({
      quoteId: 'quote_test_123',
      signature: '0xmocksignature',
      userOp: {},
      chainId: 8453,
    });

    assert.ok(result);
    assert.strictEqual(result.success, true);
  });
});
