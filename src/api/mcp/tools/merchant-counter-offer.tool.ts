import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getMcpContext } from '../context.js';
import { ProtocolEngine } from '../../../agent/protocol/protocol-engine.js';
import { PricingService } from '../../../agent/intelligence/pricing-service.js';
import { RazorpayProvider } from '../../../providers/razorpay/razorpay.provider.js';
import { DecisionLogger } from '../../../agent/audit/decision-logger.js';
import { env } from '../../../config/env.js';

const prisma = new PrismaClient();
const decisionLogger = new DecisionLogger(prisma);
const pricingService = new PricingService(prisma);
const paymentProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');
const protocolEngine = new ProtocolEngine(prisma, pricingService, paymentProvider, decisionLogger);

export const counterOfferTool = {
  name: 'merchant.counter_offer',
  description: 'Request a counter-offer against an existing offer.\\n\\nIMPORTANT:\\n- targetTotalMinor is a buyer request only.\\n- It is NOT an instruction to charge that amount.\\n- The merchant PricingService determines the authoritative price.\\n- Merchant guardrails always override this request.',
  schema: {
    offerId: z.string().describe('The ID of the offer being negotiated.'),
    targetTotalMinor: z.number().describe('The target total amount in minor units requested by the buyer.')
  },
  handler: async ({ offerId, targetTotalMinor }: { offerId: string, targetTotalMinor: number }) => {
    try {
      const ctx = getMcpContext();

      const existingOffer = await prisma.offer.findUnique({ where: { id: offerId } });
      if (!existingOffer) throw new Error('Offer not found');
      if (existingOffer.merchantId !== ctx.merchantId || existingOffer.buyerId !== ctx.buyerId) {
        throw new Error('Unauthorized');
      }

      const offer = await protocolEngine.counterOffer(offerId, ctx.merchantId, targetTotalMinor);

      return {
        content: [{ type: "text", text: JSON.stringify({
          status: offer.status,
          requestedTotalMinor: targetTotalMinor,
          approvedTotalMinor: offer.totalMinor,
          discountMinor: offer.discountMinor,
          message: offer.totalMinor > targetTotalMinor 
            ? "Counter-offer adjusted due to merchant guardrails." 
            : "Counter-offer accepted."
        }, null, 2) }]
      };
    } catch (e: any) {
      const code = e.message.includes('Limit Exceeded') || e.message.includes('guardrail') 
        ? 'NEGOTIATION_LIMIT_EXCEEDED' 
        : 'COUNTER_OFFER_FAILED';
        
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ code, message: e.message }) }] };
    }
  }
};
