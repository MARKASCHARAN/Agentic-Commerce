import { prisma } from '../prisma/prisma';
import { WorkflowRepository, WorkflowInstanceData } from '../../agent/workflows/repository';

export class PrismaWorkflowRepository implements WorkflowRepository {
  async create(data: Omit<WorkflowInstanceData, 'version' | 'id'> & { id?: string }): Promise<WorkflowInstanceData> {
    const created = await prisma.workflowInstance.create({
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

  async load(id: string): Promise<WorkflowInstanceData | null> {
    const instance = await prisma.workflowInstance.findUnique({
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

  async saveTransition(id: string, expectedVersion: number, newState: string): Promise<WorkflowInstanceData> {
    const result = await prisma.workflowInstance.updateMany({
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
      throw new Error(`Optimistic concurrency conflict or instance not found: Workflow ${id} at version ${expectedVersion}`);
    }

    const updated = await this.load(id);
    if (!updated) {
      throw new Error(`Workflow instance ${id} missing after successful transition`);
    }

    return updated;
  }
}
