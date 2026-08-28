import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { z } from 'zod';
import { 
  createWorkflowDefinition,
  WorkflowStateMachine,
  InvalidTransitionError,
  WorkflowId
} from '../../src/agent/workflows';
import { PrismaWorkflowRepository } from '../../src/database/repositories/workflow.repository';
import { prisma } from '../../src/database/prisma/prisma';
import { randomUUID } from 'crypto';

describe('Workflow Persistence & Optimistic Concurrency', () => {
  const repository = new PrismaWorkflowRepository();
  const genericDefinition = createWorkflowDefinition({
    id: 'wf-persist' as WorkflowId,
    name: 'Generic Persisted Workflow',
    version: '1.0.0',
    inputSchema: z.object({}),
    initialState: 'START',
    states: ['START', 'PROCESSING', 'END'],
    events: ['PROCEED', 'FINISH'],
    transitions: [
      { from: 'START', event: 'PROCEED', to: 'PROCESSING' },
      { from: 'PROCESSING', event: 'FINISH', to: 'END' }
    ]
  });

  afterAll(async () => {
    
  });

  it('should create, persist, transition, and recover state from database', async () => {
    const instanceId = randomUUID();

    const initialInstanceData = await repository.create({
      id: instanceId,
      workflowId: genericDefinition.id,
      currentState: genericDefinition.initialState,
      status: 'ACTIVE'
    });

    expect(initialInstanceData.version).toBe(1);
    expect(initialInstanceData.currentState).toBe('START');

    const machine = new WorkflowStateMachine(
      genericDefinition,
      repository,
      initialInstanceData
    );

    await machine.transition('PROCEED');
    expect(machine.getCurrentState()).toBe('PROCESSING');

    const recoveredData = await repository.load(instanceId);
    expect(recoveredData).not.toBeNull();
    expect(recoveredData?.currentState).toBe('PROCESSING');
    expect(recoveredData?.version).toBe(2);

    const recoveredMachine = new WorkflowStateMachine(
      genericDefinition,
      repository,
      recoveredData!
    );
    expect(recoveredMachine.getCurrentState()).toBe('PROCESSING');

    await recoveredMachine.transition('FINISH');
    expect(recoveredMachine.getCurrentState()).toBe('END');
    
    const finalData = await repository.load(instanceId);
    expect(finalData?.currentState).toBe('END');
    expect(finalData?.version).toBe(3);
  });

  it('should enforce optimistic concurrency and block stale writers', async () => {
    const instanceId = randomUUID();
    
    await repository.create({
      id: instanceId,
      workflowId: genericDefinition.id,
      currentState: genericDefinition.initialState,
      status: 'ACTIVE'
    });

    const dataCopyA = await repository.load(instanceId);
    const dataCopyB = await repository.load(instanceId);

    const machineA = new WorkflowStateMachine(genericDefinition, repository, dataCopyA!);
    const machineB = new WorkflowStateMachine(genericDefinition, repository, dataCopyB!);

    await machineA.transition('PROCEED');
    expect(machineA.getCurrentState()).toBe('PROCESSING');

    await expect(machineB.transition('PROCEED')).rejects.toThrowError(/Optimistic concurrency conflict/);

    expect(machineB.getCurrentState()).toBe('START');
  });

  it('should preserve isolation between two independent workflow instances', async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();

    const [data1, data2] = await Promise.all([
      repository.create({ id: id1, workflowId: genericDefinition.id, currentState: 'START', status: 'ACTIVE' }),
      repository.create({ id: id2, workflowId: genericDefinition.id, currentState: 'START', status: 'ACTIVE' })
    ]);

    const machine1 = new WorkflowStateMachine(genericDefinition, repository, data1);
    const machine2 = new WorkflowStateMachine(genericDefinition, repository, data2);

    await machine1.transition('PROCEED');
    
    expect(machine1.getCurrentState()).toBe('PROCESSING');
    expect(machine2.getCurrentState()).toBe('START');

    const recovered2 = await repository.load(id2);
    expect(recovered2?.currentState).toBe('START');
    expect(recovered2?.version).toBe(1);
  });

  it('should reject invalid transition and NOT write to database', async () => {
    const instanceId = randomUUID();
    const data = await repository.create({
      id: instanceId,
      workflowId: genericDefinition.id,
      currentState: 'START',
      status: 'ACTIVE'
    });

    const machine = new WorkflowStateMachine(genericDefinition, repository, data);

    await expect(machine.transition('FINISH')).rejects.toThrowError(InvalidTransitionError);

    const recovered = await repository.load(instanceId);
    expect(recovered?.version).toBe(1);
    expect(recovered?.currentState).toBe('START');
  });

  it('should fail deterministically if repository throws and not mutate memory', async () => {
    const mockRepo = {
      create: vi.fn(),
      load: vi.fn(),
      saveTransition: vi.fn().mockRejectedValue(new Error('Database connection failed'))
    };

    const machine = new WorkflowStateMachine(
      genericDefinition, 
      mockRepo, 
      { id: '123', workflowId: 'wf-persist', version: 1, currentState: 'START', status: 'ACTIVE' }
    );

    await expect(machine.transition('PROCEED')).rejects.toThrowError('Database connection failed');

    expect(machine.getCurrentState()).toBe('START');
  });

  it('should return null if attempting to load an invalid workflow instance', async () => {
    const missing = await repository.load(randomUUID());
    expect(missing).toBeNull();
  });
});
