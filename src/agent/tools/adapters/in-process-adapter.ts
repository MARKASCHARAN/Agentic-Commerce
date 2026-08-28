import { ToolAdapter, ToolAdapterContext, ToolAdapterType } from './types';
import { ToolAdapterError } from './errors';

export class InProcessToolAdapter<Input = unknown, Output = unknown> implements ToolAdapter<Input, Output> {
  public readonly type: ToolAdapterType = 'in-process';

  constructor(
    private readonly executeFn: (input: Input, context: ToolAdapterContext) => Promise<Output>
  ) {}

  async execute(input: Input, context: ToolAdapterContext): Promise<Output> {
    if (context.abortSignal?.aborted) {
      throw context.abortSignal.reason || new ToolAdapterError('Execution aborted before start', this.type);
    }

    try {
      return await this.executeFn(input, context);
    } catch (error: any) {
      if (context.abortSignal?.aborted && error === context.abortSignal.reason) {
        throw error;
      }
      throw new ToolAdapterError(error.message || 'InProcess adapter execution failed', this.type, error);
    }
  }
}
