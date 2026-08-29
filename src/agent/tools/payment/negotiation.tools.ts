import { z } from 'zod';
import { Tool } from '../types';
import { CatalogProvider } from '../../../catalog/types';
import { PrismaClient } from '@prisma/client';
import { getOrCreateCart } from '../../cart/cart-state';
import { NegotiationEngine } from '../../intelligence/negotiation/negotiation-engine';
import { NegotiationPolicy } from '../../intelligence/negotiation/types';

export const createNegotiationTool = (
  catalogProvider: CatalogProvider,
  guardrailRepository: any,
  prisma: PrismaClient
): Tool<any, any> => {
  const proposeSchema = z.object({
    productId: z.string().describe('The ID of the product to negotiate'),
    quantity: z.number().int().positive().describe('The quantity requested'),
    proposedPriceMinor: z.number().int().nonnegative().describe('The proposed unit price in minor units')
  });

  return {
    metadata: {
      id: 'negotiation.create' as any,
      name: 'Negotiate Offer',
      description: 'Propose a commercial discount offer for a product. Evaluates against merchant policy and guardrails.',
      version: '1.0.0'
    },
    inputSchema: proposeSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['negotiation.create'],
    policy: { id: 'financial-policy' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to negotiate');
        }

        const product = await catalogProvider.get(context.merchantId, input.productId);
        if (!product || !product.active) {
          return { status: 'not_found', reason: 'Product not found or inactive' };
        }

        // Parse cost from description comment
        const costMatch = product.description?.match(/<!--\s*costMinor:\s*(\d+)\s*-->/);
        const costMinor = costMatch ? parseInt(costMatch[1], 10) : undefined;

        // Parse negotiation policy
        const negMatch = product.description?.match(/<!--\s*neg:\s*({[^}]+})\s*-->/);
        let policy: NegotiationPolicy;
        if (negMatch) {
          try {
            policy = JSON.parse(negMatch[1]);
          } catch {
            policy = { enabled: false, negotiable: false };
          }
        } else {
          policy = { enabled: false, negotiable: false };
        }

        if (!policy.enabled || !policy.negotiable) {
          return {
            status: 'denied',
            reason: 'Resource is not negotiable or negotiation is disabled',
            approvedPriceMinor: product.priceMinor
          };
        }

        // Fetch merchant guardrails
        const guardrails = guardrailRepository
          ? await guardrailRepository.getGuardrails(context.merchantId)
          : undefined;

        const engine = new NegotiationEngine();
        const result = engine.evaluate(
          {
            resourceId: input.productId,
            quantity: input.quantity,
            originalPriceMinor: product.priceMinor,
            proposedPriceMinor: input.proposedPriceMinor,
            currency: product.currency,
            costMinor
          },
          policy,
          guardrails
        );

        // Update the cart state
        const cart = await getOrCreateCart(prisma, context.sessionId);
        const items = (cart.items as any[] || []).slice();
        const existingItemIndex = items.findIndex(i => i.productId === input.productId);
        
        const approvedPrice = result.approvedPriceMinor ?? product.priceMinor;
        
        if (existingItemIndex > -1) {
          items[existingItemIndex] = {
            ...items[existingItemIndex],
            quantity: input.quantity,
            negotiatedPriceMinor: approvedPrice
          };
        } else {
          items.push({
            productId: input.productId,
            quantity: input.quantity,
            negotiatedPriceMinor: approvedPrice
          });
        }

        await prisma.cart.update({
          where: { sessionId: context.sessionId },
          data: { items: items as any }
        });

        return {
          status: result.allowed ? 'success' : 'denied',
          approvedPriceMinor: approvedPrice,
          reason: result.reason,
          appliedRule: result.appliedRule,
          savingsMinor: product.priceMinor - approvedPrice
        };
      }
    }
  };
};
