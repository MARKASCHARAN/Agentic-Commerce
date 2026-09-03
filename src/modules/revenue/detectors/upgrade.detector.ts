import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';
import { PrismaClient } from '@prisma/client';

export class UpgradeDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['subscriptions', 'usage'];

  constructor(private readonly prisma?: PrismaClient) {}

  async detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const currentPlanId = context.currentPlanId;
    const requestedSeats = context.requestedSeats || 0;
    const sessionId = context.sessionId;

    if (!this.prisma || !currentPlanId) {
      return [];
    }

    try {
      const products = await this.prisma.product.findMany({
        where: { merchantId, active: true }
      });

      const plans: Record<string, { id: string, name: string, priceMinor: number, seatLimit: number }> = {};
      for (const p of products) {
        let seatLimit = undefined;
        if (p.metadata && typeof p.metadata === 'object' && 'maxSeats' in p.metadata) {
          seatLimit = (p.metadata as any).maxSeats;
        } else if (p.description) {
          // Fallback to legacy description parsing
          const match = p.description.match(/<!--\s*seatLimit:\s*(\d+)\s*-->/);
          if (match) seatLimit = parseInt(match[1], 10);
        }
        
        if (seatLimit !== undefined) {
          plans[p.id] = {
            id: p.id,
            name: p.name,
            priceMinor: p.priceMinor,
            seatLimit: seatLimit
          };
        }
      }

      if (plans[currentPlanId]) {
        const currentPlan = plans[currentPlanId];

        if (requestedSeats > currentPlan.seatLimit) {
          const upgradePlan = Object.values(plans)
            .filter(p => p.seatLimit >= requestedSeats && p.priceMinor > currentPlan.priceMinor)
            .sort((a, b) => a.priceMinor - b.priceMinor)[0];

          if (upgradePlan) {
            opportunities.push({
              id: crypto.randomUUID(),
              merchantId,
              sessionId,
              type: 'UPGRADE',
              affectedResources: [upgradePlan.id],
              expectedImpactValue: upgradePlan.priceMinor - currentPlan.priceMinor,
              confidence: 0.9,
              evidence: `User requested ${requestedSeats} seats, which exceeds current limit of ${currentPlan.seatLimit}. Recommending ${upgradePlan.name}.`,
              proposedAction: {
                actionType: 'UPGRADE_PLAN',
                resourceId: upgradePlan.id,
                priceMinor: upgradePlan.priceMinor, 
              }
            });
          }
        }
      }
    } catch {
      // safe fallback if DB fails
    }

    return opportunities;
  }
}
