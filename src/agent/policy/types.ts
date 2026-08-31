import { z } from 'zod';
import { ExecutionIdentity } from '../runtime/types';
import { MerchantGuardrailConfig } from './guardrails';

export type PolicyId = string & {
  readonly __brand: 'PolicyId';
};

export interface PolicyMetadata {
  id: PolicyId;
  name: string;
  description: string;
  version: string;
}

export type PolicyDecisionResult = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export interface PolicyDecision {
  result: PolicyDecisionResult;
  reason?: string;
  requiredApprovals?: string[];
}

export interface PolicyContext extends ExecutionIdentity {
  guardrails?: MerchantGuardrailConfig;
  existingApproval?: boolean;
}

export interface Policy<Input = unknown> {
  metadata: PolicyMetadata;

  inputSchema: z.ZodType<Input>;

  evaluate(input: Input, context: PolicyContext): Promise<PolicyDecision> | PolicyDecision;
}
