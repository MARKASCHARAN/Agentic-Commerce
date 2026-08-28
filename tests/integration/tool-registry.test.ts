import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { 
  ToolRegistry, 
  Tool, 
  ToolId, 
  ToolAlreadyRegisteredError, 
  ToolNotFoundError,
  ToolValidationError,
  ToolExecutionContext,
  InProcessToolAdapter
} from '../../src/agent/tools';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  const createEchoTool = (id: string, name: string): Tool<{ message: string }, { message: string }> => ({
    metadata: {
      id: id as ToolId,
      name,
      description: 'A deterministic test tool that echoes the input',
      version: '1.0.0'
    },
    inputSchema: z.object({ message: z.string() }),
    outputSchema: z.object({ message: z.string() }),
    adapter: new InProcessToolAdapter(async (input: { message: string }, context: ToolExecutionContext) => {
      return { message: input.message };
    })
  });

  it('should successfully register a valid tool and allow lookup', () => {
    const tool = createEchoTool('test.echo-tool', 'Echo Tool');
    
    registry.register(tool);
    
    expect(registry.has('test.echo-tool')).toBe(true);
    expect(registry.get('test.echo-tool')).toBe(tool);
  });

  it('should list all registered tools and protect internal registry state (isolation)', () => {
    const toolA = createEchoTool('test.a', 'Tool A');
    const toolB = createEchoTool('test.b', 'Tool B');
    
    registry.register(toolA);
    registry.register(toolB);
    
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.find(m => m.id === 'test.a')).toBeDefined();
    expect(list.find(m => m.id === 'test.b')).toBeDefined();

    list.pop();
    expect(registry.list()).toHaveLength(2);
  });

  it('should reject duplicate tool registration with ToolAlreadyRegisteredError', () => {
    const tool = createEchoTool('test.duplicate', 'Duplicate Tool');
    
    registry.register(tool);
    
    expect(() => {
      registry.register(tool);
    }).toThrowError(ToolAlreadyRegisteredError);
    
    try {
      registry.register(tool);
    } catch (e: any) {
      expect(e.toolId).toBe('test.duplicate');
      expect(e.name).toBe('ToolAlreadyRegisteredError');
    }
  });

  it('should throw ToolNotFoundError when getting a missing tool', () => {
    expect(() => {
      registry.get('does.not.exist');
    }).toThrowError(ToolNotFoundError);
    
    try {
      registry.get('does.not.exist');
    } catch (e: any) {
      expect(e.toolId).toBe('does.not.exist');
      expect(e.name).toBe('ToolNotFoundError');
    }
  });

  it('should successfully unregister a tool', () => {
    const tool = createEchoTool('test.unregister', 'Unregister Tool');
    
    registry.register(tool);
    expect(registry.has('test.unregister')).toBe(true);
    
    registry.unregister('test.unregister');
    expect(registry.has('test.unregister')).toBe(false);
  });

  it('should validate tool definition on registration (missing fields)', () => {
    
    expect(() => {
      registry.register({ execute: async () => {} } as any);
    }).toThrowError(ToolValidationError);

    expect(() => {
      registry.register({
        metadata: { id: 'bad', name: 'Bad', description: 'desc', version: '1.0' },
        outputSchema: z.object({}),
        adapter: new InProcessToolAdapter(async () => {})
      } as any);
    }).toThrowError(/missing inputSchema/);

    expect(() => {
      registry.register({
        metadata: { id: 'bad', name: 'Bad', description: 'desc', version: '1.0' },
        inputSchema: z.object({}),
        adapter: new InProcessToolAdapter(async () => {})
      } as any);
    }).toThrowError(/missing outputSchema/);

    expect(() => {
      registry.register({
        metadata: { id: 'bad', name: 'Bad', description: 'desc', version: '1.0' },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      } as any);
    }).toThrowError(/missing a valid adapter/);
  });
  
  it('should support multiple independent tools coexisting', () => {
    const tool1 = createEchoTool('tool.1', 'Tool 1');
    const tool2 = createEchoTool('tool.2', 'Tool 2');
    
    registry.register(tool1);
    registry.register(tool2);
    
    expect(registry.has('tool.1')).toBe(true);
    expect(registry.has('tool.2')).toBe(true);
    expect(registry.get('tool.1')).toBe(tool1);
    expect(registry.get('tool.2')).toBe(tool2);
  });
});
