import { prisma } from '../prisma/prisma';
import { WorkflowRepository, WorkflowInstanceData } from '../../agent/workflows/repository';
import { StaleWorkflowWorkerError } from '../../agent/workflows/errors';

export class PrismaWorkflowRepository implements WorkflowRepository {
  async create(data: Omit<WorkflowInstanceData, 'version' | 'id'> & { id?: string }, tx?: any): Promise<WorkflowInstanceData> {
    const client = tx || prisma;
    const created = await client.workflowInstance.create({
      data: {
        id: data.id,
        workflowId: data.workflowId,
        currentState: data.currentState,
        status: data.status,
        version: 1
      }
    });

    return {
      id: created.id,
      workflowId: created.workflowId,
      version: created.version,
      currentState: created.currentState,
      status: created.status
    };
  }

  async load(id: string, tx?: any): Promise<WorkflowInstanceData | null> {
    const client = tx || prisma;
    const instance = await client.workflowInstance.findUnique({
      where: { id }
    });

    if (!instance) {
      return null;
    }

    return {
      id: instance.id,
      workflowId: instance.workflowId,
      version: instance.version,
      currentState: instance.currentState,
      status: instance.status
    };
  }

  async saveTransition(id: string, expectedVersion: number, newState: string, tx?: any): Promise<WorkflowInstanceData> {
    const client = tx || prisma;
    const result = await client.workflowInstance.updateMany({
      where: { 
        id, 
        version: expectedVersion 
      },
      data: { 
        currentState: newState, 
        version: expectedVersion + 1 
      }
    });

    if (result.count === 0) {
      throw new StaleWorkflowWorkerError('', id, expectedVersion);
    }

    const updated = await this.load(id, client);
    if (!updated) {
      throw new Error(`Workflow instance ${id} missing after successful transition`);
    }

    return updated;
  }
}
