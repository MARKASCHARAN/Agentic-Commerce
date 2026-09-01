import { z } from 'zod';
import { Tool } from '../types';
import { PrismaClient } from '@prisma/client';
import { acceptOpportunity } from '../../cart/cart-state';
import { PrismaCatalogProvider } from '../../../catalog/prisma-catalog.provider';

export const createOpportunityAcceptTool = (
  prisma: PrismaClient
): Tool<z.infer<typeof acceptSchema>, any> => {
  const acceptSchema = z.object({
    opportunityId: z.string().describe('The ID of the PROPOSED revenue opportunity OR the Product ID of the cross-sell item to accept'),
  });

  return {
    metadata: {
      id: 'opportunity.accept' as any,
      name: 'Accept Opportunity',
      description: 'Accepts a proposed revenue opportunity and adds the corresponding product to the cart. MUST be called BEFORE checkout.create if the buyer consents to a cross-sell or upsell.',
      version: '1.0.0'
    },
    inputSchema: acceptSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['checkout.create'], // Ties to the ability to mutate cart/checkout state
    policy: { id: 'financial-policy' },
    idempotency: { required: true, scope: 'opportunity' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to accept an opportunity');
        }
        if (!context.sessionId) {
          throw new Error('Session ID is required to accept an opportunity');
        }

        let opportunity = await prisma.revenueOpportunityLog.findFirst({
          where: {
            id: input.opportunityId,
            merchantId: context.merchantId,
            sessionId: context.sessionId,
            status: 'PROPOSED'
          }
        });

        if (!opportunity) {
          // Fallback: Check if the input is actually a resourceId (productId)
          const allProposed = await prisma.revenueOpportunityLog.findMany({
            where: {
              merchantId: context.merchantId,
              sessionId: context.sessionId,
              status: 'PROPOSED'
            }
          });
          
          for (const opp of allProposed) {
            const resId = (opp as any).proposedAction?.resourceId;
            if (resId === input.opportunityId) {
              opportunity = opp;
              break;
            }
          }
        }

        if (!opportunity) {
          throw new Error(`Security Exception: Opportunity ${input.opportunityId} not found, does not belong to this session/merchant, or is not in PROPOSED status.`);
        }

        let resourceId = (opportunity as any).proposedAction?.resourceId;

        // Fallback: If not dynamically present in object, infer from cart complements
        if (!resourceId) {
          const cart = await prisma.cart.findUnique({ where: { sessionId: context.sessionId } });
          const cartItems = cart ? (cart.items as any[]) : [];
          const cartProductIds = cartItems.map(i => i.productId);
          
          const complements = new Set<string>();
          const catalogProvider = new PrismaCatalogProvider(prisma);
          for (const pid of cartProductIds) {
            const related = await catalogProvider.getRelatedProducts(context.merchantId, pid);
            for (const r of related) {
              complements.add(r.id);
            }
          }
          resourceId = Array.from(complements).find(cid => !cartProductIds.includes(cid));
        }

        if (!resourceId) {
          throw new Error('Security Exception: Opportunity does not specify a valid resourceId to accept.');
        }

        // Apply acceptance (mutates DB Log and Cart state)
        await acceptOpportunity(prisma, context.sessionId, opportunity.id, resourceId);

        return {
          success: true,
          message: `Successfully accepted opportunity ${opportunity.id}. Product ${resourceId} added to authoritative cart. You may now proceed to checkout.`
        };
      }
    }
  };
};
