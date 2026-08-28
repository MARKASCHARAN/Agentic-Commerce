import { z } from 'zod';
import { ExecutionIdentity } from '../runtime/types';

/**
 * A branded string type representing a unique Policy ID.
 */
export type PolicyId = string & {
  readonly __brand: 'PolicyId';
};

/**
 * Core metadata defining a Policy in the registry.
 */
export interface PolicyMetadata {
  id: PolicyId;
  name: string;
  description: string;
  version: string;
}

/**
 * The deterministic outcome of a policy evaluation.
 */
export type PolicyDecisionResult = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

/**
 * The structured result of a policy evaluation, containing the decision
 * and any required human/system workflow approvals or denial reasons.
 */
export interface PolicyDecision {
  result: PolicyDecisionResult;
  reason?: string;
  requiredApprovals?: string[];
}

/**
 * Context provided to a Policy during evaluation.
 * Extends the standard ExecutionIdentity from the core runtime.
 */
export interface PolicyContext extends ExecutionIdentity {
  // We can add policy-specific context later, e.g., agent/merchant limits
}

/**
 * The generic contract for a deterministic Policy.
 * 
 * Policies never interact with LLMs directly. They take validated inputs
 * and system context to produce a strict ALLOW, DENY, or REQUIRE_APPROVAL decision.
 */
export interface Policy<Input = unknown> {
  metadata: PolicyMetadata;
  
  /**
   * Zod schema ensuring the input is structurally valid before evaluation.
   */
  inputSchema: z.ZodType<Input>;
  
  /**
   * Evaluates the policy deterministically.
   * MUST NOT throw for standard policy failures (return DENY instead).
   * 
   * @throws {PolicyExecutionError} only if the policy crashes unexpectedly.
   */
  evaluate(input: Input, context: PolicyContext): Promise<PolicyDecision> | PolicyDecision;
}
