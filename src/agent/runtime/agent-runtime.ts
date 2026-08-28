import { 
  AgentRuntimeDependencies, 
  ExecutionIdentity, 
  ExecutionState, 
  ExecutionOptions,
  Execution,
  RuntimeActionSchema,
  TurnResult,
  SkillExecutionRequest,
  SkillExecutionResult
} from './types';
import { SkillNotFoundError, SkillValidationError } from '../skills/errors';

export class AgentRuntime {
  constructor(private readonly deps: AgentRuntimeDependencies) {}

  async execute(identity: ExecutionIdentity, task: string, options?: ExecutionOptions): Promise<TurnResult> {
    const startedAt = new Date();
    let deadline: Date | undefined;

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
      deadline = new Date(startedAt.getTime() + options.timeoutMs);
      timeoutId = setTimeout(() => {
        abortController.abort(new Error('Execution timed out'));
      }, options.timeoutMs);
    }

    const execution: Execution = {
      executionId: identity.executionId,
      agentId: identity.agentId,
      sessionId: identity.sessionId,
      state: 'CREATED',
      startedAt,
      deadline,
      budget: options?.budget,
    };

    await this.deps.stateManager.createExecution({ ...execution });
    this.deps.eventEmitter.emit('STATE_CHANGED', { identity, state: execution.state });

    let tokensUsed = 0;

    try {
      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error('Cancelled before running');
      }

      execution.state = 'RUNNING';
      await this.updateState(execution.executionId, execution.state, identity);

      this.deps.eventEmitter.emit('EXECUTION_STARTED', { identity, task, execution });

      const context = await this.deps.stateManager.loadContext(identity, task);

      if (this.deps.revenueEngine) {

        const merchantId = context.scopedData?.merchantId || identity.userId;
        
        if (merchantId) {
          const revenueOpportunity = await this.deps.revenueEngine.analyze(merchantId, {
            sessionId: identity.sessionId,
            ...context.scopedData 
          });
          
          if (revenueOpportunity) {
            if (this.deps.revenueTracker) {
              await this.deps.revenueTracker.logProposal(revenueOpportunity);
            }
            context.runtimeMetadata.revenueOpportunity = revenueOpportunity;
          }
        }
      }

      const modelRes = await this.deps.modelGateway.structured({
        prompt: `Task: ${context.task}\nMetadata: ${JSON.stringify(context.runtimeMetadata)}\nConversation: ${JSON.stringify(context.conversation)}`,
        schema: RuntimeActionSchema,
        schemaName: 'RuntimeAction',
        schemaDescription: 'Determine the next action for the agent runtime',
      });

      const action = modelRes.object;

      tokensUsed += modelRes.usage.totalTokens;
      
      if (execution.budget?.maxTokens && tokensUsed > execution.budget.maxTokens) {
        throw new Error(`Token budget exceeded: used ${tokensUsed} tokens, max ${execution.budget.maxTokens}`);
      }

      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error('Execution cancelled');
      }

      let finalResult: TurnResult;

      if (action.type === 'FINAL_RESPONSE') {
        finalResult = { action: action.type, payload: action.payload.text, usage: { totalTokens: modelRes.usage.totalTokens } };
      } else if (action.type === 'TOOL_REQUEST') {
        const toolName = action.payload.toolName;

        try {
          const gatewayResult = await this.deps.toolGateway.execute({
            toolId: toolName,
            input: action.payload.input,
            context: { ...identity, abortSignal: abortController.signal }
          });
          
          finalResult = { action: action.type, payload: { toolName, result: gatewayResult.output }, usage: { totalTokens: modelRes.usage.totalTokens } };
        } catch (toolError: any) {
          
          throw new Error(`Unsupported/Failed action: Tool '${toolName}' could not be executed. Reason: ${toolError.message}`);
        }
      } else if (action.type === 'CONTINUE') {
        finalResult = { action: action.type, payload: action.payload, usage: { totalTokens: modelRes.usage.totalTokens } };
      } else {
        throw new Error(`Unsupported action type: ${(action as any).type}`);
      }

      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error('Execution cancelled');
      }

      execution.state = 'COMPLETED';
      await this.updateState(execution.executionId, execution.state, identity);
      
      this.deps.eventEmitter.emit('EXECUTION_COMPLETED', { identity, result: finalResult });
      return finalResult;

    } catch (error: any) {
      const isTimeout = error.message === 'Execution timed out';
      const isCancel = error.message === 'Explicitly cancelled' || error.message === 'Execution cancelled' || error.name === 'AbortError' || abortController.signal.aborted;

      if (isTimeout || isCancel) {
        execution.state = 'CANCELLED';
        await this.updateState(execution.executionId, execution.state, identity);
        this.deps.eventEmitter.emit('EXECUTION_CANCELLED', { identity, reason: error.message || 'Cancelled' });
      } else {
        execution.state = 'FAILED';
        await this.updateState(execution.executionId, execution.state, identity);
        this.deps.eventEmitter.emit('EXECUTION_FAILED', { identity, error });
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async updateState(executionId: string, state: ExecutionState, identity: ExecutionIdentity) {
    await this.deps.stateManager.saveState(executionId, state);
    this.deps.eventEmitter.emit('STATE_CHANGED', { identity, state });
  }

  async executeSkill<Input = unknown, Output = unknown>(
    identity: ExecutionIdentity,
    request: SkillExecutionRequest<Input>
  ): Promise<SkillExecutionResult<Output>> {
    if (!this.deps.skillRegistry) {
      throw new Error('SkillRegistry is not configured in AgentRuntimeDependencies');
    }

    if (request.options?.abortSignal?.aborted) {
      throw request.options.abortSignal.reason || new Error('Execution cancelled before skill start');
    }

    const skill = this.deps.skillRegistry.get(request.skillId);

    this.deps.eventEmitter.emit('SKILL_STARTED', { identity, skillId: request.skillId });

    try {
      
      let validatedInput: Input;
      try {
        validatedInput = await skill.inputSchema.parseAsync(request.input) as Input;
      } catch (validationError: any) {
        throw new SkillValidationError(`Invalid input for skill ${request.skillId}: ${validationError.message}`);
      }

      if (request.options?.abortSignal?.aborted) {
        throw request.options.abortSignal.reason || new Error('Execution cancelled during skill execution');
      }

      const context = {
        ...identity,
        abortSignal: request.options?.abortSignal,
      };
      
      const rawOutput = await skill.execute(validatedInput, context);

      if (request.options?.abortSignal?.aborted) {
        throw request.options.abortSignal.reason || new Error('Execution cancelled after skill execution');
      }

      let validatedOutput: Output;
      try {
        validatedOutput = await skill.outputSchema.parseAsync(rawOutput) as Output;
      } catch (validationError: any) {
        throw new SkillValidationError(`Invalid output from skill ${request.skillId}: ${validationError.message}`);
      }

      this.deps.eventEmitter.emit('SKILL_COMPLETED', { identity, skillId: request.skillId, result: validatedOutput });

      return {
        skillId: request.skillId,
        output: validatedOutput,
      };
    } catch (error: any) {
      this.deps.eventEmitter.emit('SKILL_FAILED', { identity, skillId: request.skillId, error });
      throw error;
    }
  }
}
