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

/**
 * Core runtime that executes a single turn of an agentic workflow.
 */
export class AgentRuntime {
  constructor(private readonly deps: AgentRuntimeDependencies) {}

  /**
   * Executes a single turn of the agent lifecycle.
   * 
   * @param identity - The execution identity containing session and execution IDs.
   * @param task - The initial task or prompt for the agent turn.
   * @param options - Optional execution parameters including timeouts, abort signals, and token budgets.
   * @returns A promise that resolves to the result of the turn.
   */
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

        this.deps.eventEmitter.emit('TOOL_STARTED', { identity, tool: toolName });
        
        try {
          const toolResult = await this.deps.toolExecutor.executeTool(toolName, action.payload.input);
          this.deps.eventEmitter.emit('TOOL_COMPLETED', { identity, tool: toolName, result: toolResult });
          
          finalResult = { action: action.type, payload: { toolName, result: toolResult }, usage: { totalTokens: modelRes.usage.totalTokens } };
        } catch (toolError: any) {
          this.deps.eventEmitter.emit('TOOL_FAILED', { identity, tool: toolName, error: toolError });
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

  /**
   * Executes a specific skill by resolving it from the SkillRegistry.
   * Handles input/output validation and emits appropriate lifecycle events.
   * 
   * @param identity - The execution identity.
   * @param request - The skill execution request containing the skillId and input.
   * @returns A promise resolving to the typed skill execution result.
   */
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

    // 1. Resolve skill (throws SkillNotFoundError if missing)
    const skill = this.deps.skillRegistry.get(request.skillId);

    this.deps.eventEmitter.emit('SKILL_STARTED', { identity, skillId: request.skillId });

    try {
      // 2. Validate input
      let validatedInput: Input;
      try {
        validatedInput = await skill.inputSchema.parseAsync(request.input) as Input;
      } catch (validationError: any) {
        throw new SkillValidationError(`Invalid input for skill ${request.skillId}: ${validationError.message}`);
      }

      if (request.options?.abortSignal?.aborted) {
        throw request.options.abortSignal.reason || new Error('Execution cancelled during skill execution');
      }

      // 3. Execute skill
      const context = {
        ...identity,
        abortSignal: request.options?.abortSignal,
      };
      
      const rawOutput = await skill.execute(validatedInput, context);

      if (request.options?.abortSignal?.aborted) {
        throw request.options.abortSignal.reason || new Error('Execution cancelled after skill execution');
      }

      // 4. Validate output
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
