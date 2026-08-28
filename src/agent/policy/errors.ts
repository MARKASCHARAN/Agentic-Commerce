export class PolicyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PolicyError';
  }
}

export class PolicyValidationError extends PolicyError {
  constructor(message: string, cause?: unknown) {
    super(`Policy Validation Error: ${message}`, cause);
    this.name = 'PolicyValidationError';
  }
}

export class PolicyNotFoundError extends PolicyError {
  constructor(policyId: string) {
    super(`Policy not found in registry: ${policyId}`);
    this.name = 'PolicyNotFoundError';
  }
}

export class PolicyAlreadyRegisteredError extends PolicyError {
  constructor(policyId: string) {
    super(`Policy already registered: ${policyId}`);
    this.name = 'PolicyAlreadyRegisteredError';
  }
}

export class PolicyExecutionError extends PolicyError {
  constructor(message: string, cause?: unknown) {
    super(`Policy Execution Error: ${message}`, cause);
    this.name = 'PolicyExecutionError';
  }
}

export class PolicyAuthorizationError extends PolicyError {
  constructor(public readonly policyId: string, public readonly reason: string) {
    super(`Policy Denied Execution [${policyId}]: ${reason}`);
    this.name = 'PolicyAuthorizationError';
  }
}

export class PolicyApprovalRequiredError extends PolicyError {
  constructor(public readonly policyId: string, public readonly requiredApprovals: string[], public readonly reason?: string) {
    super(`Policy Requires Approval [${policyId}]: ${reason || 'Manual approval needed'} (Required: ${requiredApprovals.join(', ')})`);
    this.name = 'PolicyApprovalRequiredError';
  }
}
