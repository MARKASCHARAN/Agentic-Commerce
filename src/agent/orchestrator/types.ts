import { ExecutionIdentity, ExecutionOptions } from '../runtime/types';
import { RateLimitConfig } from '../rate-limiting/types';

export interface OrchestratorOptions extends ExecutionOptions {
  maxTurns?: number;
  rateLimits?: {
    agent?: RateLimitConfig;
    session?: RateLimitConfig;
  };
}
