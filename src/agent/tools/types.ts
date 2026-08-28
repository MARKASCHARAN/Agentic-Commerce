import { z } from 'zod';
import { ExecutionIdentity } from '../runtime/types';
import { ToolAdapter } from './adapters';

export type ToolId = string & {
  readonly __brand: "ToolId";
};

export interface ToolMetadata {
  id: ToolId;
  name: string;
  description: string;
  version: string;
}

export interface ToolExecutionContext extends ExecutionIdentity {
  abortSignal?: AbortSignal;
  idempotencyKey?: string;
}

export interface ToolExecutionRequest<Input = unknown> {
  toolId: string;
  input: Input;
  context: ToolExecutionContext;
  timeoutMs?: number;
}

export interface ToolExecutionResult<Output = unknown> {
  toolId: string;
  output: Output;
}

export interface Tool<Input = unknown, Output = unknown> {
  metadata: ToolMetadata;

  inputSchema: z.ZodType<Input>;
  outputSchema: z.ZodType<Output>;

  adapter: ToolAdapter<Input, Output>;

  policy?: {
    id: string;
  };

  idempotency?: {
    required: boolean;
    scope: string;
  };
}
