import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calculateEvmGasCost, calculateReserve } from './gasSettlement.js';

describe('EVM gas settlement math', () => {
  test('calculates exact native cost and stablecoin charge', () => {
    assert.deepEqual(calculateEvmGasCost({
      gasUsed: 80_000n,
      effectiveGasPrice: 1_000_000_000n,
      nativeUsdPrice: '3000',
    }), { actualGasNative: '0.00008', chargedAmount: '0.24' });
  });

  test('calculates a temporary reserve without floating point drift', () => {
    assert.equal(calculateReserve('0.0005', '3000'), '1.5');
  });
});