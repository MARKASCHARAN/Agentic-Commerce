import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';
import { PrismaClient } from '@prisma/client';

export class ConversionOptimizationDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['catalog', 'inventory'];

  constructor(private readonly prisma?: PrismaClient) {}

  async detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const buyerHesitated = context.buyerHesitated || false;
    const productUncertainty = context.productUncertainty || false;
    const priceObjection = context.priceObjection || false;
    const currentProductId = context.currentProductId;
    const sessionId = context.sessionId;

    if (!this.prisma) {
      return [];
    }

    try {
      // 1. Alternates for Hesitation & Uncertainty
      if ((buyerHesitated || productUncertainty) && currentProductId) {
        const product = await this.prisma.product.findUnique({
          where: { id: currentProductId }
        });

        if (product && product.active && product.merchantId === merchantId && product.description) {
          const altMatch = product.description.match(/<!--\s*alt:\s*(\[[^\]]+\])\s*-->/);
          if (altMatch) {
            const altIds: string[] = JSON.parse(altMatch[1]);
            for (const altId of altIds) {
              const altProd = await this.prisma.product.findUnique({
                where: { id: altId }
              });

              if (altProd && altProd.active && altProd.merchantId === merchantId) {
                // Check inventory
                const inv = await this.prisma.inventory.findUnique({
                  where: { productId: altId }
                });

                if (inv && inv.quantity > 0) {
                  opportunities.push({
                    id: crypto.randomUUID(),
                    merchantId,
                    sessionId,
                    type: 'RECOVERY',
                    affectedResources: [altId],
                    expectedImpactValue: altProd.priceMinor,
                    confidence: 0.85,
                    evidence: `Buyer showed hesitation/uncertainty for product ${product.name}. Recommending alternative ${altProd.name} which has available inventory.`,
                    proposedAction: {
                      actionType: 'ADD_PRODUCT',
                      resourceId: altId,
                      quantity: 1,
                      priceMinor: altProd.priceMinor
                    }
                  });
                  break; // propose the first suitable alternative
                }
              }
            }
          }
        }
      }

      // 2. priceObjection -> Discount
      if (priceObjection && currentProductId) {
        const product = await this.prisma.product.findUnique({
          where: { id: currentProductId }
        });

        if (product && product.active && product.merchantId === merchantId && product.description) {
          // Parse max allowed discount from negotiation policy comment
          const negMatch = product.description.match(/<!--\s*neg:\s*({[^}]+})\s*-->/);
          if (negMatch) {
            const policy = JSON.parse(negMatch[1]);
            if (policy.enabled && policy.negotiable && policy.maxDiscountBps > 0) {
              const discountAllowedMinor = Math.floor((product.priceMinor * policy.maxDiscountBps) / 10000);
              const proposedPriceMinor = product.priceMinor - discountAllowedMinor;

              opportunities.push({
                id: crypto.randomUUID(),
                merchantId,
                sessionId,
                type: 'RECOVERY',
                affectedResources: [currentProductId],
                expectedImpactValue: proposedPriceMinor,
                confidence: 0.9,
                evidence: `Buyer expressed price objection. Offering merchant-permitted discount price on ${product.name}.`,
                proposedAction: {
                  actionType: 'APPLY_DISCOUNT',
                  resourceId: currentProductId,
                  quantity: 1,
                  priceMinor: proposedPriceMinor,
                  discountMinor: discountAllowedMinor
                }
              });
            }
          }
        }
      }
    } catch {
      // safe fallback
    }

    return opportunities;
  }
}
