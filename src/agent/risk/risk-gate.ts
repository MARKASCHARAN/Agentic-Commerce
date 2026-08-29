import { RiskDecision, RiskContext, RiskRule } from './types';

export class RiskGate {
  constructor(private readonly rules: RiskRule[]) {}

  async evaluate(toolId: string, input: any, context: RiskContext): Promise<RiskDecision> {
    const decisions = await Promise.all(
      this.rules.map(rule => rule.evaluate(toolId, input, context))
    );

    let finalDecision: RiskDecision = { status: 'ALLOW', score: 0, flags: [] };
    let reviewDecisions: RiskDecision[] = [];

    for (const decision of decisions) {
      if (decision.status === 'DENY') {
        // Immediate hard failure, return highest severity immediately
        return decision;
      }
      if (decision.status === 'REVIEW') {
        reviewDecisions.push(decision);
      }
    }

    if (reviewDecisions.length > 0) {
      // Aggregate review flags and pick highest score
      const highestScoreReview = reviewDecisions.reduce((max, current) => 
        current.score > max.score ? current : max
      );
      
      const allFlags = Array.from(new Set(reviewDecisions.flatMap(d => d.flags)));
      const combinedReason = reviewDecisions.map(d => d.reason).filter(Boolean).join('; ');

      return {
        status: 'REVIEW',
        score: highestScoreReview.score,
        reason: combinedReason,
        flags: allFlags
      };
    }

    return finalDecision;
  }
}
