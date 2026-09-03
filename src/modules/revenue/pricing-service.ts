import { PrismaClient } from '@prisma/client';

export interface PricingItem {
  productId: string;
  quantity: number;
}

export interface PricingResult {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  items: {
    productId: string;
    quantity: number;
    unitPriceMinor: number;
    originalUnitPriceMinor: number;
  }[];
}

export class PricingService {
  constructor(private prisma: PrismaClient) {}

  async calculatePrice(merchantId: string, items: PricingItem[], requestedDiscountMinor: number = 0, currency: string = 'INR'): Promise<PricingResult> {
    let subtotalMinor = 0;
    const pricedItems = [];

    // 1. Calculate subtotal
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product || product.merchantId !== merchantId) {
        throw new Error(`Product ${item.productId} not found or doesn't belong to merchant ${merchantId}`);
      }

      const unitPriceMinor = product.priceMinor;
      subtotalMinor += unitPriceMinor * item.quantity;

      pricedItems.push({
        productId: product.id,
        quantity: item.quantity,
        originalUnitPriceMinor: unitPriceMinor,
        unitPriceMinor: unitPriceMinor
      });
    }

    // Evaluate merchant maximum discount guardrails
    const guardrail = await this.prisma.merchantGuardrail.findUnique({
      where: { merchantId }
    });

    let maxDiscountPercent = 15; // default 15%
    if (guardrail && guardrail.maxDiscountBps) {
      maxDiscountPercent = guardrail.maxDiscountBps / 100;
    }

    const maxDiscountMinor = Math.floor(subtotalMinor * (maxDiscountPercent / 100));
    
    let discountMinor = requestedDiscountMinor;
    if (discountMinor > maxDiscountMinor) {
      console.warn(`[PricingService] Requested discount ${discountMinor} exceeds maximum allowed ${maxDiscountMinor}. Capping discount.`);
      discountMinor = maxDiscountMinor; // Cap the discount
    }

    // Distribute discount across items for accurate unit pricing (pro-rata)
    if (discountMinor > 0) {
      let remainingDiscount = discountMinor;
      for (let i = 0; i < pricedItems.length; i++) {
        const itemLineTotal = pricedItems[i].originalUnitPriceMinor * pricedItems[i].quantity;
        const itemDiscount = i === pricedItems.length - 1 
          ? remainingDiscount // Give the rest to the last item
          : Math.floor((itemLineTotal / subtotalMinor) * discountMinor);
        
        pricedItems[i].unitPriceMinor = pricedItems[i].originalUnitPriceMinor - Math.floor(itemDiscount / pricedItems[i].quantity);
        remainingDiscount -= itemDiscount;
      }
    }

    // 3. Shipping (flat rate for now, or 0 if over a certain amount)
    let shippingMinor = 0;
    if (subtotalMinor - discountMinor < 50000) {
      shippingMinor = 0; // Free shipping for everything in demo
    }

    const totalMinor = subtotalMinor - discountMinor + shippingMinor;

    return {
      subtotalMinor,
      discountMinor,
      shippingMinor,
      totalMinor,
      currency,
      items: pricedItems
    };
  }
}
