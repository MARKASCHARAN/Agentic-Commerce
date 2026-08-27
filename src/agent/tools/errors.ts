export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ToolAlreadyRegisteredError extends ToolError {
  public readonly toolId: string;
  constructor(toolId: string) {
    super(`Tool already registered: ${toolId}`);
    this.name = 'ToolAlreadyRegisteredError';
    this.toolId = toolId;
  }
}

export class ToolNotFoundError extends ToolError {
  public readonly toolId: string;
  constructor(toolId: string) {
    super(`Tool not found: ${toolId}`);
    this.name = 'ToolNotFoundError';
    this.toolId = toolId;
  }
}

export class ToolValidationError extends ToolError {
  constructor(message: string) {
    super(`Tool validation failed: ${message}`);
    this.name = 'ToolValidationError';
  }
}

export class ToolExecutionError extends ToolError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
