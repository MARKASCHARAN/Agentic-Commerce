import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime';
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
      toolExecutor: {
        executeTool: vi.fn().mockResolvedValue({ success: true }),
      } as ToolExecutor,
      skillSelector: {
        selectSkill: vi.fn().mockResolvedValue(null),
      } as SkillSelector,
      eventEmitter: {
        emit: vi.fn(),
      } as AgentEventEmitter,
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

    expect(mockDeps.toolExecutor.executeTool).toHaveBeenCalledWith('payment_tool', { amount: 100 });
    expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('TOOL_STARTED', expect.objectContaining({ tool: 'payment_tool' }));
    expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('TOOL_COMPLETED', expect.objectContaining({ tool: 'payment_tool', result: { success: true } }));
    
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
    
    mockDeps.toolExecutor.executeTool = vi.fn().mockRejectedValue(new Error('Tool Gateway not implemented'));

    await expect(runtime.execute(mockIdentity, 'Do something'))
      .rejects.toThrow("Unsupported/Failed action: Tool 'future_tool' could not be executed. Reason: Tool Gateway not implemented");

    expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('TOOL_FAILED', expect.objectContaining({ tool: 'future_tool' }));
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
});
