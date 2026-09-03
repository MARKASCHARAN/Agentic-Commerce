import { PrismaClient } from '@prisma/client';

export interface MerchantRevenueMetrics {
  merchantId: string;
  totalProposals: number;
  totalAccepted: number;
  totalConverted: number;
  acceptanceRate: number; 
  opportunityConversionRate: number; 
  attributedIncrementalRevenueMinor: number;
}

export class RevenueAnalytics {
  constructor(private readonly prisma: PrismaClient) {}

  async getMetricsForMerchant(merchantId: string): Promise<MerchantRevenueMetrics> {
    const logs = await this.prisma.revenueOpportunityLog.findMany({
      where: { merchantId }
    });

    const totalProposals = logs.length;
    const acceptedLogs = logs.filter(l => l.status === 'ACCEPTED' || l.status === 'CONVERTED');
    const convertedLogs = logs.filter(l => l.status === 'CONVERTED');

    const totalAccepted = acceptedLogs.length;
    const totalConverted = convertedLogs.length;

    const acceptanceRate = totalProposals > 0 ? totalAccepted / totalProposals : 0;
    const opportunityConversionRate = totalAccepted > 0 ? totalConverted / totalAccepted : 0;

    const attributedIncrementalRevenueMinor = convertedLogs.reduce((sum, log) => sum + log.realizedImpactMinor, 0);

    return {
      merchantId,
      totalProposals,
      totalAccepted,
      totalConverted,
      acceptanceRate,
      opportunityConversionRate,
      attributedIncrementalRevenueMinor,
    };
  }
}
