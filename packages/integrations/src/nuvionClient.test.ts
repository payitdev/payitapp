import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NuvionClient, NuvionApiError } from './nuvionClient.js';

process.env.NUVION_API_KEY = 'test_key_for_unit_tests';

describe('NuvionClient Security Assertions Unit Tests', () => {
  it('1. SHOULD throw NuvionApiError if returned account entity_id does not match target entityId', async () => {
    const client = new NuvionClient();

    // Mock nuvionGet to return an account with a mismatched entity_id
    (client as any).nuvionGet = async (path: string) => {
      if (path.includes('/accounts')) {
        return {
          data: {
            accounts: [
              {
                id: 'acc_123',
                entity_id: 'merchant_entity_999', // Mismatched entity ID
                currency: 'USD',
              },
            ],
          },
        };
      }
      return {};
    };

    await assert.rejects(
      async () => {
        await client.getAccountsForEntity('user_entity_111');
      },
      (err: any) => {
        assert.ok(err instanceof NuvionApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes('SECURITY: account entity_id mismatch'));
        return true;
      }
    );
  });

  it('2. SHOULD return accounts successfully when entity_id matches target entityId', async () => {
    const client = new NuvionClient();

    (client as any).nuvionGet = async (path: string) => {
      if (path.includes('/accounts')) {
        return {
          data: {
            accounts: [
              {
                id: 'acc_789',
                entity_id: 'user_entity_111',
                currency: 'NGN',
              },
            ],
          },
        };
      }
      return {};
    };

    const res = await client.getAccountsForEntity('user_entity_111');
    assert.ok(res.data.accounts.length === 1);
    assert.strictEqual(res.data.accounts[0].entity_id, 'user_entity_111');
  });
});
