import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export class ToolCallRepository {
  async create(data: Prisma.ToolCallCreateInput) {
    return prisma.toolCall.create({ data });
  }

  async findBySessionId(sessionId: string) {
    return prisma.toolCall.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
