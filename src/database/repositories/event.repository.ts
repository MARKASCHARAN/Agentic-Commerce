import { prisma } from '../prisma/prisma';
import { Prisma } from '@prisma/client';

export class EventRepository {
  async create(data: Prisma.EventCreateInput) {
    return prisma.event.create({ data });
  }

  async findBySessionId(sessionId: string) {
    return prisma.event.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
