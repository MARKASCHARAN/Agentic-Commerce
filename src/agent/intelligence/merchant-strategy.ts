import { PrismaClient } from '@prisma/client';

export interface MerchantStrategy {
  revenueGoal: string;
  maxDiscountBps: number;
  minimumMarginBps: number;
  approvalAboveMinor: number;
  preferredProductIds: string[];
  highMarginProductIds: string[];
}

export class MerchantStrategyResolver {
  constructor(private readonly prisma: PrismaClient) {}

  async resolve(merchantId: string): Promise<MerchantStrategy> {
    try {
      const guardrail = await this.prisma.merchantGuardrail.findUnique({
        where: { merchantId }
      });

      const products = await this.prisma.product.findMany({
        where: { merchantId, active: true }
      });

      const preferredProductIds: string[] = [];
      const highMarginProductIds: string[] = [];

      for (const product of products) {
        if (!product.description) continue;

        if (/<!--\s*priority:\s*high\s*-->/.test(product.description)) {
          preferredProductIds.push(product.id);
        }
        if (/<!--\s*margin:\s*high\s*-->/.test(product.description)) {
          highMarginProductIds.push(product.id);
        }
      }

      return {
        revenueGoal: guardrail?.revenueGoal || 'BALANCED',
        maxDiscountBps: guardrail?.maxDiscountBps || 0,
        minimumMarginBps: guardrail?.minimumMarginBps || 0,
        approvalAboveMinor: guardrail?.approvalAboveMinor || 0,
        preferredProductIds,
        highMarginProductIds,
      };
    } catch {
      return {
        revenueGoal: 'BALANCED',
        maxDiscountBps: 0,
        minimumMarginBps: 0,
        approvalAboveMinor: 0,
        preferredProductIds: [],
        highMarginProductIds: [],
      };
    }
  }
}
