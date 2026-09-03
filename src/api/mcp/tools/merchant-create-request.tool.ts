import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';
import { ProtocolEngine } from '../../../modules/agent/protocol/protocol-engine.js';
import { PricingService } from '../../../modules/revenue/pricing-service.js';
import { RazorpayProvider } from '../../../infrastructure/razorpay/razorpay.provider.js';
import { DecisionLogger } from '../../../modules/audit/decision-logger.js';
import { env } from '../../../config/env.js';

const prisma = new PrismaClient();
const decisionLogger = new DecisionLogger(prisma);
const pricingService = new PricingService(prisma);
const paymentProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');
const protocolEngine = new ProtocolEngine(prisma, pricingService, paymentProvider, decisionLogger);

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

      // Ensure merchant has an agent setup
      const merchant = await prisma.merchant.findUnique({
        where: { id: ctx.merchantId },
        include: { strategy: true, capabilities: true }
      });

      if (!merchant) {
        throw new Error('Merchant not found');
      }

      const merchantCapabilities = merchant.capabilities.map((c: any) => c.capability);

      const authoritativeItems = [];
      const cartContextItems = [];
      const products = [];

      for (const item of items) {
        // Fetch exact product
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Verify ownership
        if (product.merchantId !== ctx.merchantId) {
          throw new Error(`Product ${item.productId} does not belong to the requested merchant.`);
        }
        
        products.push(product);

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

      // Build Generic Commerce Context
      const commerceContext: any = { 
        merchantId: ctx.merchantId,
        buyerId: ctx.buyerId,
        sessionId: ctx.sessionId,
        intent: 'PURCHASE',
        capabilities: merchantCapabilities,
        cart: {
          items: cartContextItems,
          subtotalMinor: 0 // Will be handled by ProtocolEngine pricing calculation
        }
      };

      try {
        const { CommerceService, CapacityLimitExceededError } = await import('../../../modules/commerce/commerce-service.js');
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
          }
        }, null, 2) }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "CREATE_REQUEST_FAILED", message: e.message }) }] };
    }
  }
};
