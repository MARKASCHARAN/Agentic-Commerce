import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';
import { CatalogProvider } from '../../../catalog/types';

export class AOVDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['catalog', 'inventory'];

  constructor(private readonly catalogProvider?: CatalogProvider) {}

  async detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];
    if (!this.catalogProvider) {
      return [];
    }

    const cartProductIds: string[] = context.cartProductIds || [];
    const sessionId = context.sessionId;

    for (const productId of cartProductIds) {
      const complements = await this.catalogProvider.getRelatedProducts(merchantId, productId);
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
