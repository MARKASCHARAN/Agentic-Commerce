import { ToolRegistry } from './tool-registry';
import { ToolExecutionRequest, ToolExecutionResult } from './types';
import { ToolValidationError, ToolExecutionError, ToolNotFoundError } from './errors';
import { PolicyEngine } from '../policy/policy-engine';
import { PolicyAuthorizationError, PolicyApprovalRequiredError } from '../policy/errors';
import { RateLimiter, RateLimitConfig } from '../rate-limiting';
import { IdempotencyEngine } from '../idempotency/engine';

export interface ToolGatewayDependencies {
  toolRegistry: ToolRegistry;
  eventEmitter: {
    emit(event: string, payload: any): void;
  };
  policyEngine: PolicyEngine;
  rateLimiter?: RateLimiter;
  rateLimitConfigMap?: ReadonlyMap<string, RateLimitConfig>;
  idempotencyEngine?: IdempotencyEngine;
}

export class ToolGateway {
  constructor(private readonly deps: ToolGatewayDependencies) { }

  private emitEvent(event: string, payload: any): void {
    this.deps.eventEmitter.emit(event, payload);
  }

  async execute<Input = unknown, Output = unknown>(
    request: ToolExecutionRequest<Input>
  ): Promise<ToolExecutionResult<Output>> {
    const { toolId, input, context, timeoutMs } = request;
    const { executionId, agentId, sessionId, abortSignal } = context;

    const tool = this.deps.toolRegistry.get(toolId);

    if (abortSignal?.aborted) {
      throw abortSignal.reason || new Error(`Tool execution cancelled before starting: ${toolId}`);
    }

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        abortController.abort(abortSignal.reason || new Error('Explicitly cancelled'));
      });
      if (abortSignal.aborted) {
        abortController.abort(abortSignal.reason || new Error('Explicitly cancelled'));
      }
    }

    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        abortController.abort(new Error(`Execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    const toolContext = {
      executionId,
      agentId,
      sessionId,
      abortSignal: abortController.signal
    };

    const eventPayloadBase = { identity: { executionId, agentId, sessionId }, tool: toolId, toolId };

    try {
      this.deps.eventEmitter.emit('TOOL_STARTED', { ...eventPayloadBase });

      let validatedInput: Input;
      try {
        validatedInput = await tool.inputSchema.parseAsync(input) as Input;
      } catch (e: any) {
        throw new ToolValidationError(`Invalid input for tool ${toolId}: ${e.message}`);
      }

      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error(`Execution cancelled before running tool ${toolId}`);
      }

      if (this.deps.rateLimiter && this.deps.rateLimitConfigMap) {
        const rateLimitConfig = this.deps.rateLimitConfigMap.get(toolId);
        if (rateLimitConfig) {
          await this.deps.rateLimiter.consume([
            {
              identity: { type: 'tool', id: toolId },
              config: rateLimitConfig
            }
          ]);
        }
      }

      if (!tool.policy?.id) {
        throw new PolicyAuthorizationError('system.fail_closed', `Tool ${toolId} must declare a policy to execute.`);
      }

      this.deps.eventEmitter.emit('POLICY_CHECK_STARTED', { ...eventPayloadBase, policyId: tool.policy.id });

      // [FINANCIAL SAFETY]
      // Acts as an absolute firewall between probabilistic LLM intent and deterministic execution.
      // We validate cryptographic capabilities and merchant-defined constraints strictly before
      // any external API is touched, preventing prompt-injection from moving money.
      const policyDecision = await this.deps.policyEngine.evaluate(
        tool.policy.id,
        validatedInput,
        { agentId, sessionId, executionId }
      );

      this.deps.eventEmitter.emit('POLICY_CHECK_COMPLETED', {
        ...eventPayloadBase,
        policyId: tool.policy.id,
        decision: policyDecision
      });

      if (policyDecision.result === 'DENY') {
        throw new PolicyAuthorizationError(tool.policy.id, policyDecision.reason || 'Policy explicitly denied execution');
      }

      if (policyDecision.result === 'REQUIRE_APPROVAL') {
        throw new PolicyApprovalRequiredError(tool.policy.id, policyDecision.requiredApprovals || [], policyDecision.reason);
      }

      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error(`Execution cancelled after policy check for tool ${toolId}`);
      }

      const executeAdapter = async () => {
        return await tool.adapter.execute(validatedInput, toolContext);
      };

      let rawOutput: any;

      if (tool.idempotency?.required) {
        if (!this.deps.idempotencyEngine) {
          throw new ToolExecutionError(`Tool ${toolId} requires idempotency, but IdempotencyEngine is not configured.`);
        }
        if (!context.idempotencyKey) {
          throw new ToolExecutionError(`Tool ${toolId} requires an idempotencyKey in the execution context.`);
        }

        const scope = tool.idempotency.scope;
        const key = context.idempotencyKey;
        
        rawOutput = await this.deps.idempotencyEngine.execute(
          key,
          scope,
          validatedInput,
          executeAdapter
        );
      } else {
        rawOutput = await executeAdapter();
      }

      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error(`Execution cancelled after running tool ${toolId}`);
      }

      let validatedOutput: Output;
      try {
        validatedOutput = await tool.outputSchema.parseAsync(rawOutput) as Output;
      } catch (e: any) {
        throw new ToolValidationError(`Invalid output from tool ${toolId}: ${e.message}`);
      }

      this.deps.eventEmitter.emit('TOOL_COMPLETED', { ...eventPayloadBase, result: validatedOutput });

      return {
        toolId,
        output: validatedOutput
      };

    } catch (error: any) {
      this.deps.eventEmitter.emit('TOOL_FAILED', { ...eventPayloadBase, error });

      if (
        error instanceof ToolValidationError ||
        error instanceof ToolNotFoundError ||
        error instanceof PolicyAuthorizationError ||
        error instanceof PolicyApprovalRequiredError
      ) {
        throw error;
      }

      if (error.name === 'AbortError' || error.message?.includes('timed out') || error.message?.includes('cancelled')) {
        throw error;
      }

      throw new ToolExecutionError(`Tool execution failed: ${error.message}`, error);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
