import { ToolExecutionContext } from '../types';

/**
 * Context provided to an adapter during tool execution.
 */
export interface ToolAdapterContext extends ToolExecutionContext {
  // Adapter context reuses the execution context exactly for now,
  // but establishes a dedicated interface for future adapter-specific needs.
}

/**
 * Explicit identifier for adapter implementation strategies.
 */
export type ToolAdapterType = 
  | "in-process"
  | "mcp"
  | "rest"
  | "graphql";

/**
 * The boundary contract representing HOW a deterministic capability is reached.
 * 
 * An adapter is completely neutral to the specific Tool semantics; it only concerns
 * itself with safely and correctly executing the payload over its specific transport.
 */
export interface ToolAdapter<Input = unknown, Output = unknown> {
  /**
   * The declarative type of the adapter.
   */
  readonly type: ToolAdapterType;

  /**
   * Executes the tool capability over the adapter's implementation mechanism.
   * 
   * @param {Input} input - The strictly validated input payload.
   * @param {ToolAdapterContext} context - The execution context (identity, abort signal).
   * @returns {Promise<Output>} A promise resolving to the raw output, which will be validated by the gateway.
   */
  execute(input: Input, context: ToolAdapterContext): Promise<Output>;
}
