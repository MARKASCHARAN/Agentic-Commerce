import { PrismaClient } from '@prisma/client';

export interface ApprovalRecord {
  id: string;
  token: string;
  entity_type: string;
  entity_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  payload?: any;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ApprovalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entityType: string, entityId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING', payload?: any): Promise<ApprovalRecord> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    const record = await this.prisma.approval.create({
      data: {
        entity_type: entityType,
        entity_id: entityId,
        status,
        payload: payload || {},
        expiresAt
      }
    });
    return record as ApprovalRecord;
  }

  async getByEntity(entityType: string, entityId: string): Promise<ApprovalRecord | null> {
    const record = await this.prisma.approval.findFirst({
      where: {
        entity_type: entityType,
        entity_id: entityId
      },
      orderBy: { createdAt: 'desc' }
    });
    return record as ApprovalRecord | null;
  }

  async getById(id: string): Promise<ApprovalRecord | null> {
    const record = await this.prisma.approval.findUnique({
      where: { id }
    });
    return record as ApprovalRecord | null;
  }

  async getByToken(token: string): Promise<ApprovalRecord | null> {
    const record = await this.prisma.approval.findUnique({
      where: { token }
    });
    return record as ApprovalRecord | null;
  }

  async updateStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<ApprovalRecord> {
    const record = await this.prisma.approval.update({
      where: { id },
      data: { status }
    });
    return record as ApprovalRecord;
  }
}
