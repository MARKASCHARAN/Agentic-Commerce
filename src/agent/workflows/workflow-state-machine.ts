import { WorkflowDefinition, WorkflowExecutionResult } from './types';
import { InvalidTransitionError } from './errors';
import { WorkflowRepository, WorkflowInstanceData } from './repository';

export class WorkflowStateMachine<TInput, TState extends string, TEvent extends string> {
  private _currentState: TState;
  private readonly transitionMap: Map<string, TState>;

  constructor(
    public readonly definition: WorkflowDefinition<TInput, TState, TEvent>,
    private readonly repository?: WorkflowRepository,
    private instanceData?: WorkflowInstanceData
  ) {
    this._currentState = instanceData?.currentState as TState ?? definition.initialState;
    this.transitionMap = new Map();

    for (const transition of definition.transitions) {
      const key = this.getTransitionKey(transition.from, transition.event);
      this.transitionMap.set(key, transition.to);
    }
  }

  public getCurrentState(): TState {
    return this._currentState;
  }

  public async transition(event: TEvent): Promise<WorkflowExecutionResult> {
    const key = this.getTransitionKey(this._currentState, event);
    
    // [STATE MACHINE]
    // Enforces strict Directed Acyclic Graph (DAG) constraints on commerce flows.
    // Prevents an agent from skipping critical steps (e.g., jumping straight to PAYMENT_REQUEST 
    // without an ACCEPTED offer), securing the execution lifecycle.
    const nextState = this.transitionMap.get(key);

    if (!nextState) {
      throw new InvalidTransitionError(
        this.definition.id,
        this._currentState,
        event
      );
    }

    if (this.repository && this.instanceData) {
      const updatedInstance = await this.repository.saveTransition(
        this.instanceData.id,
        this.instanceData.version,
        nextState
      );
      this.instanceData.version = updatedInstance.version;
      this.instanceData.currentState = updatedInstance.currentState;
    }

    const previousState = this._currentState;
    this._currentState = nextState;

    return {
      workflowId: this.definition.id,
      previousState: previousState as unknown as any,
      newState: nextState as unknown as any,
      event: event as unknown as any
    };
  }

  private getTransitionKey(state: TState, event: TEvent): string {
    return `${state}::${event}`;
  }
}
