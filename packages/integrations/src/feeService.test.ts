import { describe, it } from 'node:test';
import assert from 'node:assert';
import { feeService } from './feeService.js';

describe('FeeService virtual-card pricing', () => {
  it('should apply Proxim fee for card issuance and funding using the standard platform price schedule', () => {
    const issuance = feeService.calculateVirtualCardIssuanceFee(250, 'USD');
    const funding = feeService.calculateVirtualCardFundingFee(250, 'USD');

    assert.strictEqual(issuance.currency, 'USD');
    assert.ok(issuance.feeAmount > 0);
    assert.ok(issuance.netAmount >= 0);

    assert.strictEqual(funding.currency, 'USD');
    assert.ok(funding.feeAmount > 0);
    assert.ok(funding.netAmount >= 0);
  });

  it('should apply Proxim off-ramp fee for virtual card withdrawals', () => {
    const withdrawal = feeService.calculateVirtualCardWithdrawalFee(250, 'USD');
    assert.strictEqual(withdrawal.currency, 'USD');
    assert.strictEqual(withdrawal.feeAmount, 2.5);
    assert.strictEqual(withdrawal.netAmount, 247.5);
  });
});
