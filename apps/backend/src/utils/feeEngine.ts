export type BillingPlanType = 'PAY_AS_YOU_GO' | 'MODULAR_SAAS';
export type ModularModule =
  | 'DYNAMIC_ACCOUNTS'
  | 'IDENTITY_KYC'
  | 'MPC_WALLETS'
  | 'BATCH_PAYOUTS'
  | 'ALL_IN_ONE_ENTERPRISE';

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'AUTO_DOWNGRADED_PAYG' | 'CANCELLED';

export interface EntityBillingProfile {
  entityId: string;
  plan: BillingPlanType;
  activeModules: ModularModule[];
  monthlySubscriptionUsd: number;
  status: SubscriptionStatus;
  pastDueSince?: string;
  monthlyKycUsed: number;
  monthlyDerivedWalletsUsed: number;
  updatedAt: string;
}

export interface FeeCalculationResult {
  feeAmount: number;
  feeCurrency: string;
  feeType: 'DYNAMIC_PERCENTAGE' | 'MODULAR_SAAS_COVERED' | 'AT_COST_CLEARING';
  isDoubleChargeProtected: boolean;
  explanation: string;
}

// In-memory persistent billing profile store per entity
export const entityBillingProfiles = new Map<string, EntityBillingProfile>();

export class FeeEngine {
  /**
   * Returns the entity's billing profile, defaulting to PAY_AS_YOU_GO if not explicitly set.
   */
  public static getProfile(entityId: string): EntityBillingProfile {
    let profile = entityBillingProfiles.get(entityId);
    if (!profile) {
      profile = {
        entityId,
        plan: 'PAY_AS_YOU_GO',
        activeModules: [],
        monthlySubscriptionUsd: 0,
        status: 'ACTIVE',
        monthlyKycUsed: 0,
        monthlyDerivedWalletsUsed: 0,
        updatedAt: new Date().toISOString(),
      };
      entityBillingProfiles.set(entityId, profile);
    }
    return profile;
  }

  /**
   * Updates an entity's billing profile (e.g. toggling Pay-As-You-Go vs Modular SaaS plans).
   */
  public static updateProfile(
    entityId: string,
    plan: BillingPlanType,
    activeModules: ModularModule[] = []
  ): EntityBillingProfile {
    let monthlySubscriptionUsd = 0;

    if (plan === 'MODULAR_SAAS') {
      if (activeModules.includes('ALL_IN_ONE_ENTERPRISE')) {
        monthlySubscriptionUsd = 399;
      } else {
        if (activeModules.includes('DYNAMIC_ACCOUNTS')) monthlySubscriptionUsd += 99;
        if (activeModules.includes('IDENTITY_KYC')) monthlySubscriptionUsd += 149;
        if (activeModules.includes('MPC_WALLETS')) monthlySubscriptionUsd += 199;
        if (activeModules.includes('BATCH_PAYOUTS')) monthlySubscriptionUsd += 79;
      }
    }

    const updatedProfile: EntityBillingProfile = {
      entityId,
      plan,
      activeModules,
      monthlySubscriptionUsd,
      status: 'ACTIVE',
      monthlyKycUsed: 0,
      monthlyDerivedWalletsUsed: 0,
      updatedAt: new Date().toISOString(),
    };

    entityBillingProfiles.set(entityId, updatedProfile);
    return updatedProfile;
  }

  /**
   * State Machine: Mark entity subscription status (e.g. on failed monthly renewal)
   */
  public static setSubscriptionStatus(
    entityId: string,
    status: SubscriptionStatus
  ): EntityBillingProfile {
    const profile = this.getProfile(entityId);
    profile.status = status;
    if (status === 'PAST_DUE' && !profile.pastDueSince) {
      profile.pastDueSince = new Date().toISOString();
    } else if (status === 'ACTIVE') {
      profile.pastDueSince = undefined;
    }
    profile.updatedAt = new Date().toISOString();
    entityBillingProfiles.set(entityId, profile);
    return profile;
  }

  /**
   * Calculate Inbound Collection Fee with Anti-Double-Charging & Subscription Health Guardrails.
   */
  public static calculateInboundCollectionFee(
    entityId: string,
    amount: number,
    currency: string
  ): FeeCalculationResult {
    const profile = this.getProfile(entityId);
    const currUpper = (currency || 'NGN').toUpperCase();

    // Check if covered by an ACTIVE or PAST_DUE (grace period) Modular SaaS subscription
    const isSubscriptionHealthy = profile.status === 'ACTIVE' || profile.status === 'PAST_DUE';
    const isCoveredBySaas =
      profile.plan === 'MODULAR_SAAS' &&
      isSubscriptionHealthy &&
      (profile.activeModules.includes('DYNAMIC_ACCOUNTS') ||
        profile.activeModules.includes('ALL_IN_ONE_ENTERPRISE'));

    if (isCoveredBySaas) {
      return {
        feeAmount: 0.0,
        feeCurrency: currUpper,
        feeType: 'MODULAR_SAAS_COVERED',
        isDoubleChargeProtected: true,
        explanation: 'Covered by active Dynamic Accounts SaaS subscription (0% processing fee, wholesale FX spread only).',
      };
    }

    // Standard Pay-As-You-Go % fee calculation (also used as automatic fallback if subscription is delinquent)
    let feeAmount = 0;
    switch (currUpper) {
      case 'NGN':
        feeAmount = Math.min(amount * 0.01, 2000.0); // 1% capped at ₦2,000
        break;
      case 'USD':
      case 'EUR':
      case 'GBP':
        feeAmount = amount * 0.0075 + 0.3; // 0.75% + $0.30
        break;
      case 'KES':
      case 'GHS':
      case 'UGX':
        feeAmount = amount * 0.012; // 1.20%
        break;
      case 'USDC':
      case 'USDT':
        feeAmount = amount * 0.003; // 0.30%
        break;
      default:
        feeAmount = amount * 0.01;
    }

    return {
      feeAmount: parseFloat(feeAmount.toFixed(4)),
      feeCurrency: currUpper,
      feeType: 'DYNAMIC_PERCENTAGE',
      isDoubleChargeProtected: false,
      explanation:
        profile.status === 'AUTO_DOWNGRADED_PAYG'
          ? 'Auto-fallback to Pay-As-You-Go applied due to past-due monthly subscription.'
          : 'Pay-As-You-Go transaction fee applied (Zero monthly subscription).',
    };
  }

  /**
   * Calculate Outbound Batch Payout Fee with Anti-Double-Charging Guardrail.
   */
  public static calculateBatchPayoutFee(
    entityId: string,
    recipientsCount: number,
    currency: string
  ): FeeCalculationResult {
    const profile = this.getProfile(entityId);
    const currUpper = (currency || 'NGN').toUpperCase();

    // Flat at-cost clearing rates (₦50 for NGN, $0.50 for others)
    const perRecipientRate = currUpper === 'NGN' ? 50.0 : 0.5;
    const totalFee = recipientsCount * perRecipientRate;

    const isCoveredBySaas =
      profile.plan === 'MODULAR_SAAS' &&
      (profile.activeModules.includes('BATCH_PAYOUTS') ||
        profile.activeModules.includes('ALL_IN_ONE_ENTERPRISE'));

    return {
      feeAmount: totalFee,
      feeCurrency: currUpper,
      feeType: isCoveredBySaas ? 'MODULAR_SAAS_COVERED' : 'AT_COST_CLEARING',
      isDoubleChargeProtected: true,
      explanation: isCoveredBySaas
        ? `Covered by active Batch Payouts SaaS subscription. Flat clearing of ${currUpper === 'NGN' ? '₦50' : '$0.50'} per recipient with 0% platform markup.`
        : `Pay-As-You-Go flat disbursal fee of ${currUpper === 'NGN' ? '₦50' : '$0.50'} per recipient.`,
    };
  }
}
