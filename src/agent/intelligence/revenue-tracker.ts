import { PrismaClient } from '@prisma/client';
import { RevenueOpportunity } from './types';

export class RevenueTracker {
  constructor(private readonly prisma: PrismaClient) {}

  async logProposal(opportunity: RevenueOpportunity): Promise<void> {
    const existing = await this.prisma.revenueOpportunityLog.findFirst({
      where: {
        sessionId: opportunity.sessionId!,
        opportunityType: opportunity.type,
      }
    });

    if (existing) {
      await this.prisma.revenueOpportunityLog.update({
        where: { id: existing.id },
        data: {
          expectedImpactMinor: opportunity.expectedImpactValue,
          status: 'PROPOSED',
          updatedAt: new Date(),
        }
      });
      
      opportunity.id = existing.id;
    } else {
      const log = await this.prisma.revenueOpportunityLog.create({
        data: {
          id: opportunity.id,
          merchantId: opportunity.merchantId,
          sessionId: opportunity.sessionId!,
          buyerId: opportunity.buyerId,
          opportunityType: opportunity.type,
          expectedImpactMinor: opportunity.expectedImpactValue,
          status: 'PROPOSED',
        }
      });
      opportunity.id = log.id;
    }
  }

  async recordAcceptance(opportunityId: string): Promise<void> {
    await this.prisma.revenueOpportunityLog.updateMany({
      where: { id: opportunityId, status: 'PROPOSED' },
      data: { status: 'ACCEPTED', updatedAt: new Date() }
    });
  }

  async recordRejection(opportunityId: string): Promise<void> {
    await this.prisma.revenueOpportunityLog.updateMany({
      where: { id: opportunityId, status: 'PROPOSED' },
      data: { status: 'REJECTED', updatedAt: new Date() }
    });
  }

  async recordConversion(opportunityId: string, actualValueMinor: number, orderId?: string, paymentId?: string): Promise<void> {
    await this.prisma.revenueOpportunityLog.updateMany({
      where: { id: opportunityId, status: 'ACCEPTED' }, 
      data: {
        status: 'CONVERTED',
        realizedImpactMinor: actualValueMinor,
        orderId,
        paymentIntentId: paymentId,
        convertedAt: new Date(),
        updatedAt: new Date()
      }
    });
  }
}
