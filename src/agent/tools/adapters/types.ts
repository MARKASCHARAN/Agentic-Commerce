import { ToolExecutionContext } from '../types';

export interface ToolAdapterContext extends ToolExecutionContext {

}

export type ToolAdapterType = 
  | "in-process"
  | "mcp"
  | "rest"
  | "graphql";

export interface ToolAdapter<Input = unknown, Output = unknown> {
  
  readonly type: ToolAdapterType;

  execute(input: Input, context: ToolAdapterContext): Promise<Output>;
}
