import { entityStatusOverrides } from '../middleware/apiKeyAuth.js';

export interface TelemetryAnomaly {
  entityId: string;
  entityName: string;
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
  recentEndpoints: string[];
  recentStatusCodes: number[];
  payloadPatterns: string[];
}

export interface SecuritySentinelDecision {
  entityId: string;
  threatScore: number; // 0.0 to 1.0
  threatClassification: 'BENIGN' | 'ANOMALOUS_BURST' | 'PAYOUT_RUGPULL_RISK' | 'MALICIOUS_FUZZING' | 'CREDENTIAL_STUFFING';
  recommendedAction: 'NONE' | 'THROTTLE' | 'SUSPEND_PAYOUTS' | 'FREEZE';
  reasoning: string;
  confidenceScore: number;
  executedAction?: string;
}

export class GroqSecuritySentinel {
  private static groqApiKey: string = process.env.GROQ_API_KEY || '';
  private static groqModel: string = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  /**
   * Evaluates anomalous telemetry using Groq Llama 3.3 70B inference (or high-precision fallback heuristics).
   */
  public static async analyzeAndMitigate(telemetry: TelemetryAnomaly): Promise<SecuritySentinelDecision> {
    const prompt = `You are the Proxim AI Security Sentinel protecting an institutional Payments & Banking-as-a-Service (BaaS) platform.
Analyze this real-time developer API telemetry for abusive behavior, fuzzing attacks, rate-limit bypassing, or unauthorized payout batch draining.

Telemetry Data:
- Entity ID: "${telemetry.entityId}" (${telemetry.entityName})
- Total Requests in Window: ${telemetry.totalRequests}
- Failed Requests (4xx/5xx): ${telemetry.failedRequests}
- Error Rate: ${(telemetry.errorRate * 100).toFixed(1)}%
- Target Endpoints: ${JSON.stringify(telemetry.recentEndpoints)}
- HTTP Status Codes: ${JSON.stringify(telemetry.recentStatusCodes)}
- Observed Payload Patterns: ${JSON.stringify(telemetry.payloadPatterns)}

Respond ONLY with a valid JSON object matching this schema:
{
  "threatScore": number (0.0 to 1.0),
  "threatClassification": "BENIGN" | "ANOMALOUS_BURST" | "PAYOUT_RUGPULL_RISK" | "MALICIOUS_FUZZING" | "CREDENTIAL_STUFFING",
  "recommendedAction": "NONE" | "THROTTLE" | "SUSPEND_PAYOUTS" | "FREEZE",
  "reasoning": string (concise explanation),
  "confidenceScore": number (0.0 to 1.0)
}`;

    let decision: SecuritySentinelDecision;

    if (this.groqApiKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.groqModel,
            messages: [
              { role: 'system', content: 'You are Proxim Security Sentinel. Output strict JSON only.' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices[0].message.content);
          decision = {
            entityId: telemetry.entityId,
            threatScore: parsed.threatScore ?? 0.5,
            threatClassification: parsed.threatClassification ?? 'ANOMALOUS_BURST',
            recommendedAction: parsed.recommendedAction ?? 'NONE',
            reasoning: parsed.reasoning ?? 'Groq Llama 3.3 automated policy assessment',
            confidenceScore: parsed.confidenceScore ?? 0.9,
          };
        } else {
          decision = this.evaluateHeuristic(telemetry);
        }
      } catch {
        decision = this.evaluateHeuristic(telemetry);
      }
    } else {
      decision = this.evaluateHeuristic(telemetry);
    }

    // Automatically execute the recommended mitigation if threatScore > 0.75
    if (decision.threatScore >= 0.75 && decision.recommendedAction !== 'NONE') {
      let overrideStatus: 'THROTTLED' | 'SUSPENDED_PAYOUTS' | 'FROZEN' = 'THROTTLED';
      if (decision.recommendedAction === 'FREEZE') overrideStatus = 'FROZEN';
      if (decision.recommendedAction === 'SUSPEND_PAYOUTS') overrideStatus = 'SUSPENDED_PAYOUTS';

      entityStatusOverrides.set(telemetry.entityId, {
        status: overrideStatus,
        reason: `[AI Sentinel Autonomous Mitigation]: ${decision.reasoning}`,
        updatedAt: new Date().toISOString(),
      });

      decision.executedAction = `AUTONOMOUSLY_${overrideStatus}`;
      console.warn(`🚨 [GroqSecuritySentinel]: Executed ${overrideStatus} on entity ${telemetry.entityId}. Reason: ${decision.reasoning}`);
    }

    return decision;
  }

  /**
   * Deterministic mathematical rule engine fallback
   */
  private static evaluateHeuristic(t: TelemetryAnomaly): SecuritySentinelDecision {
    if (t.errorRate > 0.70 && t.totalRequests > 50) {
      return {
        entityId: t.entityId,
        threatScore: 0.92,
        threatClassification: 'MALICIOUS_FUZZING',
        recommendedAction: 'THROTTLE',
        reasoning: `High error rate (${(t.errorRate * 100).toFixed(0)}%) across ${t.totalRequests} requests indicate payload fuzzing or broken client retry loops.`,
        confidenceScore: 0.95,
      };
    }

    if (t.recentEndpoints.some(e => e.includes('/payouts')) && t.errorRate > 0.40) {
      return {
        entityId: t.entityId,
        threatScore: 0.88,
        threatClassification: 'PAYOUT_RUGPULL_RISK',
        recommendedAction: 'SUSPEND_PAYOUTS',
        reasoning: 'Anomalous velocity and failed parameters on batch payout endpoints.',
        confidenceScore: 0.90,
      };
    }

    return {
      entityId: t.entityId,
      threatScore: 0.15,
      threatClassification: 'BENIGN',
      recommendedAction: 'NONE',
      reasoning: 'Telemetry patterns within standard operational tolerance.',
      confidenceScore: 0.98,
    };
  }
}
