import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  createWorkflowDefinition,
  WorkflowValidationError,
  WorkflowId,
  InvalidTransitionError
} from '../../src/agent/workflows';

describe('Workflow Contract & Definition', () => {
  it('should successfully create and freeze a valid workflow definition', () => {
    const definition = createWorkflowDefinition({
      id: 'wf-1' as WorkflowId,
      name: 'Test Workflow',
      version: '1.0.0',
      inputSchema: z.object({ value: z.string() }),
      initialState: 'START',
      states: ['START', 'PROCESSING', 'END'],
      events: ['PROCEED', 'FINISH'],
      transitions: [
        { from: 'START', event: 'PROCEED', to: 'PROCESSING' },
        { from: 'PROCESSING', event: 'FINISH', to: 'END' }
      ]
    });

    expect(definition.id).toBe('wf-1');
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.states)).toBe(true);
    expect(Object.isFrozen(definition.events)).toBe(true);
    expect(Object.isFrozen(definition.transitions)).toBe(true);
  });

  it('should throw WorkflowValidationError if definition is missing required fields', () => {
    expect(() => createWorkflowDefinition({
      id: 'wf-1' as WorkflowId,
      
      version: '1.0.0',
      inputSchema: z.object({}),
      initialState: 'START',
      states: ['START'],
      events: [],
      transitions: []
    } as any)).toThrowError(WorkflowValidationError);
  });

  it('should throw WorkflowValidationError if states are empty or duplicate', () => {
    const base = {
      id: 'wf-1' as WorkflowId,
      name: 'Test',
      version: '1.0.0',
      inputSchema: z.object({}),
      initialState: 'START',
      events: [],
      transitions: []
    };

    expect(() => createWorkflowDefinition({
      ...base,
      states: []
    })).toThrowError(/at least one state/);

    expect(() => createWorkflowDefinition({
      ...base,
      states: ['START', 'START']
    })).toThrowError(/duplicate/);
  });

  it('should throw WorkflowValidationError if initial state is not in states array', () => {
    expect(() => createWorkflowDefinition({
      id: 'wf-1' as WorkflowId,
      name: 'Test',
      version: '1.0.0',
      inputSchema: z.object({}),
      initialState: 'UNKNOWN',
      states: ['START'],
      events: [],
      transitions: []
    })).toThrowError(/one of the defined states/);
  });

  it('should throw WorkflowValidationError if events contain duplicates', () => {
    expect(() => createWorkflowDefinition({
      id: 'wf-1' as WorkflowId,
      name: 'Test',
      version: '1.0.0',
      inputSchema: z.object({}),
      initialState: 'START',
      states: ['START'],
      events: ['EVT', 'EVT'],
      transitions: []
    })).toThrowError(/duplicate/);
  });

  it('should throw WorkflowValidationError if transitions reference unknown states or events', () => {
    const base = {
      id: 'wf-1' as WorkflowId,
      name: 'Test',
      version: '1.0.0',
      inputSchema: z.object({}),
      initialState: 'START',
      states: ['START', 'END'],
      events: ['PROCEED']
    };

    expect(() => createWorkflowDefinition({
      ...base,
      transitions: [{ from: 'UNKNOWN', event: 'PROCEED', to: 'END' }]
    })).toThrowError(/unknown from state: UNKNOWN/);

    expect(() => createWorkflowDefinition({
      ...base,
      transitions: [{ from: 'START', event: 'PROCEED', to: 'UNKNOWN' }]
    })).toThrowError(/unknown to state: UNKNOWN/);

    expect(() => createWorkflowDefinition({
      ...base,
      transitions: [{ from: 'START', event: 'UNKNOWN', to: 'END' }]
    })).toThrowError(/unknown event: UNKNOWN/);
  });

  it('should properly format InvalidTransitionError structure', () => {
    const err = new InvalidTransitionError('wf-payment', 'NEGOTIATING', 'CONFIRM');
    expect(err.workflowId).toBe('wf-payment');
    expect(err.currentState).toBe('NEGOTIATING');
    expect(err.requestedEvent).toBe('CONFIRM');
    expect(err.message).toContain("Cannot execute event 'CONFIRM' from state 'NEGOTIATING'");
  });
});
