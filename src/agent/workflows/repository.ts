export interface WorkflowInstanceData {
  id: string;
  workflowId: string;
  version: number;
  currentState: string;
  status: string;
}

export interface WorkflowRepository {
  create(data: Omit<WorkflowInstanceData, 'version' | 'id'> & { id?: string }): Promise<WorkflowInstanceData>;
  load(id: string): Promise<WorkflowInstanceData | null>;
  saveTransition(id: string, expectedVersion: number, newState: string): Promise<WorkflowInstanceData>;
}
