import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';

export class AOVDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['catalog', 'inventory'];

  private readonly complementaryGraph: Record<string, { id: string, name: string, priceMinor: number }[]> = {
    'prod-shoes-1': [
      { id: 'prod-socks-1', name: 'Running Socks', priceMinor: 699 },
      { id: 'prod-bottle-1', name: 'Water Bottle', priceMinor: 899 },
    ]
  };

  async detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const cartProductIds: string[] = context.cartProductIds || [];
    const sessionId = context.sessionId;

    for (const productId of cartProductIds) {
      const complements = this.complementaryGraph[productId] || [];
      for (const comp of complements) {
        
        if (!cartProductIds.includes(comp.id)) {
          opportunities.push({
            id: crypto.randomUUID(),
            merchantId,
            sessionId,
            type: 'CROSS_SELL',
            affectedResources: [comp.id],
            expectedImpactValue: comp.priceMinor,
            confidence: 0.8,
            evidence: `Buyer has ${productId} in cart, historically pairs well with ${comp.name}.`,
            proposedAction: {
              actionType: 'ADD_PRODUCT',
              resourceId: comp.id,
              quantity: 1,
              priceMinor: comp.priceMinor,
            }
          });
        }
      }
    }

    return opportunities;
  }
}
