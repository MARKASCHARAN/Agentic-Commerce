import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentOrchestrator } from '../../src/agent/orchestrator/agent-orchestrator';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime';
import { ExecutionIdentity, TurnResult } from '../../src/agent/runtime/types';

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockRuntime: AgentRuntime;

  const mockIdentity: ExecutionIdentity = {
    sessionId: 'session-123',
    executionId: 'exec-123',
  };

  beforeEach(() => {
    mockRuntime = {
      execute: vi.fn(),
    } as unknown as AgentRuntime;

    orchestrator = new AgentOrchestrator(mockRuntime);
  });

  it('should complete successfully on a single-turn FINAL_RESPONSE', async () => {
    vi.mocked(mockRuntime.execute).mockResolvedValueOnce({
      action: 'FINAL_RESPONSE',
      payload: { text: 'Done' },
      usage: { totalTokens: 50 },
    });

    const result = await orchestrator.execute(mockIdentity, 'Do task');

    expect(mockRuntime.execute).toHaveBeenCalledTimes(1);
    expect(result.action).toBe('FINAL_RESPONSE');
  });

  it('should allow multiple controlled turns (CONTINUE -> TOOL_REQUEST -> FINAL_RESPONSE)', async () => {
    vi.mocked(mockRuntime.execute)
      .mockResolvedValueOnce({
        action: 'CONTINUE',
        payload: { thought: 'Step 1' },
        usage: { totalTokens: 10 },
      })
      .mockResolvedValueOnce({
        action: 'TOOL_REQUEST',
        payload: { toolName: 'fetch', input: {} },
        usage: { totalTokens: 20 },
      })
      .mockResolvedValueOnce({
        action: 'FINAL_RESPONSE',
        payload: { text: 'Done' },
        usage: { totalTokens: 30 },
      });

    const result = await orchestrator.execute(mockIdentity, 'Do task');

    expect(mockRuntime.execute).toHaveBeenCalledTimes(3);
    expect(result.action).toBe('FINAL_RESPONSE');
    expect(result.usage.totalTokens).toBe(30);
  });

  it('should prevent infinite loops by throwing when maxTurns is exceeded', async () => {
    vi.mocked(mockRuntime.execute).mockResolvedValue({
      action: 'CONTINUE',
      payload: { thought: 'Thinking forever' },
      usage: { totalTokens: 10 },
    });

    await expect(orchestrator.execute(mockIdentity, 'Do task', { maxTurns: 3 }))
      .rejects.toThrow('Execution exceeded maximum allowed turns (3) without a FINAL_RESPONSE.');

    expect(mockRuntime.execute).toHaveBeenCalledTimes(3);
  });

  it('should enforce accumulated global token budget', async () => {
    vi.mocked(mockRuntime.execute)
      .mockResolvedValueOnce({
        action: 'CONTINUE',
        payload: { thought: 'Thinking' },
        usage: { totalTokens: 40 },
      })
      .mockImplementationOnce(async (identity, task, options) => {
        expect(options?.budget?.maxTokens).toBe(10);
        throw new Error('Token budget exceeded: used 50 tokens, max 10');
      });

    await expect(orchestrator.execute(mockIdentity, 'Do task', { budget: { maxTokens: 50 } }))
      .rejects.toThrow('Token budget exceeded');

    expect(mockRuntime.execute).toHaveBeenCalledTimes(2);
  });

  it('should respect global timeouts and abort signals', async () => {
    const abortController = new AbortController();
    
    vi.mocked(mockRuntime.execute).mockImplementation(async () => {
      abortController.abort(new Error('User clicked cancel'));
      throw new Error('Explicitly cancelled');
    });

    await expect(orchestrator.execute(mockIdentity, 'Do task', { abortSignal: abortController.signal }))
      .rejects.toThrow('Explicitly cancelled');
      
    expect(mockRuntime.execute).toHaveBeenCalledTimes(1);
  });

  it('should propagate generic execution failures', async () => {
    vi.mocked(mockRuntime.execute).mockRejectedValue(new Error('Model Gateway crashed'));

    await expect(orchestrator.execute(mockIdentity, 'Do task'))
      .rejects.toThrow('Model Gateway crashed');
  });
});
