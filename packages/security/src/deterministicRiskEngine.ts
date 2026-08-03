export interface TransactionHistoryItem {
  amount: number;
  recipientTagOrAccount: string;
  deviceId: string;
  createdAt: Date;
}

export interface RiskEvaluationInput {
  userId: string;
  entityId: string;
  amount: number;
  recipientTagOrAccount: string;
  deviceId: string;
  currentIpGeo?: string;
  registeredIpGeo?: string;
  userHistory: TransactionHistoryItem[];
  userKnownRecipients: string[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskEvaluationResult {
  riskLevel: RiskLevel;
  score: number;
  rulesTriggered: string[];
  requiresStepUpAuth: boolean;
  isHeldForReview: boolean;
  reason: string;
}

export class DeterministicRiskEngine {
  /**
   * Evaluates transfer risk in 3 deterministic layers.
   * LLMs are strictly excluded from deciding pass/fail!
   */
  public evaluate(input: RiskEvaluationInput): RiskEvaluationResult {
    const rulesTriggered: string[] = [];
    let score = 0;

    // -------------------------------------------------------------
    // LAYER 1: Deterministic Rules Layer
    // -------------------------------------------------------------

    // 1. Velocity Limit: > 5 transactions in past 10 minutes
    const now = Date.now();
    const tenMinsAgo = now - 10 * 60 * 1000;
    const recentTxCount = input.userHistory.filter(tx => tx.createdAt.getTime() >= tenMinsAgo).length;
    if (recentTxCount >= 5) {
      rulesTriggered.push('VELOCITY_LIMIT_EXCEEDED');
      score += 40;
    }

    // 2. First-time recipient check
    const isFirstTimeRecipient = !input.userKnownRecipients.includes(input.recipientTagOrAccount);
    if (isFirstTimeRecipient) {
      rulesTriggered.push('FIRST_TIME_RECIPIENT');
      score += 20;
    }

    // 3. New device check
    const isKnownDevice = input.userHistory.some(tx => tx.deviceId === input.deviceId);
    if (!isKnownDevice) {
      rulesTriggered.push('UNRECOGNIZED_DEVICE');
      score += 25;
    }

    // 4. Geo / IP mismatch
    if (input.currentIpGeo && input.registeredIpGeo && input.currentIpGeo !== input.registeredIpGeo) {
      rulesTriggered.push('GEO_FINGERPRINT_MISMATCH');
      score += 30;
    }

    // -------------------------------------------------------------
    // LAYER 2: Statistical Z-Score Layer
    // -------------------------------------------------------------
    const amounts = input.userHistory.map(tx => tx.amount);
    if (amounts.length >= 3) {
      const mean = amounts.reduce((acc, val) => acc + val, 0) / amounts.length;
      const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance) || 1;

      const zScore = (input.amount - mean) / stdDev;

      if (zScore > 3.0) {
        rulesTriggered.push(`STATISTICAL_ANOMALY_ZSCORE_${zScore.toFixed(2)}`);
        score += 35;
      } else if (zScore > 2.0) {
        rulesTriggered.push(`ELEVATED_AMOUNT_ZSCORE_${zScore.toFixed(2)}`);
        score += 15;
      }
    } else if (input.amount > 50000) {
      // Fallback limit for brand new users without history
      rulesTriggered.push('HIGH_VALUE_NEW_ACCOUNT');
      score += 30;
    }

    // -------------------------------------------------------------
    // LAYER 3: Combined Risk Tier Action
    // -------------------------------------------------------------
    let riskLevel: RiskLevel = 'LOW';
    let requiresStepUpAuth = false;
    let isHeldForReview = false;
    let reason = 'Transfer verified safe by deterministic rules engine.';

    if (score >= 60) {
      riskLevel = 'HIGH';
      isHeldForReview = true;
      requiresStepUpAuth = true;
      reason = `High risk detected (${rulesTriggered.join(', ')}). Transfer held for manual review.`;
    } else if (score >= 25 || (isFirstTimeRecipient && input.amount > 10000)) {
      riskLevel = 'MEDIUM';
      requiresStepUpAuth = true;
      reason = `Medium risk step-up required (${rulesTriggered.join(', ')}). Verify via PIN or Biometric.`;
    }

    return {
      riskLevel,
      score,
      rulesTriggered,
      requiresStepUpAuth,
      isHeldForReview,
      reason,
    };
  }
}
