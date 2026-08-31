import { z } from 'zod';
import { Policy, PolicyContext, PolicyDecision, PolicyId, PolicyMetadata } from './types';

export interface FinancialPolicyConfig {
  allowedCurrency: string;
  maxAmountMinor: number;
  minAmountMinor?: number;
  approvalThresholdMinor?: number;
}

export interface FinancialInput {
  amountMinor: number;
  currency: string;
}

export class FinancialExecutionPolicy implements Policy<FinancialInput> {
  public readonly metadata: PolicyMetadata;
  public readonly inputSchema: z.ZodType<FinancialInput>;

  constructor(
    id: string,
    name: string,
    private readonly config: FinancialPolicyConfig
  ) {
    this.metadata = {
      id: id as PolicyId,
      name,
      description: `Financial policy limits for ${config.allowedCurrency}`,
      version: '1.0.0'
    };

    this.inputSchema = z.object({
      amountMinor: z.number().int().nonnegative(),
      currency: z.string().min(1)
    });
  }

  evaluate(input: FinancialInput, context: PolicyContext): PolicyDecision {
    if (context.existingApproval) {
      return { result: 'ALLOW' };
    }

    const effectiveCurrency = context.guardrails ? context.guardrails.currency : this.config.allowedCurrency;
    
    if (input.currency !== effectiveCurrency) {
      return {
        result: 'DENY',
        reason: `Currency mismatch. Expected ${effectiveCurrency}, got ${input.currency}`
      };
    }

    if (this.config.minAmountMinor !== undefined && input.amountMinor < this.config.minAmountMinor) {
      return {
        result: 'DENY',
        reason: `Amount is below minimum allowed limit of ${this.config.minAmountMinor}`
      };
    }

    if (this.config.maxAmountMinor !== undefined && input.amountMinor > this.config.maxAmountMinor) {
      return {
        result: 'DENY',
        reason: `Amount exceeds maximum allowed limit of ${this.config.maxAmountMinor}`
      };
    }

    // Dynamic Guardrails limits
    if (context.guardrails) {
      // 1. Autonomous limit check
      if (context.guardrails.autonomousPaymentLimitMinor > 0 && input.amountMinor > context.guardrails.autonomousPaymentLimitMinor) {
        return {
          result: 'REQUIRE_APPROVAL',
          reason: `Amount exceeds merchant autonomous limit of ${context.guardrails.autonomousPaymentLimitMinor}`,
          requiredApprovals: ['merchant']
        };
      }

      // 2. Approval threshold check (if autonomous limit allows it but approval threshold is stricter?)
      if (context.guardrails.approvalAboveMinor > 0 && input.amountMinor > context.guardrails.approvalAboveMinor) {
        return {
          result: 'REQUIRE_APPROVAL',
          reason: `Amount exceeds merchant approval threshold of ${context.guardrails.approvalAboveMinor}`,
          requiredApprovals: ['merchant']
        };
      }
    }

    // Fallback static threshold
    if (this.config.approvalThresholdMinor !== undefined && input.amountMinor > this.config.approvalThresholdMinor) {
      return {
        result: 'REQUIRE_APPROVAL',
        reason: `Amount exceeds autonomous approval threshold of ${this.config.approvalThresholdMinor}`,
        requiredApprovals: ['manager']
      };
    }

    return {
      result: 'ALLOW'
    };
  }
}
