import { PolicyContext, PolicyDecision } from './types';
import { PolicyRegistry } from './policy-registry';
import { PolicyExecutionError } from './errors';

export class PolicyEngine {
  constructor(private readonly registry: PolicyRegistry) {}

  async evaluate(policyId: string, input: unknown, context: PolicyContext): Promise<PolicyDecision> {
    try {
      const policy = this.registry.get(policyId);
      
      const parsedInput = await policy.inputSchema.parseAsync(input);
      
      return await policy.evaluate(parsedInput, context);
    } catch (error: any) {
      if (error instanceof PolicyExecutionError) {
        throw error;
      }
      throw new PolicyExecutionError(`Policy evaluation failed for ${policyId}: ${error.message}`, error);
    }
  }
}
