import { PrismaClient } from '@prisma/client';

export interface OutboxEventInput {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId?: string;
  payload: any;
}

export interface OutboxEventRecord {
  id: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string | null;
  payload: any;
  status: string;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  lastError: any;
  createdAt: Date;
  updatedAt: Date;
}

export class OutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(event: OutboxEventInput, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.outboxEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
        payload: event.payload,
      },
    });
  }

  async findPending(limit: number, tx?: any): Promise<OutboxEventRecord[]> {
    const client = tx || this.prisma;
    return client.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async claimNext(limit: number): Promise<OutboxEventRecord[]> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });

    if (pending.length === 0) return [];

    const claimed: OutboxEventRecord[] = [];
    for (const candidate of pending) {
      const result = await this.prisma.outboxEvent.updateMany({
        where: { id: candidate.id, status: 'PENDING' },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
      });
      if (result.count === 1) {
        const updated = await this.prisma.outboxEvent.findUnique({
          where: { id: candidate.id },
        });
        if (updated) claimed.push(updated);
      }
    }
    return claimed;
  }

  async markDelivered(id: string, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.outboxEvent.update({
      where: { id },
      data: { status: 'DELIVERED', processedAt: new Date() },
    });
  }

  async markFailed(id: string, error: any, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.outboxEvent.update({
      where: { id },
      data: { status: 'FAILED', lastError: error },
    });
  }

  async markPendingRetry(id: string, backoffMs: number, error: any, tx?: any): Promise<void> {
    const client = tx || this.prisma;
    await client.outboxEvent.update({
      where: { id },
      data: {
        status: 'PENDING',
        availableAt: new Date(Date.now() + backoffMs),
        lastError: error,
      },
    });
  }

  async resetStaleProcessing(staleMs: number, tx?: any): Promise<number> {
    const client = tx || this.prisma;
    const cutoff = new Date(Date.now() - staleMs);
    const result = await client.outboxEvent.updateMany({
      where: { status: 'PROCESSING', updatedAt: { lt: cutoff } },
      data: { status: 'PENDING' },
    });
    return result.count;
  }

  async getById(id: string, tx?: any): Promise<OutboxEventRecord | null> {
    const client = tx || this.prisma;
    return client.outboxEvent.findUnique({ where: { id } });
  }

  async getByEventId(eventId: string, tx?: any): Promise<OutboxEventRecord | null> {
    const client = tx || this.prisma;
    return client.outboxEvent.findUnique({ where: { eventId } });
  }
}
