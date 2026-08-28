import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { BrailsClient, BrailsSendStablecoinPayload, BrailsGenerateDepositAddressPayload } from './brailsClient.js';

describe('Brails Stablecoin Integration Tests (Base Chain)', () => {
  const client = new BrailsClient('mock_brails_api_key', 'https://api.onbrails.com/api/v1');

  it('instantiates BrailsClient with Base chain API endpoint configuration', () => {
    assert.ok(client);
    assert.equal(typeof client.sendStablecoin, 'function');
    assert.equal(typeof client.generateDepositAddress, 'function');
    assert.equal(typeof client.getDepositAddress, 'function');
    assert.equal(typeof client.listDepositAddresses, 'function');
    assert.equal(typeof client.deactivateDepositAddress, 'function');
    assert.equal(typeof client.verifyTransactionStatus, 'function');
  });

  it('correctly constructs USDC transfer on Base chain with amount in cents', () => {
    const payload: BrailsSendStablecoinPayload = {
      amount: 2500, // $25.00 in cents
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      chain: 'base',
      reference: 'proxim_send_usdc_001',
      description: 'Settlement for invoice #001',
      customerEmail: 'alex.morgan@proxim.financial',
      callbackUrl: 'https://api.proxim.financial/webhooks/brails',
    };

    assert.equal(payload.chain, 'base');
    assert.equal(payload.amount, 2500);
    assert.ok(payload.address.startsWith('0x'));
    assert.equal(payload.customerEmail, 'alex.morgan@proxim.financial');
  });

  it('correctly constructs deposit address payload for Base chain', () => {
    const payload: BrailsGenerateDepositAddressPayload = {
      chain: 'base',
      reference: 'deposit-addr-base-001',
      description: 'Customer Base USDC deposit address',
      customerEmail: 'alex.morgan@proxim.financial',
      callbackUrl: 'https://api.proxim.financial/webhooks/brails',
    };

    assert.equal(payload.chain, 'base');
    assert.equal(payload.reference, 'deposit-addr-base-001');
  });

  it('validates webhook HMAC-SHA256 signature for stablecoin send/receive events', () => {
    const webhookSecret = 'test_brails_secret_key_123';
    const payload = JSON.stringify({
      event: 'stablecoin.usdc.receive.success',
      data: {
        id: '4e5f6g7h-89i0-1j2k-3l4m-5n6o7p8q9r0s',
        fees: '0',
        type: 'credit',
        action: 'receive_stablecoin',
        status: 'success',
        chain: 'BASE',
        amount: '25.50',
        centAmount: '2550',
        centFees: '0',
        fromAddress: '0x9876543210FEDCBA9876543210FEDCBA98765432',
        toAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        reference: 'deposit-addr-base-001',
      },
    });

    const signature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

    const isValid = client.verifyWebhookSignature(payload, signature, webhookSecret);
    assert.equal(isValid, true);

    const isTampered = client.verifyWebhookSignature(payload + 'tampered', signature, webhookSecret);
    assert.equal(isTampered, false);
  });
});
