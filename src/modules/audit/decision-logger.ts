import { PrismaClient } from '@prisma/client';

export class DecisionLogger {
  constructor(private prisma: PrismaClient) {}

  async log(params: {
    sessionId: string;
    merchantId: string;
    action: string;
    reasoning?: string;
    metadata?: any;
  }) {
    await this.prisma.agentDecisionLog.create({
      data: {
        sessionId: params.sessionId,
        merchantId: params.merchantId,
        action: params.action,
        reasoning: params.reasoning,
        metadata: params.metadata || {},
      },
    });
  }

  async getTimeline(sessionId: string) {
    return this.prisma.agentDecisionLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
