import { RiskDecision, RiskContext, RiskRule } from './types';

/**
 * Mock rule to flag repeated interactions that might indicate an out-of-control agent or attack.
 */
export class HighVelocityRule implements RiskRule {
  id = 'rule_velocity_limit';
  name = 'High Velocity Rule';

  async evaluate(toolId: string, input: any, context: RiskContext): Promise<RiskDecision> {
    // In a real system, this would query a RateLimiter or TimeSeries DB
    // For deterministic testing, we inspect the input for special test flags.
    if (input?.paymentId === 'risk_velocity_deny') {
      return {
        status: 'DENY',
        score: 95,
        reason: 'Agent has exceeded safe velocity threshold',
        flags: ['velocity_limit_exceeded']
      };
    }
    return { status: 'ALLOW', score: 0, flags: [] };
  }
}

/**
 * Mock rule to flag unusually large transactions for review.
 */
export class AnomalousVolumeRule implements RiskRule {
  id = 'rule_anomalous_volume';
  name = 'Anomalous Volume Rule';

  constructor(private readonly reviewThresholdMinor: number = 500000) {}

  async evaluate(toolId: string, input: any, context: RiskContext): Promise<RiskDecision> {
    if (toolId === 'capture-payment' && typeof input?.amountMinor === 'number') {
      if (input.amountMinor > this.reviewThresholdMinor) {
        return {
          status: 'REVIEW',
          score: 75,
          reason: `Transaction amount ${input.amountMinor} exceeds risk review threshold of ${this.reviewThresholdMinor}`,
          flags: ['anomalous_volume']
        };
      }
    }
    return { status: 'ALLOW', score: 0, flags: [] };
  }
}
