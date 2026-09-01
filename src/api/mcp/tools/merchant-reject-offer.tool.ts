import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';

const prisma = new PrismaClient();

export const rejectOfferTool = {
  name: 'merchant.reject_offer',
  description: 'Reject a currently valid merchant offer. This transitions the offer state to REJECTED.',
  schema: {
    offerId: z.string().describe('The ID of the offer to reject.')
  },
  handler: async ({ offerId }: { offerId: string }) => {
    try {
      const ctx = getMcpContext();

      const existingOffer = await prisma.offer.findUnique({ where: { id: offerId } });
      if (!existingOffer) throw new Error('Offer not found');
      if (existingOffer.merchantId !== ctx.merchantId || existingOffer.buyerId !== ctx.buyerId) {
        throw new Error('Unauthorized');
      }

      if (['ACCEPTED', 'PAID', 'EXPIRED', 'REJECTED'].includes(existingOffer.status)) {
        throw new Error(`Cannot reject offer in state ${existingOffer.status}`);
      }

      const offer = await prisma.offer.update({
        where: { id: offerId },
        data: { status: 'REJECTED' }
      });

      return {
        content: [{ type: "text", text: JSON.stringify({
          status: offer.status,
          message: 'Offer successfully rejected.'
        }, null, 2) }]
      };
    } catch (e: any) {
      let code = 'REJECT_OFFER_FAILED';
      if (e.message.includes('state')) code = 'INVALID_STATE_TRANSITION';
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code, message: e.message }) }] };
    }
  }
};
