/**
 * Base error for all Policy Engine related failures.
 */
export class PolicyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PolicyError';
  }
}

/**
 * Thrown when a policy fails input validation (e.g., malformed configuration or missing fields).
 */
export class PolicyValidationError extends PolicyError {
  constructor(message: string, cause?: unknown) {
    super(`Policy Validation Error: ${message}`, cause);
    this.name = 'PolicyValidationError';
  }
}

/**
 * Thrown when the requested policy ID is not found in the registry.
 */
export class PolicyNotFoundError extends PolicyError {
  constructor(policyId: string) {
    super(`Policy not found in registry: ${policyId}`);
    this.name = 'PolicyNotFoundError';
  }
}

/**
 * Thrown when attempting to register a policy with an ID that already exists.
 */
export class PolicyAlreadyRegisteredError extends PolicyError {
  constructor(policyId: string) {
    super(`Policy already registered: ${policyId}`);
    this.name = 'PolicyAlreadyRegisteredError';
  }
}

/**
 * Thrown only when a policy crashes or fails to execute properly, NOT for a DENY decision.
 */
export class PolicyExecutionError extends PolicyError {
  constructor(message: string, cause?: unknown) {
    super(`Policy Execution Error: ${message}`, cause);
    this.name = 'PolicyExecutionError';
  }
}

/**
 * Thrown when a policy actively denies execution.
 * This represents a deterministic business or security rule violation.
 */
export class PolicyAuthorizationError extends PolicyError {
  constructor(public readonly policyId: string, public readonly reason: string) {
    super(`Policy Denied Execution [${policyId}]: ${reason}`);
    this.name = 'PolicyAuthorizationError';
  }
}

/**
 * Thrown when a policy requires human or external workflow approval before proceeding.
 * The original request must be halted until the approval is completed.
 */
export class PolicyApprovalRequiredError extends PolicyError {
  constructor(public readonly policyId: string, public readonly requiredApprovals: string[], public readonly reason?: string) {
    super(`Policy Requires Approval [${policyId}]: ${reason || 'Manual approval needed'} (Required: ${requiredApprovals.join(', ')})`);
    this.name = 'PolicyApprovalRequiredError';
  }
}
