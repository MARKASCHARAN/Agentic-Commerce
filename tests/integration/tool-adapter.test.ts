import { describe, it, expect, vi } from 'vitest';
import { InProcessToolAdapter, ToolAdapterError, ToolAdapterContext } from '../../src/agent/tools/adapters';

describe('InProcessToolAdapter', () => {
  const baseContext: ToolAdapterContext = {
    executionId: 'exec-1',
    agentId: 'agent-1',
    sessionId: 'session-1'
  };

  it('should execute successfully and return output', async () => {
    const adapter = new InProcessToolAdapter(async (input: { msg: string }, context) => {
      return { msg: input.msg + ' executed' };
    });

    const result = await adapter.execute({ msg: 'test' }, baseContext);
    expect(result).toEqual({ msg: 'test executed' });
  });

  it('should propagate context correctly', async () => {
    let capturedContext: ToolAdapterContext | undefined;
    
    const adapter = new InProcessToolAdapter(async (input, context) => {
      capturedContext = context;
      return {};
    });

    await adapter.execute({}, baseContext);
    
    expect(capturedContext).toEqual(baseContext);
  });

  it('should abort before execution starts if signal is already aborted', async () => {
    const executeSpy = vi.fn();
    const adapter = new InProcessToolAdapter(executeSpy);

    const controller = new AbortController();
    controller.abort(new Error('Aborted early'));

    await expect(adapter.execute({}, { ...baseContext, abortSignal: controller.signal }))
      .rejects.toThrowError('Aborted early');

    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should wrap arbitrary errors into ToolAdapterError but preserve cancellation', async () => {
    const adapter = new InProcessToolAdapter(async () => {
      throw new Error('Internal failure');
    });

    try {
      await adapter.execute({}, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ToolAdapterError);
      expect(e.message).toContain('[in-process adapter] Internal failure');
      expect(e.adapterType).toBe('in-process');
      expect(e.cause).toBeInstanceOf(Error);
    }
  });

  it('should preserve abort reason if aborted during execution', async () => {
    const controller = new AbortController();
    
    const adapter = new InProcessToolAdapter(async (input, context) => {
      
      throw context.abortSignal!.reason;
    });

    controller.abort(new Error('Aborted mid-flight'));

    await expect(adapter.execute({}, { ...baseContext, abortSignal: controller.signal }))
      .rejects.toThrowError('Aborted mid-flight');
  });

  it('should provide adapter isolation (no shared mutable state)', async () => {
    let callCount = 0;
    
    const adapter1 = new InProcessToolAdapter(async () => {
      callCount++;
      return { id: 1 };
    });

    const adapter2 = new InProcessToolAdapter(async () => {
      callCount++;
      return { id: 2 };
    });

    const res1 = await adapter1.execute({}, baseContext);
    const res2 = await adapter2.execute({}, baseContext);

    expect(res1.id).toBe(1);
    expect(res2.id).toBe(2);
    expect(callCount).toBe(2);
  });
});
