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
    
    const instanceData = await this.deps.repository.load(instanceId);
    if (!instanceData) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    const definition = this.deps.getDefinition(instanceData.workflowId as WorkflowId);

    const machine = new WorkflowStateMachine(definition, undefined, instanceData);

    const transitionResult = await machine.transition(event as any);

    const transition = definition.transitions.find(
      t => t.from === instanceData.currentState && t.event === event
    );

    if (!transition) {
       throw new InvalidTransitionError(definition.id, instanceData.currentState, event);
    }

    if (transition.requiredTool) {
      try {
        await this.deps.toolGateway.execute({
          toolId: transition.requiredTool,
          input: eventPayload,
          context: identity
        });
      } catch (error) {

        throw error;
      }
    }

    const updatedInstance = await this.deps.repository.saveTransition(
      instanceId,
      instanceData.version,
      transitionResult.newState
    );

    return {
      workflowId: definition.id,
      previousState: transitionResult.previousState,
      newState: updatedInstance.currentState as any,
      event: event as any
    };
  }
}
