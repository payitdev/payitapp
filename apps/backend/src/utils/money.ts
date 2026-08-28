/**
 * Institutional Financial Math & Monetary Precision Engine
 * Prevents IEEE-754 floating point rounding drift, salami-slicing exploits, and negative/NaN fuzzing.
 */

export interface ValidatedMoney {
  valid: boolean;
  error?: string;
  cleanAmount: number;
  microUnits: bigint;
  formattedString: string;
}

/**
 * Validates monetary amounts with strict scale bounds and converts to integer micro-units (BigInt).
 * @param rawAmount - User-supplied amount (number or string)
 * @param maxDecimals - Maximum allowed decimal places (2 for standard fiat, 6 for stablecoins)
 * @param minAmount - Minimum positive transaction threshold (default 0.01)
 */
export function validateAndParseMoney(
  rawAmount: number | string,
  maxDecimals: number = 2,
  minAmount: number = 0.01
): ValidatedMoney {
  if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
    return { valid: false, error: 'Amount is required.', cleanAmount: 0, microUnits: 0n, formattedString: '0.00' };
  }

  const num = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).trim());

  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: 'Amount must be a valid finite number.', cleanAmount: 0, microUnits: 0n, formattedString: '0.00' };
  }

  if (num <= 0) {
    return { valid: false, error: 'Amount must be greater than zero.', cleanAmount: 0, microUnits: 0n, formattedString: '0.00' };
  }

  if (num < minAmount) {
    return { valid: false, error: `Amount cannot be less than ${minAmount}.`, cleanAmount: 0, microUnits: 0n, formattedString: '0.00' };
  }

  // Check decimal places on string representation to prevent exponential fuzzing
  const str = String(rawAmount).trim();
  if (str.includes('e') || str.includes('E')) {
    return { valid: false, error: 'Scientific exponential notation is not permitted in monetary amounts.', cleanAmount: 0, microUnits: 0n, formattedString: '0.00' };
  }

  const parts = str.split('.');
  if (parts.length === 2 && parts[1].length > maxDecimals) {
    return {
      valid: false,
      error: `Excessive decimal precision. Currency allows a maximum of ${maxDecimals} decimal places (received ${parts[1].length}).`,
      cleanAmount: 0,
      microUnits: 0n,
      formattedString: '0.00',
    };
  }

  // Convert to BigInt micro-units (scale: 1e6)
  const multiplier = 10 ** maxDecimals;
  const microMultiplier = 1000000n;
  const rounded = Math.round(num * multiplier) / multiplier;
  const microUnits = BigInt(Math.round(rounded * 1000000));

  return {
    valid: true,
    cleanAmount: rounded,
    microUnits,
    formattedString: rounded.toFixed(maxDecimals),
  };
}

/**
 * Safely sums an array of amounts using BigInt integer arithmetic to prevent floating-point drift.
 */
export function safeSumAmounts(amounts: number[], decimals: number = 2): number {
  const scale = 10 ** decimals;
  let totalBigInt = 0n;

  for (const amt of amounts) {
    const validated = validateAndParseMoney(amt, decimals);
    if (!validated.valid) throw new Error(validated.error);
    totalBigInt += BigInt(Math.round(validated.cleanAmount * scale));
  }

  return Number(totalBigInt) / scale;
}
