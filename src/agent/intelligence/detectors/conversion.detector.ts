import crypto from 'crypto';
import { OpportunityDetector, RevenueOpportunity, MerchantCapabilities, MerchantCapability } from '../types';

export class ConversionDetector implements OpportunityDetector {
  readonly requires: MerchantCapability[] = ['inventory', 'pricing', 'negotiation'];

  private readonly inventoryPriceBreaks: Record<string, { threshold: number, discountMinor: number, basePriceMinor: number }> = {
    'prod-chairs-1': { threshold: 100, discountMinor: 50000, basePriceMinor: 500000 }, 
  };

  async detect(merchantId: string, capabilities: MerchantCapabilities, context: Record<string, any>): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    const requestedProduct = context.requestedProductId;
    const requestedQuantity = context.requestedQuantity || 0;
    const sessionId = context.sessionId;

    if (requestedProduct && this.inventoryPriceBreaks[requestedProduct]) {
      const productPolicy = this.inventoryPriceBreaks[requestedProduct];

      if (requestedQuantity >= productPolicy.threshold) {
        const totalBase = productPolicy.basePriceMinor * requestedQuantity;
        const totalDiscount = productPolicy.discountMinor * requestedQuantity;
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
            priceMinor: productPolicy.basePriceMinor - productPolicy.discountMinor, 
            discountMinor: productPolicy.discountMinor,
          }
        });
      }
    }

    return opportunities;
  }
}
