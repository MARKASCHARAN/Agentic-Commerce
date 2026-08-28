import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  ToolRegistry,
  ToolGateway,
  Tool,
  ToolId,
  ToolNotFoundError,
  ToolValidationError,
  ToolExecutionContext,
  ToolExecutionError,
  InProcessToolAdapter
} from '../../src/agent/tools';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { PolicyAuthorizationError, PolicyApprovalRequiredError } from '../../src/agent/policy/errors';

describe('ToolGateway', () => {
  let registry: ToolRegistry;
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };
  let policyEngine: { evaluate: ReturnType<typeof vi.fn> };
  let gateway: ToolGateway;

  const createTestTool = (
    id: string,
    executeFn: (input: any, context: ToolExecutionContext) => Promise<any>,
    inputSchema: z.ZodType<any> = z.object({ value: z.string() }),
    outputSchema: z.ZodType<any> = z.object({ result: z.string() })
  ): Tool<any, any> => ({
    metadata: {
      id: id as ToolId,
      name: 'Test Tool',
      description: 'A test tool',
      version: '1.0.0'
    },
    inputSchema,
    outputSchema,
    adapter: new InProcessToolAdapter(executeFn),
    policy: { id: 'system.allow_all' }
  });

  beforeEach(() => {
    registry = new ToolRegistry();
    eventEmitter = { emit: vi.fn() };
    policyEngine = { evaluate: vi.fn().mockResolvedValue({ result: 'ALLOW' }) };
    gateway = new ToolGateway({
      toolRegistry: registry,
      eventEmitter,
      policyEngine: policyEngine as unknown as PolicyEngine
    });
  });

  const baseContext = {
    executionId: 'exec-1',
    agentId: 'agent-1',
    sessionId: 'session-1'
  };

  it('should successfully execute a tool, validate I/O, and emit lifecycle events', async () => {
    const executeSpy = vi.fn().mockResolvedValue({ result: 'echoed value' });
    const tool = createTestTool('test.success', executeSpy);
    registry.register(tool);

    const result = await gateway.execute({
      toolId: 'test.success',
      input: { value: 'value' },
      context: baseContext
    });

    expect(result.toolId).toBe('test.success');
    expect(result.output).toEqual({ result: 'echoed value' });

    expect(executeSpy).toHaveBeenCalledWith(
      { value: 'value' },
      expect.objectContaining({
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        abortSignal: expect.any(AbortSignal)
      })
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_STARTED', expect.objectContaining({ tool: 'test.success' }));
    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_COMPLETED', expect.objectContaining({ tool: 'test.success', result: { result: 'echoed value' } }));
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('TOOL_FAILED', expect.anything());
  });

  it('should throw ToolNotFoundError if tool is missing and NOT emit lifecycle events (except maybe if failed emits are wanted, but here registry throws early)', async () => {
    
    await expect(gateway.execute({
      toolId: 'missing.tool',
      input: {},
      context: baseContext
    })).rejects.toThrowError(ToolNotFoundError);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should reject invalid input and emit TOOL_FAILED without executing the tool', async () => {
    const executeSpy = vi.fn().mockResolvedValue({ result: 'ignored' });
    const tool = createTestTool('test.invalid-input', executeSpy);
    registry.register(tool);

    await expect(gateway.execute({
      toolId: 'test.invalid-input',
      input: { wrongKey: 123 },
      context: baseContext
    })).rejects.toThrowError(ToolValidationError);

    expect(executeSpy).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_FAILED', expect.objectContaining({ tool: 'test.invalid-input' }));
  });

  it('should reject invalid output from tool and emit TOOL_FAILED', async () => {
    const executeSpy = vi.fn().mockResolvedValue({ badOutputKey: 'wrong' });
    const tool = createTestTool('test.invalid-output', executeSpy);
    registry.register(tool);

    await expect(gateway.execute({
      toolId: 'test.invalid-output',
      input: { value: 'test' },
      context: baseContext
    })).rejects.toThrowError(ToolValidationError);

    expect(executeSpy).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_FAILED', expect.objectContaining({ tool: 'test.invalid-output' }));
  });

  it('should propagate cancellation if context abortSignal is already aborted', async () => {
    const executeSpy = vi.fn().mockResolvedValue({ result: 'ignored' });
    const tool = createTestTool('test.aborted-early', executeSpy);
    registry.register(tool);

    const controller = new AbortController();
    controller.abort(new Error('Already aborted'));

    await expect(gateway.execute({
      toolId: 'test.aborted-early',
      input: { value: 'test' },
      context: { ...baseContext, abortSignal: controller.signal }
    })).rejects.toThrowError('Already aborted');

    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should propagate cancellation during execution', async () => {
    let internalSignal: AbortSignal;
    const executeSpy = vi.fn().mockImplementation(async (input, context) => {
      internalSignal = context.abortSignal;
      
      await new Promise(resolve => setTimeout(resolve, 50));
      if (internalSignal.aborted) throw internalSignal.reason;
      return { result: 'done' };
    });

    const tool = createTestTool('test.aborted-mid', executeSpy);
    registry.register(tool);

    const controller = new AbortController();

    const promise = gateway.execute({
      toolId: 'test.aborted-mid',
      input: { value: 'test' },
      context: { ...baseContext, abortSignal: controller.signal }
    });

    setTimeout(() => controller.abort(new Error('Aborted mid-flight')), 10);

    await expect(promise).rejects.toThrowError('Aborted mid-flight');
    expect(executeSpy).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_FAILED', expect.anything());
  });

  it('should timeout if execution takes longer than timeoutMs', async () => {
    const executeSpy = vi.fn().mockImplementation(async (input, context) => {
      
      return new Promise((resolve, reject) => {
        context.abortSignal.addEventListener('abort', () => reject(context.abortSignal.reason));
        setTimeout(() => resolve({ result: 'done' }), 200);
      });
    });

    const tool = createTestTool('test.timeout', executeSpy);
    registry.register(tool);

    await expect(gateway.execute({
      toolId: 'test.timeout',
      input: { value: 'test' },
      context: baseContext,
      timeoutMs: 50 
    })).rejects.toThrowError(/timed out/);

    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_FAILED', expect.anything());
  });

  it('should wrap general execution errors in ToolExecutionError', async () => {
    const executeSpy = vi.fn().mockRejectedValue(new Error('Some internal db issue'));
    const tool = createTestTool('test.internal-error', executeSpy);
    registry.register(tool);

    try {
      await gateway.execute({
        toolId: 'test.internal-error',
        input: { value: 'test' },
        context: baseContext
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error).toBeInstanceOf(ToolExecutionError);
      expect(error.message).toContain('Tool execution failed: [in-process adapter] Some internal db issue');
      expect(error.cause).toBeDefined(); 
    }

    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_FAILED', expect.anything());
  });

  it('should isolate tool execution completely', async () => {
    
    const executeA = vi.fn().mockResolvedValue({ result: 'A' });
    const executeB = vi.fn().mockResolvedValue({ result: 'B' });

    registry.register(createTestTool('test.a', executeA));
    registry.register(createTestTool('test.b', executeB));

    const resA = await gateway.execute({ toolId: 'test.a', input: { value: 'x' }, context: baseContext });
    const resB = await gateway.execute({ toolId: 'test.b', input: { value: 'y' }, context: baseContext });

    expect(resA.output.result).toBe('A');
    expect(resB.output.result).toBe('B');
  });

  it('should fail-closed if a tool does not declare a policy', async () => {
    const executeSpy = vi.fn().mockResolvedValue({ result: 'ignored' });
    const tool = createTestTool('test.no-policy', executeSpy);
    delete tool.policy; 
    registry.register(tool);

    await expect(gateway.execute({
      toolId: 'test.no-policy',
      input: { value: 'test' },
      context: baseContext
    })).rejects.toThrowError(PolicyAuthorizationError);

    expect(executeSpy).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith('TOOL_FAILED', expect.anything());
  });

  it('should reject execution if policy evaluates to DENY', async () => {
    policyEngine.evaluate.mockResolvedValueOnce({ result: 'DENY', reason: 'Blocked by rule' });
    
    const executeSpy = vi.fn().mockResolvedValue({ result: 'ignored' });
    const tool = createTestTool('test.deny', executeSpy);
    registry.register(tool);

    await expect(gateway.execute({
      toolId: 'test.deny',
      input: { value: 'test' },
      context: baseContext
    })).rejects.toThrowError(PolicyAuthorizationError);

    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('should reject execution if policy evaluates to REQUIRE_APPROVAL', async () => {
    policyEngine.evaluate.mockResolvedValueOnce({ result: 'REQUIRE_APPROVAL', requiredApprovals: ['manager'] });
    
    const executeSpy = vi.fn().mockResolvedValue({ result: 'ignored' });
    const tool = createTestTool('test.approval', executeSpy);
    registry.register(tool);

    await expect(gateway.execute({
      toolId: 'test.approval',
      input: { value: 'test' },
      context: baseContext
    })).rejects.toThrowError(PolicyApprovalRequiredError);

    expect(executeSpy).not.toHaveBeenCalled();
  });
});
