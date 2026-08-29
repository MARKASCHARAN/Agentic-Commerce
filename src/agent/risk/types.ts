export type RiskDecisionStatus = 'ALLOW' | 'REVIEW' | 'DENY';

export interface RiskDecision {
  status: RiskDecisionStatus;
  score: number;
  reason?: string;
  flags: string[];
}

export interface RiskContext {
  agentId: string;
  sessionId: string;
  executionId: string;
  merchantId: string;
  // Extensible for future signals
  [key: string]: any;
}

export interface RiskRule {
  id: string;
  name: string;
  evaluate(toolId: string, input: any, context: RiskContext): Promise<RiskDecision>;
}

export class RiskEvaluationError extends Error {
  constructor(message: string, public decision?: RiskDecision) {
    super(`Risk Denied Execution: ${message}`);
    this.name = 'RiskEvaluationError';
  }
}
