import { ToolError } from '../errors';
import { ToolAdapterType } from './types';

export class ToolAdapterError extends ToolError {
  constructor(
    message: string, 
    public readonly adapterType: ToolAdapterType,
    public readonly cause?: unknown
  ) {
    super(`[${adapterType} adapter] ${message}`);
    this.name = 'ToolAdapterError';
  }
}
