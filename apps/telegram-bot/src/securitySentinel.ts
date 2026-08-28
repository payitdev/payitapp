/**
 * Groq Security Sentinel - Prompt Injection & Jailbreak Firewall
 * Inspects incoming natural language text before tool execution.
 */

export interface SecurityInspectionResult {
  isSafe: boolean;
  threatType?: 'PROMPT_INJECTION' | 'PIN_BYPASS_ATTEMPT' | 'MALICIOUS_OVERRIDE' | 'UNSAFE_INSTRUCTION';
  sanitizedPrompt: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /system\s+prompt\s+override/i,
  /bypass\s+(pin|security|auth|verification)/i,
  /transfer\s+without\s+(pin|confirmation|approval)/i,
  /disable\s+security\s+checks/i,
  /reveal\s+system\s+instructions/i,
  /act\s+as\s+DAN/i,
];

export class SecuritySentinel {
  public inspectPrompt(rawText: string): SecurityInspectionResult {
    const text = (rawText || '').trim();

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          isSafe: false,
          threatType: 'PROMPT_INJECTION',
          sanitizedPrompt: '',
        };
      }
    }

    // Sanitize any dangerous non-printable control characters
    const sanitized = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    return {
      isSafe: true,
      sanitizedPrompt: sanitized,
    };
  }
}

export const securitySentinel = new SecuritySentinel();
