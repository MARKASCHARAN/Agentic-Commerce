import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';

export class UpgradeDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['subscriptions', 'usage'];

  private readonly plans: Record<string, { id: string, name: string, priceMinor: number, seatLimit: number }> = {
    'plan-starter': { id: 'plan-starter', name: 'Starter Plan', priceMinor: 49900, seatLimit: 5 },
    'plan-growth': { id: 'plan-growth', name: 'Growth Plan', priceMinor: 99900, seatLimit: 15 },
  };

  async detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const currentPlanId = context.currentPlanId;
    const requestedSeats = context.requestedSeats || 0;
    const sessionId = context.sessionId;

    if (currentPlanId && this.plans[currentPlanId]) {
      const currentPlan = this.plans[currentPlanId];

      if (requestedSeats > currentPlan.seatLimit) {
        
        if (currentPlanId === 'plan-starter' && requestedSeats <= this.plans['plan-growth'].seatLimit) {
          const upgradePlan = this.plans['plan-growth'];
          
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

    return opportunities;
  }
}
