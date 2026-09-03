import { PrismaClient, CommerceMessage } from '@prisma/client';

export type CreateCommerceMessageInput = Omit<CommerceMessage, 'id' | 'createdAt'>;

export class CommerceMessageConflictError extends Error {
  constructor(messageId: string) {
    super(`CommerceMessage with messageId ${messageId} already exists`);
    this.name = 'CommerceMessageConflictError';
  }
}

export class CommerceMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Idempotently creates a CommerceMessage.
   * If a message with the same messageId already exists, it throws a CommerceMessageConflictError.
   */
  async create(input: CreateCommerceMessageInput): Promise<CommerceMessage> {
    try {
      const message = await this.prisma.commerceMessage.create({
        data: input as any
      });
      return message;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new CommerceMessageConflictError(input.messageId);
      }
      throw error;
    }
  }

  async findByMessageId(messageId: string): Promise<CommerceMessage | null> {
    return this.prisma.commerceMessage.findUnique({
      where: { messageId }
    });
  }

  async findByCorrelationId(correlationId: string): Promise<CommerceMessage[]> {
    return this.prisma.commerceMessage.findMany({
      where: { correlationId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findBySessionId(sessionId: string): Promise<CommerceMessage[]> {
    return this.prisma.commerceMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }
    });
  }
}
