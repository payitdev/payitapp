export interface ParsedCommandDraft {
  intent: 'SEND_MONEY' | 'REQUEST_MONEY' | 'MOVE_TO_BUSINESS' | 'CREATE_INVOICE' | 'UNKNOWN';
  recipientTagOrAccount?: string;
  amount?: number;
  currency?: string;
  narration?: string;
  requiresConfirmation: true; // MANDATORY: Groq output requires human confirmation!
}

export class GroqIntentParser {
  /**
   * Fast LPU natural language command parsing.
   * "Send ₦25,000 to David" -> JSON Draft
   */
  public async parseCommand(promptText: string): Promise<ParsedCommandDraft> {
    const text = promptText.trim();

    // Regex parsing fallback for robust command extraction
    const sendMatch = text.match(/(?:send|pay|transfer)\s+(?:₦|\$|USD|NGN)?\s*([\d,]+)\s+to\s+([a-zA-Z0-9._-]+)/i);
    if (sendMatch) {
      const amount = parseFloat(sendMatch[1].replace(/,/g, ''));
      const recipient = sendMatch[2];
      return {
        intent: 'SEND_MONEY',
        recipientTagOrAccount: recipient,
        amount,
        currency: text.includes('$') ? 'USD' : 'NGN',
        narration: `Payment to ${recipient}`,
        requiresConfirmation: true,
      };
    }

    const moveBizMatch = text.match(/(?:move|transfer)\s+(?:₦|\$)?\s*([\d,]+)\s+to\s+business/i);
    if (moveBizMatch) {
      const amount = parseFloat(moveBizMatch[1].replace(/,/g, ''));
      return {
        intent: 'MOVE_TO_BUSINESS',
        amount,
        currency: 'NGN',
        narration: 'Internal move to Business entity',
        requiresConfirmation: true,
      };
    }

    return {
      intent: 'UNKNOWN',
      requiresConfirmation: true,
    };
  }

  /**
   * Formulates a plain-language explanation of a risk decision for the user.
   */
  public formatRiskExplanation(rulesTriggered: string[], riskLevel: string): string {
    if (riskLevel === 'HIGH') {
      return `For your protection, this transaction has been flagged for manual review due to: ${rulesTriggered.join(', ')}.`;
    }
    if (riskLevel === 'MEDIUM') {
      return `To secure your account, please complete Step-Up Verification (Biometric or App PIN). Reason: ${rulesTriggered.join(', ')}.`;
    }
    return 'Transaction passed automated security check.';
  }
}
