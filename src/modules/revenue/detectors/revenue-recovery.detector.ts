import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';
import { PrismaClient } from '@prisma/client';

export class RevenueRecoveryDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['catalog', 'inventory'];

  constructor(private readonly prisma?: PrismaClient) {}

  async detect(
    merchantId: string,
    capabilities: MerchantCapabilities,
    context: Record<string, any>
  ): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const paymentFailed = context.paymentFailed || false;
    const checkoutAbandoned = context.checkoutAbandoned || false;
    const sessionId = context.sessionId;

    if (!this.prisma || !sessionId) {
      return [];
    }

    if (!paymentFailed && !checkoutAbandoned) {
      return [];
    }

    try {
      // Fetch guardrail configuration to check disabledSkills
      const guardrail = await this.prisma.merchantGuardrail.findUnique({
        where: { merchantId }
      });

      if (guardrail && guardrail.disabledSkills.includes('recovery')) {
        return [];
      }

      // Load session cart
      const cart = await this.prisma.cart.findUnique({
        where: { sessionId }
      });

      const cartItems = cart?.items as any[];
      if (!cartItems || cartItems.length === 0) {
        return [];
      }

      let totalOriginalMinor = 0;
      let totalDiscountMinor = 0;
      const affectedResources: string[] = [];

      for (const item of cartItems) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (product && product.active && product.merchantId === merchantId) {
          affectedResources.push(product.id);
          const originalPrice = product.priceMinor;
          totalOriginalMinor += originalPrice * item.quantity;

          // Parse recoveryDiscountBps from description metadata comment
          const recoveryMatch = product.description?.match(/<!--\s*recoveryDiscountBps:\s*(\d+)\s*-->/);
          if (recoveryMatch) {
            const recoveryDiscountBps = parseInt(recoveryMatch[1], 10);
            if (recoveryDiscountBps > 0) {
              const itemDiscount = Math.floor((originalPrice * recoveryDiscountBps) / 10000);
              totalDiscountMinor += itemDiscount * item.quantity;
            }
          }
        }
      }

      if (affectedResources.length > 0) {
        const expectedImpactValue = totalOriginalMinor - totalDiscountMinor;

        opportunities.push({
          id: crypto.randomUUID(),
          merchantId,
          sessionId,
          type: 'RECOVERY',
          affectedResources,
          expectedImpactValue,
          confidence: 0.95,
          evidence: `Detected ${paymentFailed ? 'failed payment' : 'abandoned checkout'} signal for session. Suggesting cart recovery with total recovery discount of ₹${(totalDiscountMinor / 100).toFixed(2)}.`,
          proposedAction: {
            actionType: 'RESUME_CHECKOUT',
            resourceId: affectedResources[0],
            discountMinor: totalDiscountMinor,
            priceMinor: expectedImpactValue
          }
        });
      }
    } catch {
      // safe fallback
    }

    return opportunities;
  }
}
