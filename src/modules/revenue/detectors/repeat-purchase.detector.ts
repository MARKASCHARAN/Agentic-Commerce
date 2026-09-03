import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';
import { PrismaClient } from '@prisma/client';

export class RepeatPurchaseDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['catalog', 'inventory'];

  constructor(private readonly prisma?: PrismaClient) {}

  async detect(
    merchantId: string,
    capabilities: MerchantCapabilities,
    context: Record<string, any>
  ): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const replenishmentDue = context.replenishmentDue || false;
    const buyerRequestedReorder = context.buyerRequestedReorder || false;
    const sessionId = context.sessionId;

    if (!this.prisma || !sessionId) {
      return [];
    }

    if (!replenishmentDue && !buyerRequestedReorder) {
      return [];
    }

    try {
      // Fetch session to resolve userId
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId }
      });

      if (!session || !session.userId) {
        return [];
      }

      // Check merchant guardrails
      const guardrail = await this.prisma.merchantGuardrail.findUnique({
        where: { merchantId }
      });

      if (guardrail && guardrail.disabledSkills.includes('repeat_purchase')) {
        return [];
      }

      // Get user sessions
      const userSessions = await this.prisma.session.findMany({
        where: { userId: session.userId }
      });

      const sessionIds = userSessions.map(s => s.id);

      // Find completed or paid orders
      const completedOrders = await this.prisma.commerceOrder.findMany({
        where: {
          sessionId: { in: sessionIds },
          merchantId,
          status: { in: ['completed', 'paid', 'captured'] }
        },
        include: {
          items: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (completedOrders.length === 0) {
        return [];
      }

      // 1. buyerRequestedReorder -> Reorder the last purchased product
      if (buyerRequestedReorder) {
        const lastOrder = completedOrders[0];
        const lastItem = lastOrder.items[0];

        if (lastItem) {
          const product = await this.prisma.product.findUnique({
            where: { id: lastItem.productId }
          });

          if (product && product.active && product.merchantId === merchantId) {
            opportunities.push({
              id: crypto.randomUUID(),
              merchantId,
              sessionId,
              type: 'REPEAT_PURCHASE',
              affectedResources: [product.id],
              expectedImpactValue: product.priceMinor * lastItem.quantity,
              confidence: 0.98,
              evidence: `Buyer requested a reorder. Recommending last purchased product ${product.name}.`,
              proposedAction: {
                actionType: 'ADD_PRODUCT',
                resourceId: product.id,
                quantity: lastItem.quantity,
                priceMinor: product.priceMinor
              }
            });
          }
        }
      }

      // 2. replenishmentDue -> Suggest products that have a replenishment comment tag
      if (replenishmentDue) {
        // Collect all unique product IDs purchased
        const purchasedProductIds = Array.from(
          new Set(completedOrders.flatMap(o => o.items.map(i => i.productId)))
        );

        for (const productId of purchasedProductIds) {
          const product = await this.prisma.product.findUnique({
            where: { id: productId }
          });

          if (product && product.active && product.merchantId === merchantId && product.description) {
            const replenishmentMatch = product.description.match(/<!--\s*replenishmentDays:\s*(\d+)\s*-->/);
            if (replenishmentMatch) {
              const replenishmentDays = parseInt(replenishmentMatch[1], 10);
              if (replenishmentDays > 0) {
                opportunities.push({
                  id: crypto.randomUUID(),
                  merchantId,
                  sessionId,
                  type: 'REPEAT_PURCHASE',
                  affectedResources: [product.id],
                  expectedImpactValue: product.priceMinor,
                  confidence: 0.92,
                  evidence: `Replenishment interval of ${replenishmentDays} days reached. Recommending subscription replenishment for ${product.name}.`,
                  proposedAction: {
                    actionType: 'ADD_PRODUCT',
                    resourceId: product.id,
                    quantity: 1,
                    priceMinor: product.priceMinor
                  }
                });
              }
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
