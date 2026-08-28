import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime';
import { z } from 'zod';
import { SkillRegistry } from '../../src/agent/skills/skill-registry';
import { Skill, SkillId, SkillExecutionContext } from '../../src/agent/skills/types';
import { 
  AgentRuntimeDependencies, 
  ExecutionIdentity, 
  StateManager,
  ToolExecutor,
  SkillSelector,
  AgentEventEmitter 
} from '../../src/agent/runtime/types';
import { ModelGateway } from '../../src/models/gateway/model-gateway';

describe('AgentRuntime Execution Loop', () => {
  let runtime: AgentRuntime;
  let mockDeps: AgentRuntimeDependencies;

  const mockIdentity: ExecutionIdentity = {
    sessionId: 'session-123',
    executionId: 'exec-123',
  };

  beforeEach(() => {
    mockDeps = {
      modelGateway: {
        structured: vi.fn().mockResolvedValue({ 
          object: { type: 'FINAL_RESPONSE', payload: { text: 'Model output' } },
          usage: { totalTokens: 50, promptTokens: 30, completionTokens: 20 }
        }),
      } as unknown as ModelGateway,
      stateManager: {
        createExecution: vi.fn().mockResolvedValue(undefined),
        loadContext: vi.fn().mockResolvedValue({ 
          identity: mockIdentity, 
          task: 'Do something',
          conversation: { messages: [] },
          runtimeMetadata: { version: '1.0' },
          scopedData: { tempValue: 42 } 
        }),
        saveState: vi.fn().mockResolvedValue(undefined),
      } as StateManager,
      toolGateway: {
        execute: vi.fn().mockResolvedValue({ output: { success: true } })
      } as any,
      skillSelector: {
        selectSkill: vi.fn().mockResolvedValue(null),
      } as SkillSelector,
      eventEmitter: {
        emit: vi.fn(),
      } as AgentEventEmitter,
      skillRegistry: new SkillRegistry(),
    };

    runtime = new AgentRuntime(mockDeps);
  });

  it('should successfully complete with a FINAL_RESPONSE action', async () => {
    const result = await runtime.execute(mockIdentity, 'Say hello');

    expect(mockDeps.modelGateway.structured).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      action: 'FINAL_RESPONSE',
      payload: 'Model output',
      usage: { totalTokens: 50 }
    }));
    
    expect(mockDeps.stateManager.saveState).toHaveBeenLastCalledWith('exec-123', 'COMPLETED');
    expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('EXECUTION_COMPLETED', expect.objectContaining({ result: expect.objectContaining({ action: 'FINAL_RESPONSE', payload: 'Model output' }) }));
  });

  it('should route TOOL_REQUEST correctly and emit tool events', async () => {
    mockDeps.modelGateway.structured = vi.fn().mockResolvedValue({
      object: { type: 'TOOL_REQUEST', payload: { toolName: 'payment_tool', input: { amount: 100 } } },
      usage: { totalTokens: 50 }
    });

    const result = await runtime.execute(mockIdentity, 'Process payment');

    expect(mockDeps.toolGateway.execute).toHaveBeenCalledWith(expect.objectContaining({ toolId: 'payment_tool', input: { amount: 100 } }));
    
    expect(result).toEqual(expect.objectContaining({ 
      action: 'TOOL_REQUEST', 
      payload: { toolName: 'payment_tool', result: { success: true } },
      usage: { totalTokens: 50 }
    }));
    expect(mockDeps.stateManager.saveState).toHaveBeenLastCalledWith('exec-123', 'COMPLETED');
  });

  it('should safely reject unsupported/unimplemented tools when ToolExecutor fails', async () => {
    mockDeps.modelGateway.structured = vi.fn().mockResolvedValue({
      object: { type: 'TOOL_REQUEST', payload: { toolName: 'future_tool', input: {} } },
      usage: { totalTokens: 50 }
    });
    
    (mockDeps.toolGateway as any).execute = vi.fn().mockRejectedValue(new Error('Tool Gateway not implemented'));

    await expect(runtime.execute(mockIdentity, 'Do something'))
      .rejects.toThrow("Unsupported/Failed action: Tool 'future_tool' could not be executed. Reason: Tool Gateway not implemented");

    expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('EXECUTION_FAILED', expect.anything());
    expect(mockDeps.stateManager.saveState).toHaveBeenLastCalledWith('exec-123', 'FAILED');
  });

  it('should yield CONTINUE reasoning steps back to the runtime', async () => {
    mockDeps.modelGateway.structured = vi.fn().mockResolvedValue({
      object: { type: 'CONTINUE', payload: { thought: 'Thinking...' } },
      usage: { totalTokens: 50 }
    });

    const result = await runtime.execute(mockIdentity, 'Think');

    expect(result).toEqual(expect.objectContaining({ 
      action: 'CONTINUE', 
      payload: { thought: 'Thinking...' },
      usage: { totalTokens: 50 }
    }));
    expect(mockDeps.stateManager.saveState).toHaveBeenLastCalledWith('exec-123', 'COMPLETED');
  });

  it('should fail immediately when maxTokens budget is exceeded', async () => {
    await expect(runtime.execute(mockIdentity, 'Do something', { budget: { maxTokens: 40 } }))
      .rejects.toThrow('Token budget exceeded');

    expect(mockDeps.stateManager.saveState).toHaveBeenLastCalledWith('exec-123', 'FAILED');
  });

  it('should transition to CANCELLED on timeout', async () => {
    mockDeps.modelGateway.structured = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => setTimeout(() => resolve({ 
        object: { type: 'FINAL_RESPONSE', payload: { text: 'Done' } },
        usage: { totalTokens: 10 }
      }), 100));
    });

    await expect(runtime.execute(mockIdentity, 'Do something', { timeoutMs: 50 }))
      .rejects.toThrow('Execution timed out');

    expect(mockDeps.stateManager.saveState).toHaveBeenLastCalledWith('exec-123', 'CANCELLED');
  });

  it('should transition to CANCELLED on explicit abort', async () => {
    const abortController = new AbortController();
    
    mockDeps.modelGateway.structured = vi.fn().mockImplementation(() => {
      abortController.abort(new Error('User clicked cancel'));
      return Promise.resolve({ object: { type: 'FINAL_RESPONSE', payload: { text: 'Done' } }, usage: { totalTokens: 10 } });
    });

    await expect(runtime.execute(mockIdentity, 'Do something', { abortSignal: abortController.signal }))
      .rejects.toThrow('User clicked cancel');

    expect(mockDeps.stateManager.saveState).toHaveBeenLastCalledWith('exec-123', 'CANCELLED');
  });

  describe('executeSkill', () => {
    const createEchoSkill = (): Skill<{ message: string }, { message: string }> => ({
      metadata: { id: 'test.echo' as SkillId, name: 'Echo', description: 'desc', version: '1.0' },
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.object({ message: z.string() }),
      execute: async (input) => ({ message: input.message }),
    });

    it('should successfully execute a registered skill with valid input and output', async () => {
      const skill = createEchoSkill();
      mockDeps.skillRegistry!.register(skill);

      const result = await runtime.executeSkill(mockIdentity, {
        skillId: 'test.echo',
        input: { message: 'hello' }
      });

      expect(result.skillId).toBe('test.echo');
      expect(result.output).toEqual({ message: 'hello' });
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('SKILL_STARTED', expect.objectContaining({ skillId: 'test.echo' }));
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('SKILL_COMPLETED', expect.objectContaining({ skillId: 'test.echo', result: { message: 'hello' } }));
    });

    it('should throw SkillNotFoundError if skill is missing', async () => {
      await expect(runtime.executeSkill(mockIdentity, { skillId: 'does.not.exist', input: {} }))
        .rejects.toThrow('Skill not found: does.not.exist');
    });

    it('should validate input and fail before executing if malformed', async () => {
      const skill = createEchoSkill();
      const executeSpy = vi.spyOn(skill, 'execute');
      mockDeps.skillRegistry!.register(skill);

      await expect(runtime.executeSkill(mockIdentity, {
        skillId: 'test.echo',
        input: { badInput: 123 }
      })).rejects.toThrow('Invalid input for skill test.echo:');

      expect(executeSpy).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('SKILL_FAILED', expect.objectContaining({ skillId: 'test.echo' }));
    });

    it('should validate output and fail safely if skill returns malformed output', async () => {
      const skill = createEchoSkill();
      
      skill.execute = async () => ({ wrong: true } as any);
      mockDeps.skillRegistry!.register(skill);

      await expect(runtime.executeSkill(mockIdentity, {
        skillId: 'test.echo',
        input: { message: 'hello' }
      })).rejects.toThrow('Invalid output from skill test.echo:');

      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('SKILL_FAILED', expect.objectContaining({ skillId: 'test.echo' }));
    });

    it('should pass correct context propagation', async () => {
      const skill = createEchoSkill();
      const executeSpy = vi.spyOn(skill, 'execute');
      mockDeps.skillRegistry!.register(skill);

      const abortController = new AbortController();

      await runtime.executeSkill(mockIdentity, {
        skillId: 'test.echo',
        input: { message: 'ctx' },
        options: { abortSignal: abortController.signal }
      });

      expect(executeSpy).toHaveBeenCalledWith(
        { message: 'ctx' },
        expect.objectContaining({
          sessionId: 'session-123',
          executionId: 'exec-123',
          abortSignal: abortController.signal
        })
      );
    });

    it('should abort and not execute if abort signal is triggered early', async () => {
      const abortController = new AbortController();
      abortController.abort();
      
      const skill = createEchoSkill();
      const executeSpy = vi.spyOn(skill, 'execute');
      mockDeps.skillRegistry!.register(skill);

      await expect(runtime.executeSkill(mockIdentity, {
        skillId: 'test.echo',
        input: { message: 'ctx' },
        options: { abortSignal: abortController.signal }
      })).rejects.toThrow();

      expect(executeSpy).not.toHaveBeenCalled();
    });

    it('should isolate skills successfully without cross-talk', async () => {
      const echoSkill = createEchoSkill();
      const uppercaseSkill: Skill<{ text: string }, { text: string }> = {
        metadata: { id: 'test.uppercase' as SkillId, name: 'Upper', description: 'desc', version: '1.0' },
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ text: z.string() }),
        execute: async (input) => ({ text: input.text.toUpperCase() }),
      };

      mockDeps.skillRegistry!.register(echoSkill);
      mockDeps.skillRegistry!.register(uppercaseSkill);

      const echoRes = await runtime.executeSkill(mockIdentity, { skillId: 'test.echo', input: { message: 'hi' }});
      const upperRes = await runtime.executeSkill<{text: string}, {text: string}>(mockIdentity, { skillId: 'test.uppercase', input: { text: 'hi' }});

      expect(echoRes.output.message).toBe('hi');
      expect(upperRes.output.text).toBe('HI');
    });
  });
});
