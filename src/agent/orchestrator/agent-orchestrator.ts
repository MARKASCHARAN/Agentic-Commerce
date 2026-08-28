import { AgentRuntime } from '../runtime/agent-runtime';
import { ExecutionIdentity, TurnResult } from '../runtime/types';
import { OrchestratorOptions } from './types';
import { RateLimiter, RateLimiterRequest } from '../rate-limiting';

export class AgentOrchestrator {
  constructor(
    private readonly runtime: AgentRuntime,
    private readonly rateLimiter?: RateLimiter
  ) {}

  async execute(identity: ExecutionIdentity, initialTask: string, options?: OrchestratorOptions): Promise<TurnResult> {
    if (this.rateLimiter && options?.rateLimits) {
      const rateLimitRequests: RateLimiterRequest[] = [];
      if (options.rateLimits.agent && identity.agentId) {
        rateLimitRequests.push({
          identity: { type: 'agent', id: identity.agentId },
          config: options.rateLimits.agent
        });
      }
      if (options.rateLimits.session && identity.sessionId) {
        rateLimitRequests.push({
          identity: { type: 'session', id: identity.sessionId },
          config: options.rateLimits.session
        });
      }
      if (rateLimitRequests.length > 0) {
        await this.rateLimiter.consume(rateLimitRequests);
      }
    }

    const maxTurns = options?.maxTurns ?? 5;
    let turnCount = 0;
    
    let accumulatedTokens = 0;
    const globalMaxTokens = options?.budget?.maxTokens;
    
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        abortController.abort(options.abortSignal?.reason || new Error('Explicitly cancelled'));
      });
      if (options.abortSignal.aborted) {
        abortController.abort(options.abortSignal.reason || new Error('Explicitly cancelled'));
      }
    }

    if (options?.timeoutMs) {
      timeoutId = setTimeout(() => {
        abortController.abort(new Error('Execution timed out'));
      }, options.timeoutMs);
    }

    let currentTask = initialTask;
    let finalTurnResult: TurnResult | undefined;

    try {
      while (turnCount < maxTurns) {
        if (abortController.signal.aborted) {
          throw abortController.signal.reason || new Error('Execution cancelled');
        }

        turnCount++;
        
        const turnBudget = globalMaxTokens !== undefined ? { maxTokens: globalMaxTokens - accumulatedTokens } : undefined;

        const turnOptions = {
          abortSignal: abortController.signal,
          budget: turnBudget,
        };

        const result = await this.runtime.execute(identity, currentTask, turnOptions);
        accumulatedTokens += result.usage.totalTokens;
        finalTurnResult = result;

        if (result.action === 'FINAL_RESPONSE') {
          break;
        } else if (result.action === 'TOOL_REQUEST') {
          currentTask = 'continue';
        } else if (result.action === 'CONTINUE') {
          currentTask = 'continue';
        }
      }

      if (turnCount >= maxTurns && finalTurnResult?.action !== 'FINAL_RESPONSE') {
        throw new Error(`Execution exceeded maximum allowed turns (${maxTurns}) without a FINAL_RESPONSE.`);
      }

      return finalTurnResult as TurnResult;

    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
