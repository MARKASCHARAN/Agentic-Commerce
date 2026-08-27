import { Tool, ToolId, ToolMetadata } from './types';
import { 
  ToolAlreadyRegisteredError, 
  ToolNotFoundError, 
  ToolValidationError 
} from './errors';

/**
 * A deterministic registry that manages discovery and lookup for all Tools.
 * The registry acts as the source of truth for available operations.
 */
export class ToolRegistry {
  private readonly tools = new Map<ToolId, Tool<unknown, unknown>>();

  /**
   * Registers a tool in the registry.
   * Rejects invalid tools and duplicate IDs.
   * 
   * @param tool - The tool to register.
   * @throws {ToolValidationError} If the tool definition is invalid.
   * @throws {ToolAlreadyRegisteredError} If the tool ID is already registered.
   */
  register(tool: Tool<unknown, unknown>): void {
    this.validateTool(tool);

    if (this.tools.has(tool.metadata.id)) {
      throw new ToolAlreadyRegisteredError(tool.metadata.id);
    }

    this.tools.set(tool.metadata.id, tool);
  }

  /**
   * Unregisters a tool by ID.
   * 
   * @param toolId - The ID of the tool to remove.
   */
  unregister(toolId: string): void {
    this.tools.delete(toolId as ToolId);
  }

  /**
   * Retrieves a tool by ID.
   * 
   * @param toolId - The ID of the tool to fetch.
   * @returns The requested tool.
   * @throws {ToolNotFoundError} If the tool does not exist.
   */
  get(toolId: string): Tool<unknown, unknown> {
    const tool = this.tools.get(toolId as ToolId);
    if (!tool) {
      throw new ToolNotFoundError(toolId);
    }
    return tool;
  }

  /**
   * Checks if a tool exists in the registry.
   * 
   * @param toolId - The ID of the tool to check.
   * @returns True if the tool exists, false otherwise.
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId as ToolId);
  }

  /**
   * Returns a read-only list of all registered tool metadata.
   * This encapsulates the internal Map to prevent external mutation.
   * 
   * @returns An array of tool metadata.
   */
  list(): ToolMetadata[] {
    return Array.from(this.tools.values()).map(tool => ({ ...tool.metadata }));
  }

  private validateTool(tool: Tool<unknown, unknown>): void {
    if (!tool) {
      throw new ToolValidationError('Tool is undefined or null.');
    }
    if (!tool.metadata) {
      throw new ToolValidationError('Tool is missing metadata.');
    }
    if (!tool.metadata.id) {
      throw new ToolValidationError('Tool metadata is missing id.');
    }
    if (!tool.metadata.name) {
      throw new ToolValidationError('Tool metadata is missing name.');
    }
    if (!tool.metadata.description) {
      throw new ToolValidationError('Tool metadata is missing description.');
    }
    if (!tool.metadata.version) {
      throw new ToolValidationError('Tool metadata is missing version.');
    }
    if (!tool.inputSchema) {
      throw new ToolValidationError('Tool is missing inputSchema.');
    }
    if (!tool.outputSchema) {
      throw new ToolValidationError('Tool is missing outputSchema.');
    }
    if (!tool.adapter || typeof tool.adapter.execute !== 'function') {
      throw new ToolValidationError('Tool is missing a valid adapter.');
    }
  }
}
