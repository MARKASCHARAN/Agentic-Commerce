import { Tool, ToolId, ToolMetadata } from './types';
import { 
  ToolAlreadyRegisteredError, 
  ToolNotFoundError, 
  ToolValidationError 
} from './errors';

export class ToolRegistry {
  private readonly tools = new Map<ToolId, Tool<unknown, unknown>>();

  register(tool: Tool<unknown, unknown>): void {
    this.validateTool(tool);

    if (this.tools.has(tool.metadata.id)) {
      throw new ToolAlreadyRegisteredError(tool.metadata.id);
    }

    this.tools.set(tool.metadata.id, tool);
  }

  unregister(toolId: string): void {
    this.tools.delete(toolId as ToolId);
  }

  get(toolId: string): Tool<unknown, unknown> {
    const tool = this.tools.get(toolId as ToolId);
    if (!tool) {
      throw new ToolNotFoundError(toolId);
    }
    return tool;
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId as ToolId);
  }

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
