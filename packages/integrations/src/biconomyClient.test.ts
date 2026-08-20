import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BiconomyClient } from './biconomyClient.js';

describe('BiconomyClient Integration Test', () => {
  const client = new BiconomyClient();

  it('should fetch orchestrator contract addresses', async () => {
    const addresses = await client.getOrchestratorAddresses();
    assert.ok(addresses);
    assert.strictEqual(addresses.success, true);
  });

  it('should compose instructions and return a quote', async () => {
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
    assert.strictEqual(quote.success, true);
  });

  it('should submit a supertransaction payload', async () => {
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
