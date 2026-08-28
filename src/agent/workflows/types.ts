import { z } from 'zod';
import { ExecutionIdentity } from '../runtime/types';

export type WorkflowId = string & {
  readonly __brand: 'WorkflowId';
};

export type WorkflowState = string & {
  readonly __brand: 'WorkflowState';
};

export type WorkflowEvent = string & {
  readonly __brand: 'WorkflowEvent';
};

export interface WorkflowContext extends ExecutionIdentity {
  workflowId: WorkflowId;
  currentState: WorkflowState;
}

export interface WorkflowTransition<TState = string, TEvent = string> {
  from: TState;
  event: TEvent;
  to: TState;
  requiredTool?: string;
}

export interface WorkflowDefinition<TInput = unknown, TState = string, TEvent = string> {
  id: WorkflowId;
  name: string;
  version: string;
  
  inputSchema: z.ZodType<TInput>;
  
  initialState: TState;
  states: readonly TState[];
  events: readonly TEvent[];
  
  transitions: readonly WorkflowTransition<TState, TEvent>[];
}

export interface WorkflowExecutionResult {
  workflowId: WorkflowId;
  previousState: WorkflowState;
  newState: WorkflowState;
  event: WorkflowEvent;
}
