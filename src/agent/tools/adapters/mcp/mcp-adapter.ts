import { ToolAdapter, ToolAdapterContext, ToolAdapterType } from '../types';
import { 
  MCPToolAdapterError, 
  MCPInvocationError, 
  MCPConnectionError,
  MCPProtocolError 
} from './errors';
import { MCPToolAdapterOptions } from './types';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Executes tools over the Model Context Protocol (MCP).
 * 
 * Maps a generic Tool to a specific MCP server tool using the official MCP SDK.
 */
export class MCPToolAdapter<Input = unknown, Output = unknown> implements ToolAdapter<Input, Output> {
  public readonly type: ToolAdapterType = 'mcp';

  constructor(
    private readonly options: MCPToolAdapterOptions & {
      responseTransformer?: (result: CallToolResult) => Output;
    }
  ) {}

  /**
   * Executes the MCP tool implementation via the configured SDK client.
   * 
   * @throws {MCPToolAdapterError} If execution aborts prematurely or an unknown error occurs.
   * @throws {MCPConnectionError} If the client fails to communicate with the MCP server.
   * @throws {MCPInvocationError} If the tool invocation explicitly fails.
   */
  async execute(input: Input, context: ToolAdapterContext): Promise<Output> {
    if (context.abortSignal?.aborted) {
      throw context.abortSignal.reason || new MCPToolAdapterError('Execution aborted before start');
    }

    try {
      const result = await this.options.client.callTool(
        {
          name: this.options.toolName,
          arguments: input as Record<string, unknown>
        },
        undefined,
        { signal: context.abortSignal }
      );

      return this.transformResponse(result as any);

    } catch (error: any) {
      if (context.abortSignal?.aborted && error === context.abortSignal.reason) {
        throw error;
      }
      
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        throw context.abortSignal?.reason || error;
      }

      if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
        throw new MCPConnectionError(`Failed to communicate with MCP server for tool ${this.options.toolName}`, error);
      }

      if (error instanceof MCPToolAdapterError) {
        throw error;
      }

      throw new MCPInvocationError(this.options.toolName, error.message || 'Unknown MCP error', error);
    }
  }

  /**
   * Transforms the raw MCP CallToolResult into the configured output type.
   * Uses responseTransformer if provided; otherwise extracts text content natively.
   */
  private transformResponse(result: any): Output {
    if (this.options.responseTransformer) {
      return this.options.responseTransformer(result);
    }

    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (!textContent || !('text' in textContent)) {
        throw new MCPProtocolError('MCP tool returned no text content to parse');
      }

      try {
        return JSON.parse(textContent.text as string) as Output;
      } catch (parseError: any) {
        throw new MCPProtocolError(`Failed to parse MCP tool output as JSON: ${parseError.message}`, parseError);
      }
    }
    
    if (result.toolResult) {
      return result.toolResult as Output;
    }

    throw new MCPProtocolError('MCP tool returned unsupported or empty content structure');
  }
}
