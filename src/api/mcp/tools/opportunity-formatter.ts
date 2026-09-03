import { PrismaClient } from '@prisma/client';
import { RevenueOpportunity } from '../../../modules/revenue/types.js';

export async function formatOpportunity(opp: RevenueOpportunity, prisma: PrismaClient) {
  const resourceId = opp.proposedAction?.resourceId;
  let productName: string | undefined = undefined;
  let price: number | undefined = opp.proposedAction?.priceMinor ? opp.proposedAction.priceMinor / 100 : undefined;
  let currency = 'INR';

  if (resourceId) {
    const prod = await prisma.product.findUnique({ where: { id: resourceId } });
    if (prod) {
      productName = prod.name;
      price = prod.priceMinor / 100;
      currency = prod.currency;
    }
  }

  return {
    opportunityId: opp.id,
    merchantId: opp.merchantId,
    type: opp.type,
    productId: resourceId,
    productName,
    price,
    currency,
    reason: opp.evidence,
    priority: opp.expectedImpactValue,
    confidence: opp.confidence,
    status: opp.policyDecision || 'ALLOWED'
  };
}
