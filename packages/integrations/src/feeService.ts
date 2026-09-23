export interface FeeSchedule {
  payInRatePercent: number; // e.g. 0.5%
  payInFixedFeeUsd: number; // e.g. $0.20
  payInNgnRatePercent: number; // e.g. 0.8%
  payInNgnCap: number; // e.g. ₦1,500
  merchantInvoicePercent: number; // e.g. 1.2%
  altcoinSwapPercent: number; // e.g. 0.6%
  payrollFixedPerRecipientUsd: number; // e.g. $0.50
  payrollFixedPerRecipientNgn: number; // e.g. ₦150
  payrollBatchPercent: number; // e.g. 0.3%
  offRampPercent: number; // e.g. 1.0%
  virtualCardIssuancePercent: number; // Proxim virtual card issuance fee (0.75%)
  virtualCardFundingPercent: number; // Proxim virtual card funding fee (0.25%)
  virtualCardWithdrawalPercent: number; // Proxim virtual card withdrawal fee (1.0%)
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  payInRatePercent: 0.0075, // 0.75%
  payInFixedFeeUsd: 0.30, // $0.30
  payInNgnRatePercent: 0.010, // 1.0%
  payInNgnCap: 2000, // ₦2,000 max cap on NGN pay-in
  merchantInvoicePercent: 0.010, // 1.0%
  altcoinSwapPercent: 0.006, // 0.6%
  payrollFixedPerRecipientUsd: 0.50, // $0.50 per recipient
  payrollFixedPerRecipientNgn: 50, // ₦50 per recipient
  payrollBatchPercent: 0.000, // 0.0%
  offRampPercent: 0.010, // 1.0%
  virtualCardIssuancePercent: 0.0075, // 0.75%
  virtualCardFundingPercent: 0.0025, // 0.25%
  virtualCardWithdrawalPercent: 0.010, // 1.0%
};

export const PROXIM_TREASURY_ADDRESS = process.env.PROXIM_TREASURY_ADDRESS || '0x71C565F348C3d5e2eF080F17676d1F2C5C1bC593';

export const FX_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  USDC: 1.0,
  USDT: 1.0,
  EUR: 1.08,
  EURC: 1.08,
  GBP: 1.28,
  NGN: 1 / 1550,
  KES: 1 / 129,
  GHS: 1 / 15.5,
  ZAR: 1 / 18.2,
  UGX: 1 / 3700,
  CAD: 0.74,
  AED: 0.27,
};

export interface FeeCalculationResult {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  feeBreakdown: {
    percentageFee: number;
    fixedFee: number;
    description: string;
  };
  currency: string;
}

export class FeeService {
  private schedule: FeeSchedule;
  public readonly treasuryAddress: string = PROXIM_TREASURY_ADDRESS;

  constructor(customSchedule?: Partial<FeeSchedule>) {
    this.schedule = { ...DEFAULT_FEE_SCHEDULE, ...customSchedule };
  }

  /**
   * Calculate Fee on Incoming Fiat Virtual Account Pay-Ins
   */
  calculatePayInFee(amount: number, currency: string): FeeCalculationResult {
    const curr = currency.toUpperCase();
    let feeAmount = 0;
    let percentageFee = 0;
    let fixedFee = 0;

    if (curr === 'NGN') {
      percentageFee = amount * this.schedule.payInNgnRatePercent;
      feeAmount = Math.min(percentageFee, this.schedule.payInNgnCap);
      fixedFee = 0;
    } else {
      percentageFee = amount * this.schedule.payInRatePercent;
      fixedFee = this.schedule.payInFixedFeeUsd;
      feeAmount = percentageFee + fixedFee;
    }

    feeAmount = Math.min(feeAmount, amount * 0.5);
    const netAmount = Math.max(0, amount - feeAmount);

    return {
      grossAmount: Number(amount.toFixed(2)),
      feeAmount: Number(feeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      feeBreakdown: {
        percentageFee: Number(percentageFee.toFixed(2)),
        fixedFee: Number(fixedFee.toFixed(2)),
        description: `Proxim Pay-in Processing Fee (${curr})`,
      },
      currency: curr,
    };
  }

  /**
   * Calculate Fee on Paid Merchant Invoices / Dynamic Payment Links
   */
  calculateInvoiceFee(amount: number, currency: string): FeeCalculationResult {
    const curr = currency.toUpperCase();
    const percentageFee = amount * this.schedule.merchantInvoicePercent;
    const feeAmount = percentageFee;
    const netAmount = Math.max(0, amount - feeAmount);

    return {
      grossAmount: Number(amount.toFixed(2)),
      feeAmount: Number(feeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      feeBreakdown: {
        percentageFee: Number(percentageFee.toFixed(2)),
        fixedFee: 0,
        description: `Proxim Merchant Invoice Fee (${(this.schedule.merchantInvoicePercent * 100).toFixed(1)}%)`,
      },
      currency: curr,
    };
  }

  calculateVirtualCardIssuanceFee(amount: number, currency: string): FeeCalculationResult {
    const curr = (currency || 'USD').toUpperCase();
    const percentageFee = amount * this.schedule.virtualCardIssuancePercent;
    const feeAmount = Math.min(Number((percentageFee).toFixed(2)), Math.max(0, amount * 0.10));
    const netAmount = Math.max(0, amount - feeAmount);

    return {
      grossAmount: Number(amount.toFixed(2)),
      feeAmount: Number(feeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      feeBreakdown: {
        percentageFee: Number(percentageFee.toFixed(2)),
        fixedFee: 0,
        description: `Proxim Virtual Card Issuance Fee (${(this.schedule.virtualCardIssuancePercent * 100).toFixed(2)}%)`,
      },
      currency: curr,
    };
  }

  calculateVirtualCardFundingFee(amount: number, currency: string): FeeCalculationResult {
    const curr = (currency || 'USD').toUpperCase();
    const percentageFee = amount * this.schedule.virtualCardFundingPercent;
    const feeAmount = Number(percentageFee.toFixed(2));
    const netAmount = Math.max(0, amount - feeAmount);

    return {
      grossAmount: Number(amount.toFixed(2)),
      feeAmount,
      netAmount: Number(netAmount.toFixed(2)),
      feeBreakdown: {
        percentageFee: Number(percentageFee.toFixed(2)),
        fixedFee: 0,
        description: `Proxim Virtual Card Funding Fee (${(this.schedule.virtualCardFundingPercent * 100).toFixed(2)}%)`,
      },
      currency: curr,
    };
  }

  calculateVirtualCardWithdrawalFee(amount: number, currency: string): FeeCalculationResult {
    const curr = (currency || 'USD').toUpperCase();
    const percentageFee = amount * this.schedule.virtualCardWithdrawalPercent;
    const feeAmount = Number(percentageFee.toFixed(2));
    const netAmount = Math.max(0, amount - feeAmount);

    return {
      grossAmount: Number(amount.toFixed(2)),
      feeAmount,
      netAmount: Number(netAmount.toFixed(2)),
      feeBreakdown: {
        percentageFee: Number(percentageFee.toFixed(2)),
        fixedFee: 0,
        description: `Proxim Virtual Card Withdrawal Fee (${(this.schedule.virtualCardWithdrawalPercent * 100).toFixed(2)}%)`,
      },
      currency: curr,
    };
  }

  /**
   * Calculate Real-Time FX Quote for Invoicing (with Proxim fee incorporated)
   */
  calculateInvoiceFxQuote(amount: number, sourceCurrency: string): {
    sourceAmount: number;
    sourceCurrency: string;
    feeAmount: number;
    netSourceAmount: number;
    feePercent: number;
    rateToUsd: number;
    grossUsd: number;
    feeUsd: number;
    netUsd: number;
    treasuryAddress: string;
  } {
    const curr = (sourceCurrency || 'USD').toUpperCase();
    const rateToUsd = FX_RATES_TO_USD[curr] || 1.0;
    const feeCalc = this.calculateInvoiceFee(amount, curr);

    const grossUsd = amount * rateToUsd;
    const feeUsd = feeCalc.feeAmount * rateToUsd;
    const netUsd = feeCalc.netAmount * rateToUsd;

    return {
      sourceAmount: Number(amount.toFixed(2)),
      sourceCurrency: curr,
      feeAmount: feeCalc.feeAmount,
      netSourceAmount: feeCalc.netAmount,
      feePercent: Number((this.schedule.merchantInvoicePercent * 100).toFixed(2)),
      rateToUsd,
      grossUsd: Number(grossUsd.toFixed(2)),
      feeUsd: Number(feeUsd.toFixed(2)),
      netUsd: Number(netUsd.toFixed(2)),
      treasuryAddress: this.treasuryAddress,
    };
  }

  /**
   * Calculate Fee on Batch Payroll Runs
   */
  calculatePayrollFee(totalAmount: number, recipientCount: number, currency: string): FeeCalculationResult {
    const curr = currency.toUpperCase();
    let fixedFeePerRecipient = curr === 'NGN' ? this.schedule.payrollFixedPerRecipientNgn : this.schedule.payrollFixedPerRecipientUsd;
    const totalFixedFee = recipientCount * fixedFeePerRecipient;
    const percentageFee = totalAmount * this.schedule.payrollBatchPercent;
    const feeAmount = totalFixedFee + percentageFee;
    const netAmount = Math.max(0, totalAmount - feeAmount);

    return {
      grossAmount: Number(totalAmount.toFixed(2)),
      feeAmount: Number(feeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      feeBreakdown: {
        percentageFee: Number(percentageFee.toFixed(2)),
        fixedFee: Number(totalFixedFee.toFixed(2)),
        description: `Proxim Payroll Fee (${recipientCount} recipients @ ${fixedFeePerRecipient} ${curr} + ${(this.schedule.payrollBatchPercent * 100).toFixed(1)}%)`,
      },
      currency: curr,
    };
  }

  /**
   * Calculate Fee on Altcoin Auto-Swap Liquidation
   */
  calculateAltcoinSwapFee(amountUsd: number): FeeCalculationResult {
    const feeAmount = amountUsd * this.schedule.altcoinSwapPercent;
    const netAmount = Math.max(0, amountUsd - feeAmount);

    return {
      grossAmount: Number(amountUsd.toFixed(4)),
      feeAmount: Number(feeAmount.toFixed(4)),
      netAmount: Number(netAmount.toFixed(4)),
      feeBreakdown: {
        percentageFee: Number(feeAmount.toFixed(4)),
        fixedFee: 0,
        description: `Proxim Altcoin Liquidity Swap Fee (${(this.schedule.altcoinSwapPercent * 100).toFixed(1)}%)`,
      },
      currency: 'USDC',
    };
  }

  calculateCryptoWithdrawalFee(amountUsdc: number): FeeCalculationResult {
    const grossAmount = Math.max(0, amountUsdc);
    const percentageFee = grossAmount * 0.01;
    const feeAmount = grossAmount === 0 ? 0 : Math.min(50, Math.max(0.5, percentageFee));
    const netAmount = Math.max(0, grossAmount - feeAmount);
    return {
      grossAmount,
      feeAmount,
      netAmount,
      feeBreakdown: {
        percentageFee,
        fixedFee: 0,
        description: 'Proxim Crypto Withdrawal Fee (1%, minimum $0.50, maximum $50.00)',
      },
      currency: 'USDC',
    };
  }

  /**
   * Calculate Fee on Bank / Mobile Money Off-Ramps
   */
  calculateOffRampFee(amount: number, currency: string): FeeCalculationResult {
    const curr = currency.toUpperCase();
    const feeAmount = amount * this.schedule.offRampPercent;
    const netAmount = Math.max(0, amount - feeAmount);

    return {
      grossAmount: Number(amount.toFixed(2)),
      feeAmount: Number(feeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      feeBreakdown: {
        percentageFee: Number(feeAmount.toFixed(2)),
        fixedFee: 0,
        description: `Proxim Payout / Off-Ramp Fee (${(this.schedule.offRampPercent * 100).toFixed(1)}%)`,
      },
      currency: curr,
    };
  }

  /**
   * Calculate Yield Fee Split (Proxim Cut vs User Net APY)
   * Example: Gross APY = 6.0%, Proxim Cut = 2.0% -> User Net APY = 4.0%
   */
  calculateYieldFeeSplit(grossApyPercent: number, proximFeeCutPercent: number = 2.0): {
    grossApy: number;
    proximCutApy: number;
    userNetApy: number;
    proximSharePercent: number;
    userSharePercent: number;
  } {
    const grossApy = Math.max(0, grossApyPercent);
    const proximCutApy = Math.min(grossApy, Math.max(0, proximFeeCutPercent));
    const userNetApy = Math.max(0, grossApy - proximCutApy);
    
    const proximSharePercent = grossApy > 0 ? (proximCutApy / grossApy) * 100 : 0;
    const userSharePercent = grossApy > 0 ? (userNetApy / grossApy) * 100 : 100;

    return {
      grossApy: Number(grossApy.toFixed(2)),
      proximCutApy: Number(proximCutApy.toFixed(2)),
      userNetApy: Number(userNetApy.toFixed(2)),
      proximSharePercent: Number(proximSharePercent.toFixed(2)),
      userSharePercent: Number(userSharePercent.toFixed(2)),
    };
  }

  /**
   * Calculate Early Exit Penalty options for Fixed Term Vaults (Choice A vs Choice B)
   */
  calculateEarlyExitPenalty(principalUsd: number, accruedInterestUsd: number): {
    choiceA: {
      description: string;
      forfeitedInterestUsd: number;
      principalReturnedUsd: number;
      proximFeeUsd: number;
      netPayoutUsd: number;
    };
    choiceB: {
      description: string;
      retainedInterestUsd: number;
      penaltyFeePercent: number;
      proximFeeUsd: number;
      netPayoutUsd: number;
    };
  } {
    const principal = Math.max(0, principalUsd);
    const accrued = Math.max(0, accruedInterestUsd);

    // Option A: Forfeit 100% of accrued interest (0% fee on principal)
    const choiceANetPayout = principal;

    // Option B: Keep interest, pay 10.0% principal fee to Proxim Treasury
    const penaltyFee10Percent = principal * 0.10;
    const choiceBNetPayout = (principal + accrued) - penaltyFee10Percent;

    return {
      choiceA: {
        description: 'Option A: Retain 100% Principal (Forfeit Interest)',
        forfeitedInterestUsd: Number(accrued.toFixed(2)),
        principalReturnedUsd: Number(principal.toFixed(2)),
        proximFeeUsd: Number(accrued.toFixed(2)),
        netPayoutUsd: Number(choiceANetPayout.toFixed(2)),
      },
      choiceB: {
        description: 'Option B: Retain Accrued Interest (10.0% Principal Fee)',
        retainedInterestUsd: Number(accrued.toFixed(2)),
        penaltyFeePercent: 10.0,
        proximFeeUsd: Number(penaltyFee10Percent.toFixed(2)),
        netPayoutUsd: Number(choiceBNetPayout.toFixed(2)),
      },
    };
  }

  /**
   * Calculate Partner Fee for NEAR 1Click Intent Routing (default 50 bps / 0.50%)
   */
  calculateIntentPartnerFee(amountUsd: number, feeBps: number = 50): {
    grossAmountUsd: number;
    feeBps: number;
    feeAmountUsd: number;
    netAmountUsd: number;
    treasuryAddress: string;
  } {
    const gross = Math.max(0, amountUsd);
    const feeAmount = (gross * feeBps) / 10000;
    const netAmount = Math.max(0, gross - feeAmount);

    return {
      grossAmountUsd: Number(gross.toFixed(2)),
      feeBps,
      feeAmountUsd: Number(feeAmount.toFixed(4)),
      netAmountUsd: Number(netAmount.toFixed(2)),
      treasuryAddress: this.treasuryAddress,
    };
  }
}

export const feeService = new FeeService();

