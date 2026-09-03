import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createRequestTool } from '../../src/api/mcp/tools/merchant-create-request.tool';
import { mcpContextStorage } from '../../src/api/mcp/context';
import { ProtocolEngine } from '../../src/agent/protocol/protocol-engine';
import { PricingService } from '../../src/agent/intelligence/pricing-service';
import { RazorpayProvider } from '../../src/providers/razorpay/razorpay.provider';
import { DecisionLogger } from '../../src/agent/audit/decision-logger';

const prisma = new PrismaClient();

describe('merchant.create_request tool', () => {
  let merchantId: string;
  let buyerId = 'test-buyer-id';
  let sessionId = 'test-mcp-session';
  let laptopProId: string;
  let laptopBagId: string;

  beforeEach(async () => {
    await prisma.refund.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.revenueOpportunityLog.deleteMany();
    await prisma.message.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.commerceItem.deleteMany();
    await prisma.commerceOrder.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.merchantGuardrail.deleteMany();
    await prisma.merchantStrategy.deleteMany();
    await prisma.agentDecisionLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.product.deleteMany();
    await prisma.merchantCapability.deleteMany();
    await prisma.merchant.deleteMany();
    await prisma.user.deleteMany();

    const merchant = await prisma.merchant.create({
      data: {
        id: 'merchant-test',
        name: 'Test Merchant',
        user: {
          create: {
            id: 'user-merchant-test',
            email: 'test@merchant.com',
            name: 'Test User'
          }
        }
      }
    });
    merchantId = merchant.id;

    const laptopPro = await prisma.product.create({
      data: {
        merchantId,
        name: 'Laptop Pro',
        priceMinor: 9500000,
        currency: 'INR',
        active: true,
        inventory: { create: { merchantId, quantity: 50 } }
      }
    });
    laptopProId = laptopPro.id;

    const laptopBag = await prisma.product.create({
      data: {
        merchantId,
        name: 'Laptop Bag',
        priceMinor: 250000,
        currency: 'INR',
        active: true,
        inventory: { create: { merchantId, quantity: 100 } }
      }
    });
    laptopBagId = laptopBag.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  function runWithContext(fn: () => Promise<any>) {
    return mcpContextStorage.run({
      merchantId,
      buyerId,
      sessionId,
      requestId: 'test-req'
    }, fn);
  }

  it('A. Laptop Bag x 2 -> exactly Laptop Bag x 2 -> correct DB price & subtotal', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: laptopBagId, quantity: 2 }]
      });

      expect(result.isError).toBeFalsy();
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.offer.items).toHaveLength(1);
      expect(payload.offer.items[0].productId).toBe(laptopBagId);
      expect(payload.offer.items[0].quantity).toBe(2);
      expect(payload.offer.items[0].unitPriceMinor).toBe(250000);
      expect(payload.offer.subtotalMinor).toBe(500000);
    });
  });

  it('B. Laptop Pro x 2 -> exactly Laptop Pro x 2', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: laptopProId, quantity: 2 }]
      });

      expect(result.isError).toBeFalsy();
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.offer.items).toHaveLength(1);
      expect(payload.offer.items[0].productId).toBe(laptopProId);
      expect(payload.offer.items[0].quantity).toBe(2);
      expect(payload.offer.items[0].unitPriceMinor).toBe(9500000);
      expect(payload.offer.subtotalMinor).toBe(19000000);
    });
  });

  it('C. Multiple products -> each requested product and quantity preserved', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [
          { productId: laptopProId, quantity: 1 },
          { productId: laptopBagId, quantity: 3 }
        ]
      });

      expect(result.isError).toBeFalsy();
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.offer.items).toHaveLength(2);
      
      const pro = payload.offer.items.find((i: any) => i.productId === laptopProId);
      expect(pro.quantity).toBe(1);
      
      const bag = payload.offer.items.find((i: any) => i.productId === laptopBagId);
      expect(bag.quantity).toBe(3);

      expect(payload.offer.subtotalMinor).toBe(9500000 + (250000 * 3));
    });
  });

  it('D. Unknown productId -> deterministic product-not-found error', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: 'fake-id', quantity: 1 }]
      });

      expect(result.isError).toBe(true);
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.code).toBe('CREATE_REQUEST_FAILED');
      expect(payload.message).toContain('Product not found');
    });
  });

  it('E. Product belonging to another merchant -> authorization error', async () => {
    const otherMerchant = await prisma.merchant.create({
      data: { 
        id: 'other-merchant', 
        name: 'Other',
        user: {
          create: {
            id: 'other-user',
            email: 'other@merchant.com',
            name: 'Other User'
          }
        }
      }
    });
    const otherProduct = await prisma.product.create({
      data: { merchantId: otherMerchant.id, name: 'Other Prod', priceMinor: 100, currency: 'INR', active: true, inventory: { create: { merchantId: otherMerchant.id, quantity: 10 } } }
    });

    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: otherProduct.id, quantity: 1 }]
      });

      expect(result.isError).toBe(true);
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.message).toContain('does not belong to the requested merchant');
    });
  });

  it('F. Schema validation for zero quantity is handled by Zod outside handler', () => {
    const parseResZero = createRequestTool.schema.items.safeParse([{ productId: laptopBagId, quantity: 0 }]);
    expect(parseResZero.success).toBe(false);
  });

  it('G. Schema validation for negative quantity is handled by Zod outside handler', () => {
    const parseResNeg = createRequestTool.schema.items.safeParse([{ productId: laptopBagId, quantity: -1 }]);
    expect(parseResNeg.success).toBe(false);
  });

  it('H. Insufficient inventory -> INVENTORY_UNAVAILABLE and no offer created', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: laptopProId, quantity: 999 }]
      });

      expect(result.isError).toBe(true);
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.code).toBe('INVENTORY_UNAVAILABLE');
      
      const orders = await prisma.commerceOrder.findMany({ where: { sessionId } });
      expect(orders).toHaveLength(0);
    });
  });

  it('I. Attempt to provide a price from the AI is rejected/ignored by schema', () => {
    return runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: laptopBagId, quantity: 1, unitPriceMinor: 1 } as any]
      });

      expect(result.isError).toBeFalsy();
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.offer.subtotalMinor).toBe(250000); // Uses DB price, ignores 1
    });
  });

  it('J. Regression test: Request Laptop Bag x 2 must NEVER produce Laptop Pro x 10', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: laptopBagId, quantity: 2 }]
      });

      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.offer.items[0].productId).not.toBe(laptopProId);
      expect(payload.offer.items[0].quantity).not.toBe(10);
    });
  });
});
