import { z } from 'zod';
import { ExecutionIdentity } from '../runtime/types';
import { ToolAdapter } from './adapters';

/**
 * A branded string type representing a unique Tool ID.
 */
export type ToolId = string & {
  readonly __brand: "ToolId";
};

/**
 * Core metadata defining a Tool in the registry.
 */
export interface ToolMetadata {
  id: ToolId;
  name: string;
  description: string;
  version: string;
}

/**
 * Context provided to a Tool during execution.
 * We reuse the existing ExecutionIdentity from the core runtime types.
 */
export interface ToolExecutionContext extends ExecutionIdentity {
  abortSignal?: AbortSignal;
}

/**
 * Request to execute a specific tool.
 */
export interface ToolExecutionRequest<Input = unknown> {
  toolId: string;
  input: Input;
  context: ToolExecutionContext;
  timeoutMs?: number;
}

/**
 * Result of a tool execution.
 */
export interface ToolExecutionResult<Output = unknown> {
  toolId: string;
  output: Output;
}

/**
 * The base contract for a Tool.
 * A tool must explicitly define its input and output types.
 */
export interface Tool<Input = unknown, Output = unknown> {
  metadata: ToolMetadata;
  
  inputSchema: z.ZodType<Input>;
  outputSchema: z.ZodType<Output>;

  /**
   * The adapter responsible for executing the tool over its specific transport.
   * This replaces the direct `execute` method, allowing the Tool to remain
   * transport-agnostic while the gateway orchestrates the adapter.
   * 
   * @type {ToolAdapter<Input, Output>}
   */
  adapter: ToolAdapter<Input, Output>;
}
