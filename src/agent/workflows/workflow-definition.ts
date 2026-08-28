import { WorkflowDefinition, WorkflowTransition } from './types';
import { WorkflowValidationError } from './errors';

export function createWorkflowDefinition<TInput, TState extends string, TEvent extends string>(
  definition: WorkflowDefinition<TInput, TState, TEvent>
): WorkflowDefinition<TInput, TState, TEvent> {
  if (!definition.id) throw new WorkflowValidationError('unknown', 'Workflow missing id');
  if (!definition.name) throw new WorkflowValidationError(definition.id, 'Workflow missing name');
  if (!definition.version) throw new WorkflowValidationError(definition.id, 'Workflow missing version');
  if (!definition.inputSchema) throw new WorkflowValidationError(definition.id, 'Workflow missing inputSchema');

  if (!definition.states || definition.states.length === 0) {
    throw new WorkflowValidationError(definition.id, 'Workflow must have at least one state');
  }

  const stateSet = new Set(definition.states);
  if (stateSet.size !== definition.states.length) {
    throw new WorkflowValidationError(definition.id, 'Workflow states contain duplicates');
  }

  if (!definition.initialState || !stateSet.has(definition.initialState)) {
    throw new WorkflowValidationError(definition.id, 'Initial state must be one of the defined states');
  }

  const eventSet = new Set(definition.events || []);
  if (eventSet.size !== (definition.events?.length || 0)) {
    throw new WorkflowValidationError(definition.id, 'Workflow events contain duplicates');
  }

  if (definition.transitions) {
    for (const transition of definition.transitions) {
      if (!stateSet.has(transition.from)) {
        throw new WorkflowValidationError(definition.id, `Transition references unknown from state: ${transition.from}`);
      }
      if (!stateSet.has(transition.to)) {
        throw new WorkflowValidationError(definition.id, `Transition references unknown to state: ${transition.to}`);
      }
      if (!eventSet.has(transition.event)) {
        throw new WorkflowValidationError(definition.id, `Transition references unknown event: ${transition.event}`);
      }
    }
    Object.freeze(definition.transitions);
  }

  Object.freeze(definition.states);
  Object.freeze(definition.events);
  
  return Object.freeze({ ...definition });
}
