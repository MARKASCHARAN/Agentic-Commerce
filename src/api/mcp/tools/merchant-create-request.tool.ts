import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';
import { ProtocolEngine } from '../../../modules/agent/protocol/protocol-engine.js';
import { PricingService } from '../../../modules/revenue/pricing-service.js';
import { RazorpayProvider } from '../../../infrastructure/razorpay/razorpay.provider.js';
import { DecisionLogger } from '../../../modules/audit/decision-logger.js';
import { env } from '../../../config/env.js';
import { RevenueIntelligenceEngine } from '../../../modules/revenue/revenue-engine.js';
import { MerchantCapabilityResolver } from '../../../modules/revenue/capability-resolver.js';
import { RevenueTracker } from '../../../modules/revenue/revenue-tracker.js';
import { formatOpportunity } from './opportunity-formatter.js';

const prisma = new PrismaClient();
const decisionLogger = new DecisionLogger(prisma);
const pricingService = new PricingService(prisma);
const paymentProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');
const protocolEngine = new ProtocolEngine(prisma, pricingService, paymentProvider, decisionLogger);
const capabilityResolver = new MerchantCapabilityResolver();
const revenueEngine = new RevenueIntelligenceEngine(
  {} as any,
  capabilityResolver,
  prisma
);
const revenueTracker = new RevenueTracker(prisma);

export const createRequestTool = {
  name: 'merchant.create_request',
  description: 'Create a commerce request for specific products. The AI must pass exactly the requested productId and quantity. Never provide prices or guess product IDs.',
  schema: {
    items: z.array(
      z.object({
        productId: z.string().describe('The UUID of the product being requested'),
        quantity: z.number().int().positive().describe('The number of units requested'),
        attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Optional vertical-specific dimensions (e.g. requestedSeats for SaaS)'),
      })
    ).min(1).describe('List of products the buyer intends to purchase'),
    budgetMinor: z.number().optional().describe('The buyer\'s maximum budget in minor units, if explicitly stated'),
    currency: z.string().optional().describe('Currency code, e.g., INR'),
    buyerEmail: z.string().optional().describe('The buyer\'s email address, if provided in the conversation')
  },
  handler: async ({ items, budgetMinor, currency, buyerEmail }: { items: { productId: string, quantity: number, attributes?: Record<string, string | number | boolean> }[], budgetMinor?: number, currency?: string, buyerEmail?: string }) => {
    try {
      const ctx = getMcpContext();

      // Ensure merchant exists and get guardrails
      const merchant = await prisma.merchant.findUnique({
        where: { id: ctx.merchantId },
        include: { strategy: true, capabilities: true }
      });

      if (!merchant) {
        throw new Error('Merchant not found');
      }

      const guardrails = await prisma.merchantGuardrail.findUnique({
        where: { merchantId: ctx.merchantId }
      });

      const merchantCapabilities = merchant.capabilities.map((c: any) => c.capability);

      const authoritativeItems = [];
      const cartContextItems = [];
      const products = [];
      const cartProductIds: string[] = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.merchantId !== ctx.merchantId) {
          throw new Error(`Product ${item.productId} does not belong to the requested merchant.`);
        }
        
        products.push(product);
        cartProductIds.push(product.id);

        cartContextItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPriceMinor: product.priceMinor,
          attributes: item.attributes
        });
        
        authoritativeItems.push({
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPriceMinor: product.priceMinor,
          attributes: item.attributes
        });
      }

      const commerceContext: any = { 
        merchantId: ctx.merchantId,
        buyerId: ctx.buyerId,
        sessionId: ctx.sessionId,
        intent: 'PURCHASE',
        capabilities: merchantCapabilities,
        cart: {
          items: cartContextItems,
          subtotalMinor: 0
        }
      };

      try {
        const { CommerceService } = await import('../../../modules/commerce/commerce-service.js');
        const commerceService = new CommerceService(prisma);
        await commerceService.validateRequest(commerceContext, products);
      } catch (e: any) {
        if (e.name === 'CapacityLimitExceededError') {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                code: "CAPACITY_LIMIT_EXCEEDED",
                message: e.message,
                opportunities: e.opportunities
              }, null, 2)
            }]
          };
        }
        if (e.message.startsWith('INVENTORY_UNAVAILABLE')) {
           return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                code: "INVENTORY_UNAVAILABLE",
                message: e.message
              })
            }]
          };
        }
        throw e;
      }
      
      const offer = await protocolEngine.createOffer(ctx.merchantId, ctx.buyerId, ctx.sessionId, authoritativeItems, 0, buyerEmail);

      const opportunity = await revenueEngine.analyze(
        ctx.merchantId,
        {
          sessionId: ctx.sessionId,
          cartProductIds,
          cartValueMinor: offer.totalMinor
        },
        guardrails as any
      );

      const opportunities = [];
      if (opportunity) {
        await revenueTracker.logProposal(opportunity);
        const formattedOpp = await formatOpportunity(opportunity, prisma);
        opportunities.push(formattedOpp);
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ 
          sessionId: ctx.sessionId,
          offerId: offer.id,
          status: offer.status,
          message: "Offer generated by Merchant ProtocolEngine",
          offer: {
            items: offer.items,
            subtotalMinor: offer.subtotalMinor,
            discountMinor: offer.discountMinor,
            totalMinor: offer.totalMinor,
            currency: offer.currency,
            expiresAt: offer.expiresAt
          },
          opportunities
        }, null, 2) }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "CREATE_REQUEST_FAILED", message: e.message }) }] };
    }
  }
};
