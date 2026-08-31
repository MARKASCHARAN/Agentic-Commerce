import { PrismaClient } from '@prisma/client';
import { PricingService, PricingItem } from '../intelligence/pricing-service.js';
import { PaymentProvider } from '../payments/provider.js';

export class ProtocolEngine {
  constructor(
    private prisma: PrismaClient,
    private pricingService: PricingService,
    private paymentProvider: PaymentProvider
  ) {}

  async createOffer(merchantId: string, buyerId: string, sessionId: string, items: PricingItem[], requestedDiscountMinor: number = 0) {
    const pricingResult = await this.pricingService.calculatePrice(merchantId, items, requestedDiscountMinor);

    const offer = await this.prisma.offer.create({
      data: {
        merchantId,
        buyerId,
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

  async acceptOffer(offerId: string, buyerId: string) {
    // We use a transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
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
        notes: {
          merchantId: offer.merchantId,
          sessionId: offer.sessionId,
          receipt: order.id,
          offerId: offer.id
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

      // Update offer to PAYMENT_PENDING and store references
      const finalOffer = await tx.offer.update({
        where: { id: offerId },
        data: { 
          status: 'PAYMENT_PENDING',
          orderId: order.id,
          paymentUrl: providerLink.data.shortUrl,
          updatedAt: new Date()
        }
      });

      return {
        offer: finalOffer,
        orderId: order.id,
        paymentUrl: providerLink.data.shortUrl
      };
    });
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
