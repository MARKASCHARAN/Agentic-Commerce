import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';

const prisma = new PrismaClient();

export const getOfferTool = {
  name: 'merchant.get_offer',
  description: 'Retrieve the authoritative state of a specific offer.',
  schema: {
    offerId: z.string().describe('The ID of the offer to retrieve.')
  },
  handler: async ({ offerId }: { offerId: string }) => {
    try {
      const ctx = getMcpContext();
      
      const offer = await prisma.offer.findUnique({
        where: { id: offerId }
      });

      if (!offer) {
        throw new Error('Offer not found');
      }

      // Context isolation: enforce merchant and buyer ownership
      if (offer.merchantId !== ctx.merchantId || offer.buyerId !== ctx.buyerId) {
        throw new Error('Unauthorized: Offer belongs to a different context');
      }

      return {
        content: [{ type: "text", text: JSON.stringify(offer, null, 2) }]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: "OFFER_RETRIEVAL_FAILED", message: e.message }) }] };
    }
  }
};
