import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export class SessionRepository {
  async create(data: Prisma.SessionCreateInput) {
    return prisma.session.create({ data });
  }

  async findById(id: string) {
    return prisma.session.findUnique({
      where: { id },
      include: {
        messages: true,
        events: true,
        tool_calls: true,
      },
    });
  }

  async updateState(id: string, state: string) {
    return prisma.session.update({
      where: { id },
      data: { state },
    });
  }
}
