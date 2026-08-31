import { z } from 'zod';
import { Tool } from '../types';
import { PrismaClient } from '@prisma/client';
import { rejectOpportunity } from '../../cart/cart-state';
import { PrismaCatalogProvider } from '../../../catalog/prisma-catalog.provider';

export const createOpportunityRejectTool = (
  prisma: PrismaClient
): Tool<z.infer<typeof rejectSchema>, any> => {
  const rejectSchema = z.object({
    opportunityId: z.string().describe('The ID of the PROPOSED revenue opportunity to reject'),
  });

  return {
    metadata: {
      id: 'opportunity.reject' as any,
      name: 'Reject Opportunity',
      description: 'Rejects a proposed revenue opportunity, permanently excluding the corresponding product from being proposed again in this session.',
      version: '1.0.0'
    },
    inputSchema: rejectSchema,
    outputSchema: z.any(),
    requiredCapabilities: ['checkout.create'], // Ties to the ability to mutate cart/checkout state
    policy: { id: 'financial-policy' },
    idempotency: { required: true, scope: 'opportunity' },
    adapter: {
      type: 'in-process',
      execute: async (input, context) => {
        if (!context.merchantId) {
          throw new Error('Merchant ID is required to reject an opportunity');
        }
        if (!context.sessionId) {
          throw new Error('Session ID is required to reject an opportunity');
        }

        const opportunity = await prisma.revenueOpportunityLog.findFirst({
          where: {
            id: input.opportunityId,
            merchantId: context.merchantId,
            sessionId: context.sessionId,
            status: 'PROPOSED'
          }
        });

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
          throw new Error('Security Exception: Opportunity does not specify a valid resourceId to reject.');
        }

        // Apply rejection (mutates DB Log and Cart state)
        await rejectOpportunity(prisma, context.sessionId, opportunity.id, resourceId);

        return {
          success: true,
          message: `Successfully rejected opportunity ${opportunity.id}. Product ${resourceId} added to rejected list.`
        };
      }
    }
  };
};
