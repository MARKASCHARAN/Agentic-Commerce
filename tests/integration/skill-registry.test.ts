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

  const createToolUsingSkill = (): Skill<any, any> => ({
    ...createEchoSkill('test.tool-using', 'Tool Using'),
    tools: [{ id: 'test.echo-tool' }]
  });

  const createPolicySkill = (): Skill<any, any> => ({
    ...createEchoSkill('test.policy', 'Policy Skill'),
    policy: { id: 'test.policy' }
  });

  const createWorkflowSkill = (): Skill<any, any> => ({
    ...createEchoSkill('test.workflow', 'Workflow Skill'),
    workflow: { id: 'test.workflow' }
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

    list.pop();
    expect(registry.list()).toHaveLength(2);
  });

  it('should reject duplicate skill registration', () => {
    const skill = createEchoSkill('test.duplicate', 'Duplicate Skill');

    registry.register(skill);

    expect(() => {
      registry.register(skill);
    }).toThrowError(SkillAlreadyRegisteredError);

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
    
    expect(() => {
      registry.register({ execute: async () => { } } as any);
    }).toThrowError(SkillValidationError);

    expect(() => {
      registry.register({
        metadata: { id: 'bad', description: 'desc', version: '1.0' },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => { }
      } as any);
    }).toThrowError(SkillValidationError);

    expect(() => {
      registry.register({
        metadata: { id: 'bad', name: 'Bad', description: 'desc', version: '1.0' },
        execute: async () => { }
      } as any);
    }).toThrowError(SkillValidationError);

    expect(() => {
      registry.register({
        metadata: { id: 'bad', name: 'Bad', description: 'desc', version: '1.0' },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      } as any);
    }).toThrowError(SkillValidationError);
  });

  describe('Capability Declarations', () => {
    it('should successfully register a skill with empty capabilities', () => {
      const skill = createEchoSkill('test.empty', 'Empty Capabilities');
      skill.tools = [];
      skill.policy = undefined;
      skill.workflow = undefined;
      
      registry.register(skill);
      expect(registry.has('test.empty')).toBe(true);
    });

    it('should successfully register a valid tool requirement', () => {
      const skill = createToolUsingSkill();
      registry.register(skill);
      
      const registered = registry.get('test.tool-using');
      expect(registered.tools).toBeDefined();
      expect(registered.tools![0].id).toBe('test.echo-tool');
    });

    it('should successfully register a valid policy requirement', () => {
      const skill = createPolicySkill();
      registry.register(skill);
      
      const registered = registry.get('test.policy');
      expect(registered.policy).toBeDefined();
      expect(registered.policy!.id).toBe('test.policy');
    });

    it('should successfully register a valid workflow requirement', () => {
      const skill = createWorkflowSkill();
      registry.register(skill);
      
      const registered = registry.get('test.workflow');
      expect(registered.workflow).toBeDefined();
      expect(registered.workflow!.id).toBe('test.workflow');
    });

    it('should reject invalid tool declaration (missing id)', () => {
      const skill = createEchoSkill('test.bad-tool', 'Bad Tool');
      skill.tools = [{}] as any;
      expect(() => registry.register(skill)).toThrowError('Skill tool at index 0 is missing id.');

      const skillNotArray = createEchoSkill('test.bad-tool2', 'Bad Tool');
      skillNotArray.tools = {} as any;
      expect(() => registry.register(skillNotArray)).toThrowError('Skill tools must be an array.');
    });

    it('should reject invalid policy declaration (missing id)', () => {
      const skill = createEchoSkill('test.bad-policy', 'Bad Policy');
      skill.policy = {} as any;
      expect(() => registry.register(skill)).toThrowError('Skill policy is missing id.');
    });

    it('should reject invalid workflow declaration (missing id)', () => {
      const skill = createEchoSkill('test.bad-workflow', 'Bad Workflow');
      skill.workflow = {} as any;
      expect(() => registry.register(skill)).toThrowError('Skill workflow is missing id.');
    });

    it('should support declaring multiple tools', () => {
      const skill = createEchoSkill('test.multi-tool', 'Multi Tool');
      skill.tools = [{ id: 'tool.one' }, { id: 'tool.two' }];
      
      registry.register(skill);
      const registered = registry.get('test.multi-tool');
      expect(registered.tools).toHaveLength(2);
      expect(registered.tools![0].id).toBe('tool.one');
      expect(registered.tools![1].id).toBe('tool.two');
    });

    it('should isolate capabilities (prevent mutation after registration)', () => {
      const skill = createEchoSkill('test.isolation', 'Isolation');
      skill.tools = [{ id: 'tool.one' }];
      
      registry.register(skill);

      const registered = registry.get('test.isolation');
      
      expect(() => {
        registered.tools!.push({ id: 'tool.two' });
      }).toThrow(); 
    });
  });
});
