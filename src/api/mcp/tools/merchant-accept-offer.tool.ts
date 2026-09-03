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

export const acceptOfferTool = {
  name: 'merchant.accept_offer',
  description: 'Accept an existing merchant-generated offer.\\n\\nIMPORTANT:\\n- The offer amount is authoritative.\\n- Do not accept or calculate an amount.\\n- Do not modify price.\\n- Do not provide product IDs or quantities.\\n- Do not bypass merchant policy.\\n- The backend determines the final transaction amount.\\n- This action may create a Razorpay payment transaction.\\n\\nOnly report facts returned by the merchant backend. Never infer: warranty, shipping, delivery time, return policy, product quality, availability, taxes, fees, or payment status unless the tool response explicitly provides them.\\n\\n[readOnlyHint: false, destructiveHint: false, idempotentHint: false]',
  schema: {
    offerId: z.string().describe('The ID of the offer to accept.'),
    buyerEmail: z.string().email().optional().describe('Buyer email address for payment receipt delivery.')
    // Notice: We do NOT accept an `amount` parameter here. The backend is authoritative.
  },
  handler: async ({ offerId, buyerEmail }: { offerId: string, buyerEmail?: string }) => {
    try {
      const ctx = getMcpContext();

      const existingOffer = await prisma.offer.findUnique({ where: { id: offerId } });
      if (!existingOffer) throw new Error('Offer not found');
      if (existingOffer.merchantId !== ctx.merchantId || existingOffer.buyerId !== ctx.buyerId) {
        throw new Error('Unauthorized');
      }

      const result = await protocolEngine.acceptOffer(offerId, ctx.buyerId, buyerEmail);

      return {
        content: [{ type: "text", text: JSON.stringify({
          status: 'PAYMENT_REQUIRED',
          orderId: result.orderId,
          amountMinor: result.offer.totalMinor,
          currency: result.offer.currency,
          paymentProvider: 'razorpay',
          paymentLink: result.paymentUrl,
          notifications: {
            email: 'SENT',
            sms: 'SENT'
          }
        }, null, 2) }]
      };
    } catch (e: any) {
      // Structure domain failures
      let code = 'ACCEPT_OFFER_FAILED';
      if (e.message.includes('expired')) code = 'OFFER_EXPIRED';
      if (e.message.includes('already accepted') || e.message.includes('not in OFFERED')) code = 'INVALID_STATE_TRANSITION';
      if (e.message.includes('inventory')) code = 'INVENTORY_UNAVAILABLE';
      
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code, message: e.message }) }] };
    }
  }
};
