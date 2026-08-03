import assert from 'node:assert';
import { test, describe } from 'node:test';
import { LedgerEngine } from './ledgerEngine.js';
import { validateEntityAccess, validateCardEntityMatch, EntityGuardViolationError } from './entityGuard.js';

describe('PayIT Monorepo - Release-Blocking Adversarial Fund Separation Suite', () => {
  test('1. SHOULD REJECT cross-entity ledger posting contamination', () => {
    const engine = new LedgerEngine();

    // Personal Entity Accounts
    engine.registerAccount({ id: 'pers_cash', entityId: 'entity_personal_123', name: 'Personal Cash', balance: 1000 });
    // Business Entity Accounts
    engine.registerAccount({ id: 'biz_revenue', entityId: 'entity_business_456', name: 'Business Revenue', balance: 5000 });

    // Attempt to credit Personal Cash using a Business entry entity_id (Contamination attempt)
    assert.throws(
      () => {
        engine.postTransaction({
          transactionId: 'tx_hack_01',
          transactionType: 'PAYMENT',
          entries: [
            { entityId: 'entity_business_456', ledgerAccountId: 'pers_cash', type: 'DEBIT', amount: 500 }, // ENTITY MISMATCH!
            { entityId: 'entity_business_456', ledgerAccountId: 'biz_revenue', type: 'CREDIT', amount: 500 },
          ],
        });
      },
      (err: Error) => {
        return err.message.includes('FUND SEPARATION VIOLATION');
      }
    );
  });

  test('2. SHOULD REJECT unbalanced double-entry transactions', () => {
    const engine = new LedgerEngine();
    engine.registerAccount({ id: 'acc_a', entityId: 'ent_1', name: 'Acc A', balance: 1000 });
    engine.registerAccount({ id: 'acc_b', entityId: 'ent_1', name: 'Acc B', balance: 0 });

    assert.throws(
      () => {
        engine.postTransaction({
          transactionId: 'tx_unbalanced',
          transactionType: 'PAYMENT',
          entries: [
            { entityId: 'ent_1', ledgerAccountId: 'acc_a', type: 'DEBIT', amount: 500 },
            { entityId: 'ent_1', ledgerAccountId: 'acc_b', type: 'CREDIT', amount: 400 }, // 500 != 400!
          ],
        });
      },
      (err: Error) => err.message.includes('Unbalanced double-entry transaction')
    );
  });

  test('3. SHOULD EXECUTE valid explicit Inter-Entity Transfer without fund mixing', () => {
    const engine = new LedgerEngine();

    // Personal Accounts
    engine.registerAccount({ id: 'pers_wallet', entityId: 'ent_personal', name: 'Personal Wallet', balance: 1000 });
    engine.registerAccount({ id: 'ent_personal_CLEARING', entityId: 'ent_personal', name: 'Personal Clearing', balance: 0 });

    // Business Accounts
    engine.registerAccount({ id: 'biz_wallet', entityId: 'ent_business', name: 'Business Wallet', balance: 500 });
    engine.registerAccount({ id: 'ent_business_CLEARING', entityId: 'ent_business', name: 'Business Clearing', balance: 0 });

    // Move ₦200 from Personal to Business
    engine.postInterEntityTransfer({
      transactionId: 'tx_self_move_1',
      sourceEntityId: 'ent_personal',
      sourceAccountId: 'pers_wallet',
      targetEntityId: 'ent_business',
      targetAccountId: 'biz_wallet',
      amount: 200,
    });

    // Verify balances
    assert.strictEqual(engine.getAccountBalance('pers_wallet', 'ent_personal'), 800);
    assert.strictEqual(engine.getAccountBalance('biz_wallet', 'ent_business'), 700);
  });

  test('4. SHOULD REJECT Entity Guard unauthorized entity access', () => {
    const session = {
      userId: 'user_john',
      activeEntityId: 'ent_personal_1',
      userEntityIds: ['ent_personal_1', 'ent_business_1'],
    };

    // User attempting to access someone else's entity
    assert.throws(
      () => {
        validateEntityAccess(session, 'ent_attacker_999');
      },
      (err: Error) => err instanceof EntityGuardViolationError && err.message.includes('UNAUTHORIZED ENTITY ACCESS')
    );
  });

  test('5. SHOULD REJECT Entity Guard active context mismatch', () => {
    const session = {
      userId: 'user_john',
      activeEntityId: 'ent_personal_1',
      userEntityIds: ['ent_personal_1', 'ent_business_1'],
    };

    // User is currently in Personal context, trying to execute Business payload without switching context
    assert.throws(
      () => {
        validateEntityAccess(session, 'ent_business_1');
      },
      (err: Error) => err instanceof EntityGuardViolationError && err.message.includes('ACTIVE CONTEXT MISMATCH')
    );
  });

  test('6. SHOULD REJECT card entity mismatch with funding account', () => {
    assert.throws(
      () => {
        validateCardEntityMatch('ent_personal_1', 'ent_business_1');
      },
      (err: Error) => err instanceof EntityGuardViolationError && err.message.includes('CARD ENTITY MISMATCH')
    );
  });
});
