import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';
import { PrismaClient } from '@prisma/client';

export class ConversionDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['inventory', 'pricing', 'negotiation'];

  constructor(private readonly prisma?: PrismaClient) {}

  async detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const requestedProduct = context.requestedProductId;
    const requestedQuantity = context.requestedQuantity || 0;
    const sessionId = context.sessionId;

    if (!this.prisma || !requestedProduct) {
      return [];
    }

    try {
      const product = await this.prisma.product.findUnique({
        where: { id: requestedProduct }
      });

      if (!product || !product.active || product.merchantId !== merchantId || !product.description) {
        return [];
      }

      const match = product.description.match(/<!--\s*bulk:\s*({[^}]+})\s*-->/);
      if (!match) {
        return [];
      }

      const bulkPolicy = JSON.parse(match[1]);
      const threshold = bulkPolicy.threshold;
      const discountMinor = bulkPolicy.discountMinor;

      if (requestedQuantity >= threshold) {
        const totalBase = product.priceMinor * requestedQuantity;
        const totalDiscount = discountMinor * requestedQuantity;
        const totalProposed = totalBase - totalDiscount;

        opportunities.push({
          id: crypto.randomUUID(),
          merchantId,
          sessionId,
          type: 'BULK_QUOTE',
          affectedResources: [requestedProduct],
          expectedImpactValue: totalProposed,
          confidence: 0.85,
          evidence: `Buyer requested ${requestedQuantity} units of ${requestedProduct}, which qualifies for bulk pricing tier.`,
          proposedAction: {
            actionType: 'APPLY_DISCOUNT',
            resourceId: requestedProduct,
            quantity: requestedQuantity,
            priceMinor: product.priceMinor - discountMinor, 
            discountMinor,
          }
        });
      }
    } catch {
      // safe fallback if DB fails or JSON parsing fails
    }

    return opportunities;
  }
}
