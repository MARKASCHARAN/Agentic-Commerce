import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';
import { RevenueIntelligenceEngine } from '../../../modules/revenue/revenue-engine.js';
import { MerchantCapabilityResolver } from '../../../modules/revenue/capability-resolver.js';
import { RevenueTracker } from '../../../modules/revenue/revenue-tracker.js';
import { formatOpportunity } from './opportunity-formatter.js';

const prisma = new PrismaClient();
const capabilityResolver = new MerchantCapabilityResolver();
const revenueEngine = new RevenueIntelligenceEngine(
  {} as any,
  capabilityResolver,
  prisma
);
const revenueTracker = new RevenueTracker(prisma);

export const checkOpportunitiesTool = {
  name: 'merchant.check_opportunities',
  description: 'Check the merchant backend for active cross-sell or upsell opportunities for the buyer. Call this after searching products or generating an offer to see if you can suggest relevant add-ons.',
  schema: {
    cartValueMinor: z.number().optional().describe('Current cart or offer value in minor units'),
    productIds: z.array(z.string()).optional().describe('List of product IDs the user is interested in buying')
  },
  handler: async ({ cartValueMinor, productIds }: { cartValueMinor?: number, productIds?: string[] }) => {
    try {
      const ctx = getMcpContext();
      
      const guardrails = await prisma.merchantGuardrail.findUnique({
        where: { merchantId: ctx.merchantId }
      });
      
      if (!guardrails) throw new Error('Guardrails not found');

      // Fetch the latest offer for this session to extract product IDs
      const offer = await prisma.offer.findFirst({
        where: { sessionId: ctx.sessionId, status: { in: ['OFFERED', 'COUNTERED', 'PAYMENT_PENDING'] } },
        orderBy: { createdAt: 'desc' }
      });

      let cartProductIds: string[] = productIds || [];
      if (offer && Array.isArray(offer.items)) {
        const offerIds = (offer.items as any[]).map(item => item.productId);
        cartProductIds = [...new Set([...cartProductIds, ...offerIds])];
      }

      const opportunity = await revenueEngine.analyze(
        ctx.merchantId, 
        { sessionId: ctx.sessionId, cartValueMinor: cartValueMinor || (offer ? offer.totalMinor : 0), cartProductIds },
        guardrails as any
      );

      if (!opportunity) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "No active opportunities.",
              opportunities: []
            }, null, 2)
          }]
        };
      }

      // Log proposal to PostgreSQL database
      await revenueTracker.logProposal(opportunity);

      const formattedOpp = await formatOpportunity(opportunity, prisma);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            opportunities: [formattedOpp]
          }, null, 2)
        }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "CHECK_OPPORTUNITIES_FAILED", message: e.message }) }] };
    }
  }
};
