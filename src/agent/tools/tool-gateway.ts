import { ToolRegistry } from './tool-registry';
import { ToolExecutionRequest, ToolExecutionResult } from './types';
import { ToolValidationError, ToolExecutionError, ToolNotFoundError } from './errors';
import { PolicyEngine } from '../policy/policy-engine';
import { PolicyAuthorizationError, PolicyApprovalRequiredError } from '../policy/errors';
import { RateLimiter, RateLimitConfig } from '../rate-limiting';
import { IdempotencyEngine } from '../idempotency/engine';
import { MerchantGuardrailRepository } from '../../database/repositories/merchant-guardrail.repository';
import { RiskGate, RiskEvaluationError } from '../risk';
import { MerchantCapabilityResolver } from '../intelligence/capability-resolver';
import { MerchantCapability } from '../intelligence/types';

export interface ToolGatewayDependencies {
  toolRegistry: ToolRegistry;
  eventEmitter: {
    emit(event: string, payload: any): void;
  };
  policyEngine: PolicyEngine;
  rateLimiter?: RateLimiter;
  rateLimitConfigMap?: ReadonlyMap<string, RateLimitConfig>;
  idempotencyEngine?: IdempotencyEngine;
  guardrailRepository?: MerchantGuardrailRepository;
  capabilityResolver?: MerchantCapabilityResolver;
  riskGate?: RiskGate;
}

export class ToolGateway {
  constructor(private readonly deps: ToolGatewayDependencies) { }

  private emitEvent(event: string, payload: any): void {
    this.deps.eventEmitter.emit(event, payload);
  }

  listTools() {
    return this.deps.toolRegistry.list();
  }

  getTool(toolId: string) {
    return this.deps.toolRegistry.get(toolId);
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
      merchantId: context.merchantId,
      abortSignal: abortController.signal,
      revenueOpportunity: context.revenueOpportunity,
      idempotencyKey: context.idempotencyKey
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

      // 1. CAPABILITY RESOLUTION
      if (tool.requiredCapabilities && tool.requiredCapabilities.length > 0) {
        if (!context.merchantId) {
          throw new PolicyAuthorizationError('system.fail_closed', `Tool ${toolId} requires a merchant identity for capability validation.`);
        }
        if (!this.deps.capabilityResolver) {
          throw new PolicyAuthorizationError('system.fail_closed', `Tool ${toolId} requires capability checking but no capability resolver was configured.`);
        }
        
        const capabilities = await this.deps.capabilityResolver.resolve(context.merchantId);
        for (const req of tool.requiredCapabilities) {
          if (!capabilities.has(req as MerchantCapability)) {
            throw new PolicyAuthorizationError('system.capability_denied', `Merchant lacks required capability: ${req}`);
          }
        }
      }

      // 2. GUARDRAIL RESOLUTION
      let guardrails = undefined;
      // If a tool has a policy, it may need guardrails (especially financial policies)
      // ToolGateway enforces that if guardrails are supported by the system and we have a merchant context, they must be loaded.
      if (tool.policy?.id) {
        if (!context.merchantId) {
          throw new PolicyAuthorizationError('system.fail_closed', `Tool ${toolId} policy execution requires a merchant identity.`);
        }
        if (this.deps.guardrailRepository) {
          guardrails = await this.deps.guardrailRepository.getGuardrails(context.merchantId);
          if (!guardrails) {
            throw new PolicyAuthorizationError('system.fail_closed', `Guardrails required for policy execution but missing for merchant ${context.merchantId}.`);
          }
        }
      }

      // [FINANCIAL SAFETY]
      // Acts as an absolute firewall between probabilistic LLM intent and deterministic execution.
      // We validate cryptographic capabilities and merchant-defined constraints strictly before
      // any external API is touched, preventing prompt-injection from moving money.
      const policyDecision = await this.deps.policyEngine.evaluate(
        tool.policy.id,
        validatedInput,
        { agentId, sessionId, executionId, merchantId: context.merchantId, guardrails }
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

      // 4. RISK GATE RESOLUTION
      if (this.deps.riskGate) {
        const riskContext = {
          agentId: agentId || 'unknown',
          sessionId,
          executionId,
          merchantId: context.merchantId!,
          amountMinor: (validatedInput as any)?.amountMinor
        };
        const riskDecision = await this.deps.riskGate.evaluate(toolId, validatedInput, riskContext);

        this.deps.eventEmitter.emit('RISK_CHECK_COMPLETED', {
          ...eventPayloadBase,
          decision: riskDecision
        });

        if (riskDecision.status === 'DENY') {
          throw new RiskEvaluationError(riskDecision.reason || 'Risk Gate denied execution', riskDecision);
        }

        if (riskDecision.status === 'REVIEW') {
          // A Risk REVIEW forces an approval workflow
          throw new PolicyApprovalRequiredError('risk-gate', ['risk-team'], riskDecision.reason || 'Risk requires manual review');
        }
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
        error instanceof ToolValidationError || error.name === 'ToolValidationError' ||
        error instanceof ToolNotFoundError || error.name === 'ToolNotFoundError' ||
        error instanceof PolicyAuthorizationError || error.name === 'PolicyAuthorizationError' ||
        error instanceof PolicyApprovalRequiredError || error.name === 'PolicyApprovalRequiredError' ||
        error instanceof RiskEvaluationError || error.name === 'RiskEvaluationError'
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
