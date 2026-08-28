import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  createWorkflowDefinition,
  WorkflowStateMachine,
  InvalidTransitionError,
  WorkflowId
} from '../../src/agent/workflows';

describe('Workflow State Machine', async () => {
  const genericDefinition = createWorkflowDefinition({
    id: 'wf-generic' as WorkflowId,
    name: 'Generic Test Workflow',
    version: '1.0.0',
    inputSchema: z.object({}),
    initialState: 'A',
    states: ['A', 'B', 'C'],
    events: ['START', 'FINISH'],
    transitions: [
      { from: 'A', event: 'START', to: 'B' },
      { from: 'B', event: 'FINISH', to: 'C' }
    ]
  });

  it('should initialize at the correct initial state without requiring an event', async () => {
    const machine = new WorkflowStateMachine(genericDefinition);
    expect(machine.getCurrentState()).toBe('A');
  });

  it('should successfully transition through valid sequence returning correct structure', async () => {
    const machine = new WorkflowStateMachine(genericDefinition);
    
    const res1 = await machine.transition('START');
    expect(res1.previousState).toBe('A');
    expect(res1.newState).toBe('B');
    expect(res1.event).toBe('START');
    expect(machine.getCurrentState()).toBe('B');

    const res2 = await machine.transition('FINISH');
    expect(res2.previousState).toBe('B');
    expect(res2.newState).toBe('C');
    expect(res2.event).toBe('FINISH');
    expect(machine.getCurrentState()).toBe('C');
  });

  it('should maintain strict isolation between two instances', async () => {
    const machine1 = new WorkflowStateMachine(genericDefinition);
    const machine2 = new WorkflowStateMachine(genericDefinition);

    await machine1.transition('START');
    expect(machine1.getCurrentState()).toBe('B');
    
    // machine2 remains completely untouched
    expect(machine2.getCurrentState()).toBe('A');
  });

  it('should reject invalid transitions and remain atomic (no partial state mutation)', async () => {
    const machine = new WorkflowStateMachine(genericDefinition);
    
    await expect(machine.transition('FINISH')).rejects.toThrowError(InvalidTransitionError);
    
    // Prove it remained atomic (did not move state)
    expect(machine.getCurrentState()).toBe('A');
  });

  it('should enforce terminal state behavior (no outgoing transitions)', async () => {
    const machine = new WorkflowStateMachine(genericDefinition);
    await machine.transition('START');
    await machine.transition('FINISH');
    
    expect(machine.getCurrentState()).toBe('C');

    // State C has no outgoing transitions defined.
    await expect(machine.transition('START')).rejects.toThrowError(InvalidTransitionError);
    await expect(machine.transition('FINISH')).rejects.toThrowError(InvalidTransitionError);
    
    expect(machine.getCurrentState()).toBe('C');
  });
  
  it('should leave definition completely immutable during transitions', async () => {
    const machine = new WorkflowStateMachine(genericDefinition);
    await machine.transition('START');
    
    expect(Object.isFrozen(machine.definition)).toBe(true);
    expect(Object.isFrozen(machine.definition.states)).toBe(true);
    expect(Object.isFrozen(machine.definition.transitions)).toBe(true);
  });
});
