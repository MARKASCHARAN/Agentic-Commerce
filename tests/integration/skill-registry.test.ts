import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { 
  SkillRegistry, 
  Skill, 
  SkillId, 
  SkillAlreadyRegisteredError, 
  SkillNotFoundError,
  SkillValidationError,
  SkillExecutionContext
} from '../../src/agent/skills';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  // Example test skill implementation
  const createEchoSkill = (id: string, name: string): Skill<{ message: string }, { message: string }> => ({
    metadata: {
      id: id as SkillId,
      name,
      description: 'A test skill that echoes the input',
      version: '1.0.0'
    },
    inputSchema: z.object({ message: z.string() }),
    outputSchema: z.object({ message: z.string() }),
    execute: async (input: { message: string }, context: SkillExecutionContext) => {
      return { message: input.message };
    }
  });

  it('should register a valid skill and find it', () => {
    const skill = createEchoSkill('test.echo', 'Echo Skill');
    
    registry.register(skill);
    
    expect(registry.has('test.echo')).toBe(true);
    expect(registry.get('test.echo')).toBe(skill);
  });

  it('should list all registered skills without exposing internal state', () => {
    const skillA = createEchoSkill('test.a', 'Skill A');
    const skillB = createEchoSkill('test.b', 'Skill B');
    
    registry.register(skillA);
    registry.register(skillB);
    
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.find(m => m.id === 'test.a')).toBeDefined();
    expect(list.find(m => m.id === 'test.b')).toBeDefined();

    // Verify mutating the list does not affect the registry
    list.pop();
    expect(registry.list()).toHaveLength(2);
  });

  it('should reject duplicate skill registration', () => {
    const skill = createEchoSkill('test.duplicate', 'Duplicate Skill');
    
    registry.register(skill);
    
    expect(() => {
      registry.register(skill);
    }).toThrowError(SkillAlreadyRegisteredError);
    
    // Check specific error properties
    try {
      registry.register(skill);
    } catch (e: any) {
      expect(e.skillId).toBe('test.duplicate');
      expect(e.name).toBe('SkillAlreadyRegisteredError');
    }
  });

  it('should throw SkillNotFoundError when getting a missing skill', () => {
    expect(() => {
      registry.get('does.not.exist');
    }).toThrowError(SkillNotFoundError);
    
    // Check specific error properties
    try {
      registry.get('does.not.exist');
    } catch (e: any) {
      expect(e.skillId).toBe('does.not.exist');
      expect(e.name).toBe('SkillNotFoundError');
    }
  });

  it('should successfully unregister a skill', () => {
    const skill = createEchoSkill('test.unregister', 'Unregister Skill');
    
    registry.register(skill);
    expect(registry.has('test.unregister')).toBe(true);
    
    registry.unregister('test.unregister');
    expect(registry.has('test.unregister')).toBe(false);
  });

  it('should validate skill definition on registration', () => {
    // Missing whole metadata
    expect(() => {
      registry.register({ execute: async () => {} } as any);
    }).toThrowError(SkillValidationError);

    // Missing specific metadata fields
    expect(() => {
      registry.register({
        metadata: { id: 'bad', description: 'desc', version: '1.0' },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => {}
      } as any);
    }).toThrowError(SkillValidationError);

    // Missing schemas
    expect(() => {
      registry.register({
        metadata: { id: 'bad', name: 'Bad', description: 'desc', version: '1.0' },
        execute: async () => {}
      } as any);
    }).toThrowError(SkillValidationError);

    // Missing execute function
    expect(() => {
      registry.register({
        metadata: { id: 'bad', name: 'Bad', description: 'desc', version: '1.0' },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      } as any);
    }).toThrowError(SkillValidationError);
  });
});
