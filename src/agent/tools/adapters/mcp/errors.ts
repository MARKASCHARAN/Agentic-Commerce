import { ToolAdapterError } from '../errors';

export class MCPToolAdapterError extends ToolAdapterError {
  constructor(message: string, cause?: unknown) {
    super(message, 'mcp', cause);
    this.name = 'MCPToolAdapterError';
  }
}

export class MCPToolNotFoundError extends MCPToolAdapterError {
  constructor(toolName: string) {
    super(`MCP Tool not found: ${toolName}`);
    this.name = 'MCPToolNotFoundError';
  }
}

export class MCPConnectionError extends MCPToolAdapterError {
  constructor(message: string, cause?: unknown) {
    super(`MCP Connection Error: ${message}`, cause);
    this.name = 'MCPConnectionError';
  }
}

export class MCPInvocationError extends MCPToolAdapterError {
  constructor(toolName: string, message: string, cause?: unknown) {
    super(`MCP Tool Invocation Error for ${toolName}: ${message}`, cause);
    this.name = 'MCPInvocationError';
  }
}

export class MCPProtocolError extends MCPToolAdapterError {
  constructor(message: string, cause?: unknown) {
    super(`MCP Protocol Error: ${message}`, cause);
    this.name = 'MCPProtocolError';
  }
}
