import { ToolRegistry } from './tool-registry';
import { ToolExecutionRequest, ToolExecutionResult } from './types';
import { ToolValidationError, ToolExecutionError, ToolNotFoundError } from './errors';

export interface ToolGatewayDependencies {
  toolRegistry: ToolRegistry;
  eventEmitter: {
    emit(event: string, payload: any): void;
  };
}

export class ToolGateway {
  constructor(private readonly deps: ToolGatewayDependencies) {}

  /**
   * Executes a tool via the registry, providing validation, timeouts,
   * cancellation, and lifecycle events.
   * 
   * @param request The tool execution request containing inputs and context.
   * @returns A promise resolving to the strict output of the tool.
   */
  async execute<Input = unknown, Output = unknown>(
    request: ToolExecutionRequest<Input>
  ): Promise<ToolExecutionResult<Output>> {
    const { toolId, input, context, timeoutMs } = request;
    const { executionId, agentId, sessionId, abortSignal } = context;
    
    // Resolve tool
    const tool = this.deps.toolRegistry.get(toolId); // Throws ToolNotFoundError

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

      // Validate Input
      let validatedInput: Input;
      try {
        validatedInput = await tool.inputSchema.parseAsync(input) as Input;
      } catch (e: any) {
        throw new ToolValidationError(`Invalid input for tool ${toolId}: ${e.message}`);
      }

      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error(`Execution cancelled before running tool ${toolId}`);
      }

      // Execute Tool via Adapter
      const rawOutput = await tool.adapter.execute(validatedInput, toolContext);

      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error(`Execution cancelled after running tool ${toolId}`);
      }

      // Validate Output
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
      
      // Preserve ToolValidationError and ToolNotFoundError
      if (error instanceof ToolValidationError || error instanceof ToolNotFoundError) {
        throw error;
      }
      
      // If it's a cancellation or timeout, throw it transparently or wrap it
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
