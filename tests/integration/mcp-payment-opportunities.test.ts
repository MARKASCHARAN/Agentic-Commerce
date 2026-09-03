import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getOrderTool } from '../../src/api/mcp/tools/merchant-get-order.tool';
import { checkOpportunitiesTool } from '../../src/api/mcp/tools/merchant-check-opportunities.tool';
import { mcpContextStorage } from '../../src/api/mcp/context';

const prisma = new PrismaClient();

describe('Payment Verification & Revenue Opportunities', () => {
  let merchantId: string;
  const buyerId = 'test-buyer-id';
  const sessionId = 'test-mcp-session';
  let laptopId: string;
  let bagId: string;
  let mouseId: string;

  beforeEach(async () => {
    // Teardown in dependency order
    await prisma.revenueOpportunityLog.deleteMany();
    await prisma.message.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.commerceItem.deleteMany();
    await prisma.paymentIntent.deleteMany();
    await prisma.commerceOrder.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.merchantGuardrail.deleteMany();
    await prisma.merchantStrategy.deleteMany();
    await prisma.agentDecisionLog.deleteMany();
    await prisma.offer.deleteMany();
    await prisma.event.deleteMany();
    await prisma.skillExecution.deleteMany();
    await prisma.toolCall.deleteMany();
    await prisma.session.deleteMany();
    await prisma.product.deleteMany();
    await prisma.merchantCapability.deleteMany();
    await prisma.merchant.deleteMany();
    await prisma.user.deleteMany();

    // Create Merchant
    const merchant = await prisma.merchant.create({
      data: {
        id: 'merchant-test',
        name: 'Test Merchant',
        user: {
          create: {
            id: 'user-test',
            email: 'test@merchant.com',
            name: 'Test User'
          }
        },
        capabilities: {
          create: [
            { capability: 'catalog' },
            { capability: 'inventory' },
            { capability: 'checkout' }
          ]
        },
        guardrails: {
          create: {
            maxDiscountBps: 1000,
            minimumMarginBps: 1000,
            approvalAboveMinor: 10000000,
            crossSellEnabled: true,
            upsellEnabled: true
          }
        }
      }
    });
    merchantId = merchant.id;

    // Create a Session (required FK for CommerceOrder)
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: 'user-test',
        merchantId,
        state: 'ACTIVE'
      }
    });

    // Create Products
    const bag = await prisma.product.create({
      data: {
        merchantId,
        name: 'Laptop Bag',
        description: 'Luxury protection for 15-inch laptops.',
        priceMinor: 500000,
        currency: 'INR',
        active: true
      }
    });
    bagId = bag.id;

    const mouse = await prisma.product.create({
      data: {
        merchantId,
        name: 'Ergonomic Wireless Mouse',
        description: 'Long battery life, smooth tracking.',
        priceMinor: 250000,
        currency: 'INR',
        active: true
      }
    });
    mouseId = mouse.id;

    // Laptop has related products in its description via rel tags
    const laptop = await prisma.product.create({
      data: {
        merchantId,
        name: 'Laptop Pro',
        description: `High Performance Laptop. <!-- rel: ["${bagId}", "${mouseId}"] -->`,
        priceMinor: 9500000,
        currency: 'INR',
        active: true
      }
    });
    laptopId = laptop.id;
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

  describe('Payment Verification (merchant.get_order)', () => {
    it('A. User says "payment done" while order is PAYMENT_REQUIRED -> must NOT return PAID/COMPLETED', async () => {
      // Create an unpaid order (CommerceOrder has no currency field)
      const order = await prisma.commerceOrder.create({
        data: {
          id: 'order-unpaid',
          merchantId,
          buyerId,
          sessionId,
          status: 'PAYMENT_REQUIRED',
          total: 9500000
        }
      });

      await runWithContext(async () => {
        const result = await getOrderTool.handler({ orderId: order.id });
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse((result.content[0] as any).text);
        expect(payload.success).toBe(true);
        expect(payload.status).toBe('PAYMENT_REQUIRED');
        expect(payload.status).not.toBe('PAID');
        expect(payload.status).not.toBe('COMPLETED');
      });
    });

    it('B. Verified backend order status is PAID -> payment can be reported as completed', async () => {
      // Create a paid order
      const order = await prisma.commerceOrder.create({
        data: {
          id: 'order-paid',
          merchantId,
          buyerId,
          sessionId,
          status: 'PAID',
          total: 9500000
        }
      });

      await runWithContext(async () => {
        const result = await getOrderTool.handler({ orderId: order.id });
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse((result.content[0] as any).text);
        expect(payload.success).toBe(true);
        expect(payload.status).toBe('PAID');
      });
    });

    it('C. get_order tool failure -> MCP returns deterministic failure and no successful payment claim is possible', async () => {
      await runWithContext(async () => {
        const result = await getOrderTool.handler({ orderId: 'nonexistent-order-id' });
        // Application-level not-found returns structured JSON, not isError
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse((result.content[0] as any).text);
        expect(payload.success).toBe(false);
        expect(payload.code).toBe('ORDER_NOT_FOUND');
      });
    });
  });

  describe('Revenue Opportunities (merchant.check_opportunities)', () => {
    it('D. RevenueEngine returns a real qualifying cross-sell/upsell opportunity for Laptop', async () => {
      // Seed an offer with the laptop so check_opportunities finds it
      await prisma.offer.create({
        data: {
          id: 'offer-laptop',
          merchantId,
          buyerId,
          sessionId,
          status: 'OFFERED',
          subtotalMinor: 9500000,
          discountMinor: 0,
          shippingMinor: 0,
          totalMinor: 9500000,
          currency: 'INR',
          expiresAt: new Date(Date.now() + 86400000),
          items: [{ productId: laptopId, quantity: 1, unitPriceMinor: 9500000, originalUnitPriceMinor: 9500000 }]
        }
      });

      await runWithContext(async () => {
        const result = await checkOpportunitiesTool.handler({});
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse((result.content[0] as any).text);

        expect(payload.type).toBe('CROSS_SELL');
        expect(payload.description).toContain('pairs well with Laptop Bag');
        expect(payload.suggestedProductId).toBe(bagId);
        expect(payload.suggestedPriceMinor).toBe(500000);
      });
    });

    it('E. No qualifying opportunity for Laptop Bag -> returns an explicit empty opportunity result', async () => {
      // Seed an offer with only the laptop bag (no rel tags in its description)
      await prisma.offer.create({
        data: {
          id: 'offer-bag',
          merchantId,
          buyerId,
          sessionId,
          status: 'OFFERED',
          subtotalMinor: 500000,
          discountMinor: 0,
          shippingMinor: 0,
          totalMinor: 500000,
          currency: 'INR',
          expiresAt: new Date(Date.now() + 86400000),
          items: [{ productId: bagId, quantity: 1, unitPriceMinor: 500000, originalUnitPriceMinor: 500000 }]
        }
      });

      await runWithContext(async () => {
        const result = await checkOpportunitiesTool.handler({});
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse((result.content[0] as any).text);

        expect(payload.message).toBe('No active opportunities.');
      });
    });
  });
});
