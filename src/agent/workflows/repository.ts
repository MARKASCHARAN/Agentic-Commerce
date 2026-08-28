export interface WorkflowInstanceData {
  id: string;
  workflowId: string;
  version: number;
  currentState: string;
  status: string;
}

export interface WorkflowRepository {
  create(data: Omit<WorkflowInstanceData, 'version' | 'id'> & { id?: string }, tx?: any): Promise<WorkflowInstanceData>;
  load(id: string, tx?: any): Promise<WorkflowInstanceData | null>;
  saveTransition(id: string, expectedVersion: number, newState: string, tx?: any): Promise<WorkflowInstanceData>;
}
