import { ExecutionIdentity, ExecutionOptions } from '../runtime/types';

export interface OrchestratorOptions extends ExecutionOptions {
  maxTurns?: number;
}
