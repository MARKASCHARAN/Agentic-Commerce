export class WorkflowError extends Error {
  constructor(message: string, public readonly workflowId?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class StaleWorkflowWorkerError extends WorkflowError {
  constructor(workflowId: string, public readonly instanceId: string, public readonly expectedVersion: number) {
    super(`Optimistic concurrency conflict: Workflow instance ${instanceId} modified by another worker (expected version: ${expectedVersion})`, workflowId);
  }
}

export class InvalidTransitionError extends WorkflowError {
  constructor(
    public readonly workflowId: string,
    public readonly currentState: string,
    public readonly requestedEvent: string
  ) {
    super(`Invalid transition for workflow ${workflowId}: Cannot execute event '${requestedEvent}' from state '${currentState}'`);
    this.name = 'InvalidTransitionError';
  }
}

export class InvalidWorkflowStateError extends WorkflowError {
  constructor(
    public readonly workflowId: string,
    public readonly state: string
  ) {
    super(`Invalid state for workflow ${workflowId}: State '${state}' is not defined in the workflow definition`);
    this.name = 'InvalidWorkflowStateError';
  }
}

export class WorkflowValidationError extends WorkflowError {
  constructor(
    public readonly workflowId: string,
    message: string,
    cause?: unknown
  ) {
    super(`Workflow Validation Error [${workflowId}]: ${message}`, workflowId);
    this.name = 'WorkflowValidationError';
    if (cause) this.cause = cause;
  }
}
