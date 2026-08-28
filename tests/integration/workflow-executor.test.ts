import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { 
  createWorkflowDefinition,
  WorkflowId,
  WorkflowExecutor,
  InvalidTransitionError
} from '../../src/agent/workflows';
import { ToolGateway, ToolRegistry, Tool, ToolId, InProcessToolAdapter } from '../../src/agent/tools';
import { PolicyAuthorizationError, PolicyApprovalRequiredError } from '../../src/agent/policy/errors';
import { randomUUID } from 'crypto';

class MockWorkflowRepository {
  public store = new Map<string, any>();
  
  async create(data: any) {
    const instance = { ...data, version: 1 };
    this.store.set(data.id, instance);
    return instance;
  }
  
  async load(id: string) {
    const data = this.store.get(id);
    return data ? { ...data } : null;
  }
  
  async saveTransition(id: string, expectedVersion: number, newState: string) {
    const instance = this.store.get(id);
    if (!instance || instance.version !== expectedVersion) {
      throw new Error(`Optimistic concurrency conflict or instance not found: Workflow ${id} at version ${expectedVersion}`);
    }
    
    const updated = {
      ...instance,
      version: instance.version + 1,
      currentState: newState
    };
    this.store.set(id, updated);
    return { ...updated };
  }
}

describe('Workflow Executor Boundary', () => {
  let registry: ToolRegistry;
  let policyEngine: { evaluate: ReturnType<typeof vi.fn> };
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };
  let gateway: ToolGateway;
  let repository: MockWorkflowRepository;
  let executor: WorkflowExecutor;
  let toolExecutionSpy: ReturnType<typeof vi.fn>;

  const wfDef = createWorkflowDefinition({
    id: 'wf-executor-test' as WorkflowId,
    name: 'Test Workflow',
    version: '1.0.0',
    inputSchema: z.object({}),
    initialState: 'CREATED',
    states: ['CREATED', 'ACTIVE', 'COMPLETED'],
    events: ['START', 'FINISH'],
    transitions: [
      { from: 'CREATED', event: 'START', to: 'ACTIVE', requiredTool: 'test-tool' },
      { from: 'ACTIVE', event: 'FINISH', to: 'COMPLETED' } 
    ]
  });

  const getDefinition = () => wfDef;

  beforeEach(() => {
    registry = new ToolRegistry();
    policyEngine = { evaluate: vi.fn().mockResolvedValue({ result: 'ALLOW' }) };
    eventEmitter = { emit: vi.fn() };
    
    gateway = new ToolGateway({
      toolRegistry: registry,
      eventEmitter,
      policyEngine: policyEngine as any
    });

    repository = new MockWorkflowRepository();
    
    executor = new WorkflowExecutor({
      repository: repository as any,
      toolGateway: gateway,
      getDefinition
    });

    toolExecutionSpy = vi.fn().mockResolvedValue({ status: 'ok' });

    const testTool: Tool<any, any> = {
      metadata: {
        id: 'test-tool' as ToolId,
        name: 'Test Tool',
        description: 'Tool for testing workflow execution',
        version: '1.0.0'
      },
      inputSchema: z.object({ arg: z.string() }),
      outputSchema: z.object({ status: z.string() }),
      adapter: new InProcessToolAdapter(toolExecutionSpy),
      policy: { id: 'test-policy' }
    };

    registry.register(testTool);
  });

  const identity = { executionId: 'exec-1', agentId: 'agent-1', sessionId: 'sess-1' };

  it('should validate transition, execute tool, and persist success', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    const result = await executor.executeTransition(id, 'START', { arg: 'hello' }, identity);

    expect(result.newState).toBe('ACTIVE');
    expect(result.previousState).toBe('CREATED');
    expect(toolExecutionSpy).toHaveBeenCalledWith({ arg: 'hello' }, expect.any(Object));

    const persisted = await repository.load(id);
    expect(persisted.currentState).toBe('ACTIVE');
    expect(persisted.version).toBe(2);
  });

  it('should reject invalid transitions and NOT execute tool or persist', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    await expect(executor.executeTransition(id, 'FINISH', {}, identity))
      .rejects.toThrowError(InvalidTransitionError);

    expect(toolExecutionSpy).not.toHaveBeenCalled();

    const persisted = await repository.load(id);
    expect(persisted.currentState).toBe('CREATED');
    expect(persisted.version).toBe(1);
  });

  it('should NOT persist new state if PolicyEngine denies tool execution', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    policyEngine.evaluate.mockResolvedValue({ result: 'DENY', reason: 'Blocked' });

    await expect(executor.executeTransition(id, 'START', { arg: 'hello' }, identity))
      .rejects.toThrowError(PolicyAuthorizationError);

    expect(toolExecutionSpy).not.toHaveBeenCalled();

    const persisted = await repository.load(id);
    expect(persisted.currentState).toBe('CREATED');
    expect(persisted.version).toBe(1);
  });

  it('should NOT persist new state if PolicyEngine requires approval', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    policyEngine.evaluate.mockResolvedValue({ result: 'REQUIRE_APPROVAL', requiredApprovals: ['admin'] });

    await expect(executor.executeTransition(id, 'START', { arg: 'hello' }, identity))
      .rejects.toThrowError(PolicyApprovalRequiredError);

    expect(toolExecutionSpy).not.toHaveBeenCalled();

    const persisted = await repository.load(id);
    expect(persisted.currentState).toBe('CREATED');
  });

  it('should surface tool failure and NOT persist new state', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    toolExecutionSpy.mockRejectedValue(new Error('API Down'));

    await expect(executor.executeTransition(id, 'START', { arg: 'hello' }, identity))
      .rejects.toThrowError(/API Down/);

    const persisted = await repository.load(id);
    expect(persisted.currentState).toBe('CREATED');
    expect(persisted.version).toBe(1);
  });

  it('should surface persistence failure explicitly (exactly-once limitation)', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    repository.saveTransition = vi.fn().mockRejectedValue(new Error('DB Offline'));

    await expect(executor.executeTransition(id, 'START', { arg: 'hello' }, identity))
      .rejects.toThrowError('DB Offline');

    expect(toolExecutionSpy).toHaveBeenCalled();
  });

  it('should enforce optimistic concurrency natively', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    const originalLoad = repository.load.bind(repository);
    repository.load = async (loadId: string) => {
      const data = await originalLoad(loadId);
      
      await repository.saveTransition(loadId, data.version, 'COMPLETED');
      return data; 
    };

    await expect(executor.executeTransition(id, 'START', { arg: 'hello' }, identity))
      .rejects.toThrowError(/Optimistic concurrency conflict/);

    expect(toolExecutionSpy).toHaveBeenCalled();
  });

  it('should successfully execute transition requiring NO tool', async () => {
    const id = randomUUID();
    await repository.create({ id, workflowId: 'wf-executor-test', currentState: 'ACTIVE', status: 'ACTIVE' });

    const result = await executor.executeTransition(id, 'FINISH', {}, identity);

    expect(result.newState).toBe('COMPLETED');
    expect(toolExecutionSpy).not.toHaveBeenCalled();

    const persisted = await repository.load(id);
    expect(persisted.currentState).toBe('COMPLETED');
    expect(persisted.version).toBe(2);
  });

  it('should isolate instances cleanly', async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    
    await repository.create({ id: id1, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });
    await repository.create({ id: id2, workflowId: 'wf-executor-test', currentState: 'CREATED', status: 'ACTIVE' });

    await executor.executeTransition(id1, 'START', { arg: 'h' }, identity);

    const p1 = await repository.load(id1);
    const p2 = await repository.load(id2);

    expect(p1.currentState).toBe('ACTIVE');
    expect(p2.currentState).toBe('CREATED');
  });
});
