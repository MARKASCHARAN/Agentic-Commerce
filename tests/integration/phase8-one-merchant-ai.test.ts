import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { mcpContextStorage } from '../../src/api/mcp/context.js';
import { createRequestTool } from '../../src/api/mcp/tools/merchant-create-request.tool.js';
import { counterOfferTool } from '../../src/api/mcp/tools/merchant-counter-offer.tool.js';
import { acceptOfferTool } from '../../src/api/mcp/tools/merchant-accept-offer.tool.js';

vi.mock('../../src/providers/razorpay/razorpay.provider.js', () => {
  return {
    RazorpayProvider: class {
      async createPaymentLink() {
        return {
          success: true,
          data: {
            id: 'pay_link_mock_' + Date.now(),
            shortUrl: 'https://rzp.io/i/mock' + Date.now()
          }
        };
      }
    }
  };
});

describe('Phase 8: AI Buyer → ONE Merchant Agent End-to-End', () => {
  const prisma = new PrismaClient();
  let merchantId: string;
  let buyerId: string;
  let sessionId: string;
  let laptopId: string;
  let mouseId: string;
  let bagId: string;
  let offerId: string;

  beforeAll(async () => {
    merchantId = 'merchant-phase8-' + crypto.randomUUID().slice(0, 8);
    buyerId = 'buyer-phase8-' + crypto.randomUUID().slice(0, 8);
    sessionId = 'session-phase8-' + crypto.randomUUID().slice(0, 8);

    await prisma.user.create({
      data: { id: merchantId, email: merchantId + '@example.com' }
    });

    await prisma.merchant.create({
      data: {
        id: merchantId,
        name: 'Phase 8 Merchant',
        userId: merchantId,
        guardrails: {
          create: {
            maxDiscountBps: 1000,
            minimumMarginBps: 1000,
            approvalAboveMinor: 10000000,
            negotiationEnabled: true,
            maxNegotiationRounds: 4,
            crossSellEnabled: true,
            upsellEnabled: true
          }
        }
      }
    });

    const laptop = await prisma.product.create({
      data: {
        id: 'prod-lapt-8-' + crypto.randomUUID().slice(0, 8),
        merchantId,
        name: 'Laptop Pro',
        priceMinor: 9500000,
        currency: 'INR',
        active: true
      }
    });
    laptopId = laptop.id;

    const mouse = await prisma.product.create({
      data: {
        id: 'prod-mous-8-' + crypto.randomUUID().slice(0, 8),
        merchantId,
        name: 'Ergonomic Mouse',
        priceMinor: 200000,
        currency: 'INR',
        active: true
      }
    });
    mouseId = mouse.id;

    const bag = await prisma.product.create({
      data: {
        id: 'prod-bag-8-' + crypto.randomUUID().slice(0, 8),
        merchantId,
        name: 'Laptop Bag',
        priceMinor: 250000,
        currency: 'INR',
        active: true
      }
    });
    bagId = bag.id;

    await prisma.inventory.createMany({
      data: [
        { productId: laptopId, merchantId, quantity: 10 },
        { productId: mouseId, merchantId, quantity: 20 },
        { productId: bagId, merchantId, quantity: 15 }
      ]
    });

    await prisma.session.create({
      data: {
        id: sessionId,
        merchantId,
        state: 'ACTIVE'
      }
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  function runWithContext(fn: () => Promise<any>) {
    return mcpContextStorage.run({
      merchantId,
      buyerId,
      sessionId,
      requestId: 'phase8-req'
    }, fn);
  }

  it('Scene 1 & 2: Merchant & Catalog Provisioned', async () => {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    expect(merchant).toBeDefined();

    const products = await prisma.product.findMany({ where: { merchantId } });
    expect(products.length).toBe(3);
  });

  it('Scene 3 & 4: Buyer AI creates commerce request for Laptop Pro', async () => {
    await runWithContext(async () => {
      const res = await createRequestTool.handler({
        items: [{ productId: laptopId, quantity: 1 }]
      });

      expect(res.isError).toBeFalsy();
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.status).toBe('OFFERED');
      expect(payload.offerId).toBeDefined();
      offerId = payload.offerId;
    });
  });

  it('Scene 5: Negotiation (Counter-offer requested)', async () => {
    await runWithContext(async () => {
      const res = await counterOfferTool.handler({
        offerId,
        targetTotalMinor: 9000000
      });

      expect(res.isError).toBeFalsy();
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.status).toBe('COUNTERED');
      // Max discount is 10% (950,000 minor). Requested is 500,000 minor discount (target 9,000,000 total).
      // Since 500,000 < 950,000, 9,000,000 total is approved!
      expect(payload.approvedTotalMinor).toBe(9000000);
    });
  });

  it('Scene 6 & 7: Accept offer and verify Razorpay Payment Link', async () => {
    await runWithContext(async () => {
      const res = await acceptOfferTool.handler({ offerId });

      expect(res.isError).toBeFalsy();
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.paymentLink).toContain('rzp.io');
      expect(payload.orderId).toBeTruthy();
    });
  });

  it('Scene 8: Verify the exact Agent Decision Audit Timeline', async () => {
    const logs = await prisma.agentDecisionLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' }
    });
    
    const actions = logs.map(l => l.action);
    expect(actions).toContain('BUYER_ACCEPTED');
    expect(actions).toContain('ORDER_CREATED');
    expect(actions).toContain('PAYMENT_LINK_CREATED');
  });

  it('Scene 9 (Safe Failure): Reject offer acceptance if inventory is exhausted', async () => {
    // Exhaust laptop inventory
    await prisma.inventory.update({
      where: { productId: laptopId },
      data: { quantity: 0 }
    });
    
    const newOffer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId: laptopId, quantity: 1, unitPriceMinor: 9500000 }],
        subtotalMinor: 9500000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 9500000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 86400000)
      }
    });

    await runWithContext(async () => {
      const res = await acceptOfferTool.handler({ offerId: newOffer.id });
      expect(res.isError).toBe(true);
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.code).toBe('INVENTORY_UNAVAILABLE');
    });

    const failLog = await prisma.agentDecisionLog.findFirst({
      where: { sessionId, action: 'SAFE_FAILURE' }
    });
    expect(failLog).toBeTruthy();
    expect(failLog!.reasoning).toContain(`Insufficient inventory for product ${laptopId}`);
  });
});
