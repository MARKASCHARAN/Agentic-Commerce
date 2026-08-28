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
