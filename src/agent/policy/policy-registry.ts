import { Policy, PolicyId, PolicyMetadata } from './types';
import {
  PolicyAlreadyRegisteredError,
  PolicyNotFoundError,
  PolicyValidationError
} from './errors';

export class PolicyRegistry {
  private readonly policies = new Map<PolicyId, Policy<unknown>>();

  register(policy: Policy<unknown>): void {
    this.validatePolicy(policy);

    if (this.policies.has(policy.metadata.id)) {
      throw new PolicyAlreadyRegisteredError(policy.metadata.id);
    }

    this.policies.set(policy.metadata.id, policy);
  }

  unregister(policyId: string): void {
    this.policies.delete(policyId as PolicyId);
  }

  get(policyId: string): Policy<unknown> {
    const policy = this.policies.get(policyId as PolicyId);
    if (!policy) {
      throw new PolicyNotFoundError(policyId);
    }
    return policy;
  }

  has(policyId: string): boolean {
    return this.policies.has(policyId as PolicyId);
  }

  list(): PolicyMetadata[] {
    return Array.from(this.policies.values()).map(policy => ({ ...policy.metadata }));
  }

  private validatePolicy(policy: Policy<unknown>): void {
    if (!policy) {
      throw new PolicyValidationError('Policy is undefined or null.');
    }
    if (!policy.metadata) {
      throw new PolicyValidationError('Policy is missing metadata.');
    }
    if (!policy.metadata.id) {
      throw new PolicyValidationError('Policy metadata is missing id.');
    }
    if (!policy.metadata.name) {
      throw new PolicyValidationError('Policy metadata is missing name.');
    }
    if (!policy.metadata.description) {
      throw new PolicyValidationError('Policy metadata is missing description.');
    }
    if (!policy.metadata.version) {
      throw new PolicyValidationError('Policy metadata is missing version.');
    }
    if (!policy.inputSchema) {
      throw new PolicyValidationError('Policy is missing inputSchema.');
    }
    if (typeof policy.evaluate !== 'function') {
      throw new PolicyValidationError('Policy is missing an evaluate function.');
    }
  }
}
