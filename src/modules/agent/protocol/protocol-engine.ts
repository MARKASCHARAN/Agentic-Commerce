import { PrismaClient } from '@prisma/client';
import { PricingService, PricingItem } from '../../revenue/pricing-service.js';
import { PaymentProvider } from '../../payment/provider.js';
import { DecisionLogger } from '../../audit/decision-logger.js';
import { PaymentLinkEmailService } from '../../payment/email.service.js';

export class ProtocolEngine {
  private emailService: PaymentLinkEmailService;

  constructor(
    private prisma: PrismaClient,
    private pricingService: PricingService,
    private paymentProvider: PaymentProvider,
    private decisionLogger?: DecisionLogger
  ) {
    this.emailService = new PaymentLinkEmailService(prisma);
  }

  async createOffer(merchantId: string, buyerId: string, sessionId: string, items: PricingItem[], requestedDiscountMinor: number = 0, buyerEmail?: string) {
    const pricingResult = await this.pricingService.calculatePrice(merchantId, items, requestedDiscountMinor);

    const offer = await this.prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        buyerEmail,
        sessionId,
        items: pricingResult.items as any,
        subtotalMinor: pricingResult.subtotalMinor,
        discountMinor: pricingResult.discountMinor,
        shippingMinor: pricingResult.shippingMinor,
        totalMinor: pricingResult.totalMinor,
        currency: pricingResult.currency,
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours expiry
      }
    });

    return offer;
  }

  async counterOffer(offerId: string, merchantId: string, targetTotalMinor: number) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, merchantId, status: { in: ['OFFERED', 'COUNTERED'] } }
    });

    if (!offer) {
      throw new Error('Offer not found or not in a negotiable state');
    }

    if (new Date() > offer.expiresAt) {
      throw new Error('Offer has expired');
    }

    const guardrail = await this.prisma.merchantGuardrail.findUnique({
      where: { merchantId }
    });

    if (guardrail) {
      if (!guardrail.negotiationEnabled) {
        throw new Error('Negotiation is not enabled for this merchant');
      }
      if (offer.negotiationRounds >= guardrail.maxNegotiationRounds) {
        throw new Error(`Maximum negotiation rounds (${guardrail.maxNegotiationRounds}) exceeded`);
      }
    }

    const requestedDiscount = offer.subtotalMinor - targetTotalMinor;
    if (requestedDiscount < 0) {
      throw new Error('Target total cannot be greater than subtotal in a counter-offer');
    }

    const items = offer.items as unknown as PricingItem[];
    const pricingResult = await this.pricingService.calculatePrice(merchantId, items, requestedDiscount, offer.currency);

    const updatedOffer = await this.prisma.offer.update({
      where: { id: offerId },
      data: {
        items: pricingResult.items as any,
        subtotalMinor: pricingResult.subtotalMinor,
        discountMinor: pricingResult.discountMinor,
        shippingMinor: pricingResult.shippingMinor,
        totalMinor: pricingResult.totalMinor,
        status: 'COUNTERED',
        negotiationRounds: offer.negotiationRounds + 1,
        updatedAt: new Date()
      }
    });

    return updatedOffer;
  }

  async acceptOffer(offerId: string, buyerId: string, buyerEmail?: string) {
    // We use a transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findFirst({
        where: { id: offerId, buyerId }
      });

      if (!offer) {
        throw new Error('Offer not found');
      }

      if (offer.status !== 'OFFERED' && offer.status !== 'COUNTERED' && offer.status !== 'PAYMENT_PENDING') {
        throw new Error(`Cannot accept offer in state ${offer.status}`);
      }

      if (offer.status === 'PAYMENT_PENDING') {
        if (!offer.orderId || !offer.paymentUrl) {
          throw new Error('Offer is PAYMENT_PENDING but missing order or payment url');
        }
        return {
          offer,
          orderId: offer.orderId,
          paymentUrl: offer.paymentUrl
        };
      }

      if (new Date() > offer.expiresAt) {
        throw new Error('Offer has expired');
      }

      // Atomic decrement and validation
      const items = offer.items as unknown as { productId: string, quantity: number, unitPriceMinor: number }[];
      for (const item of items) {
        const updatedInventory = await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { decrement: item.quantity } }
        });
        if (updatedInventory.quantity < 0) {
          if (this.decisionLogger) {
            await this.decisionLogger.log({
              sessionId: offer.sessionId,
              merchantId: offer.merchantId,
              action: 'SAFE_FAILURE',
              reasoning: `Insufficient inventory for product ${item.productId}`,
              metadata: { productId: item.productId, requestedQuantity: item.quantity }
            });
          }
          throw new Error(`Insufficient inventory for product ${item.productId}`);
        }
      }

      // Create CommerceOrder
      const order = await tx.commerceOrder.create({
        data: {
          merchantId: offer.merchantId,
          sessionId: offer.sessionId,
          total: offer.totalMinor / 100,
          status: 'created',
          items: {
            create: items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.unitPriceMinor / 100
            }))
          }
        },
        include: { items: true }
      });

      // Generate Payment Link
      const providerLink = await this.paymentProvider.createPaymentLink({
        amount: offer.totalMinor,
        currency: offer.currency,
        referenceId: order.id,
        description: `Order ${order.id}`,
        customerName: 'Demo Buyer',
        customerEmail: buyerEmail || 'buyer@example.com',
        customerContact: '9876543210',
        notes: {
          merchantId: offer.merchantId,
          sessionId: offer.sessionId,
          receipt: order.id,
          offerId: offer.id,
          buyerEmail: buyerEmail || ''
        }
      }, `accept_${offer.id}`);

      if (!providerLink.success || !providerLink.data) {
        throw new Error('Failed to generate payment link');
      }

      // Create PaymentIntent
      await tx.paymentIntent.create({
        data: {
          orderId: order.id,
          amount: offer.totalMinor,
          status: 'created',
          idempotency_key: `accept_${offer.id}`
        }
      });

      // Ensure we always return a payment URL
      const paymentUrl = providerLink.data?.shortUrl;
      if (!paymentUrl) {
        throw new Error('Payment provider did not return a valid shortUrl');
      }

      // Update offer to PAYMENT_PENDING and store references
      const finalOffer = await tx.offer.update({
        where: { id: offerId },
        data: { 
          status: 'PAYMENT_PENDING',
          orderId: order.id,
          paymentUrl: paymentUrl,
          updatedAt: new Date()
        }
      });

      if (this.decisionLogger) {
        await this.decisionLogger.log({
          sessionId: offer.sessionId,
          merchantId: offer.merchantId,
          action: 'BUYER_ACCEPTED',
          reasoning: `Buyer accepted offer for ${offer.totalMinor / 100}`,
          metadata: { offerId: offer.id }
        });
        await this.decisionLogger.log({
          sessionId: offer.sessionId,
          merchantId: offer.merchantId,
          action: 'ORDER_CREATED',
          reasoning: `Created order ${order.id} and reserved inventory atomically`,
          metadata: { orderId: order.id }
        });
        await this.decisionLogger.log({
          sessionId: offer.sessionId,
          merchantId: offer.merchantId,
          action: 'PAYMENT_LINK_CREATED',
          reasoning: `Generated Razorpay link for order ${order.id}`,
          metadata: { url: providerLink.data.shortUrl }
        });
      }

      return {
        offer: finalOffer,
        orderId: order.id,
        paymentUrl: providerLink.data.shortUrl
      };
    });

    // Send email outside the transaction to avoid blocking it
    const finalBuyerEmail = buyerEmail || result.offer.buyerEmail;
    if (finalBuyerEmail) {
      try {
        await this.emailService.sendPaymentRequiredEmail(
          offerId, 
          finalBuyerEmail, 
          result.paymentUrl, 
          result.offer.totalMinor, 
          result.offer.currency
        );
      } catch (e) {
        console.error(`[ProtocolEngine] Failed to send email for offer ${offerId}`, e);
      }
    }

    return result;
  }

  async rejectOffer(offerId: string, buyerId: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, buyerId }
    });

    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.status !== 'OFFERED' && offer.status !== 'COUNTERED') {
      throw new Error(`Cannot reject offer in state ${offer.status}`);
    }

    return this.prisma.offer.update({
      where: { id: offerId },
      data: { status: 'REJECTED', updatedAt: new Date() }
    });
  }
}
