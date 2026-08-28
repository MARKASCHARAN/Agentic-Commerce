import { ToolGateway } from '../tools/tool-gateway';
import { WorkflowRepository } from './repository';
import { WorkflowDefinition, WorkflowExecutionResult, WorkflowEvent, WorkflowId } from './types';
import { WorkflowStateMachine } from './workflow-state-machine';
import { ExecutionIdentity } from '../runtime/types';
import { InvalidTransitionError } from './errors';

export interface WorkflowExecutorDependencies {
  repository: WorkflowRepository;
  toolGateway: ToolGateway;
  getDefinition: (id: WorkflowId) => WorkflowDefinition<any, any, any>;
}

export class WorkflowExecutor {
  constructor(private readonly deps: WorkflowExecutorDependencies) {}

  async executeTransition<TInput = unknown>(
    instanceId: string,
    event: string,
    eventPayload: TInput,
    identity: ExecutionIdentity
  ): Promise<WorkflowExecutionResult> {
    // 1. Load workflow instance
    const instanceData = await this.deps.repository.load(instanceId);
    if (!instanceData) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    // 2. Resolve workflow definition
    const definition = this.deps.getDefinition(instanceData.workflowId as WorkflowId);

    // 3. Validate current state and event using the pure State Machine
    const machine = new WorkflowStateMachine(definition, undefined, instanceData);

    // 4. Validate event & Resolve legal transition
    // This will synchronously throw InvalidTransitionError if invalid, 
    // ensuring no tool or policy executes for invalid transitions.
    const transitionResult = await machine.transition(event as any);

    const transition = definition.transitions.find(
      t => t.from === instanceData.currentState && t.event === event
    );

    if (!transition) {
       throw new InvalidTransitionError(definition.id, instanceData.currentState, event);
    }

    // 6 & 7. Prepare and execute ToolGateway if required
    if (transition.requiredTool) {
      try {
        await this.deps.toolGateway.execute({
          toolId: transition.requiredTool,
          input: eventPayload,
          context: identity
        });
      } catch (error) {
        // If ToolGateway fails (e.g. PolicyAuthorizationError, PolicyApprovalRequiredError, ToolExecutionError),
        // we DO NOT persist the new state. The failure is explicitly surfaced.
        throw error;
      }
    }

    // 9. Persist resulting workflow state
    const updatedInstance = await this.deps.repository.saveTransition(
      instanceId,
      instanceData.version,
      transitionResult.newState
    );

    // 10. Return execution result
    return {
      workflowId: definition.id,
      previousState: transitionResult.previousState,
      newState: updatedInstance.currentState as any,
      event: event as any
    };
  }
}
