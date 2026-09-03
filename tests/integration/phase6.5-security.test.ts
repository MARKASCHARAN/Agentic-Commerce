import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { mcpContextStorage } from '../../src/api/mcp/context.js';
import { counterOfferTool } from '../../src/api/mcp/tools/merchant-counter-offer.tool.js';
import { acceptOfferTool } from '../../src/api/mcp/tools/merchant-accept-offer.tool.js';
import { DecisionLogger } from '../../src/agent/audit/decision-logger.js';

vi.mock('../../src/providers/razorpay/razorpay.provider.js', () => {
  return {
    RazorpayProvider: class {
      async createPaymentLink() {
        return {
          success: true,
          data: {
            providerId: 'plink_mock',
            shortUrl: 'https://rzp.io/mock',
            amount: 1000000,
            currency: 'INR',
            status: 'created'
          }
        };
      }
    }
  };
});

const prisma = new PrismaClient();

describe('Phase 6.5: Security & Hardening', () => {
  let merchantId: string;
  let buyerId: string;
  let sessionId: string;
  let productId: string;
  let offerId: string;

  beforeAll(async () => {
    merchantId = 'merchant-security-test-' + crypto.randomUUID().slice(0, 8);
    buyerId = 'buyer-security-test-' + crypto.randomUUID().slice(0, 8);
    sessionId = 'session-security-test-' + crypto.randomUUID().slice(0, 8);

    await prisma.user.create({
      data: { id: merchantId, email: merchantId + '@example.com' }
    });

    await prisma.merchant.create({
      data: {
        id: merchantId,
        name: 'Security Test Merchant',
        userId: merchantId,
        guardrails: {
          create: {
            maxDiscountBps: 1500, // 15%
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

    const product = await prisma.product.create({
      data: {
        id: 'prod-security-' + crypto.randomUUID().slice(0, 8),
        merchantId,
        name: 'Secure Laptop',
        priceMinor: 100000,
        currency: 'INR'
      }
    });
    productId = product.id;

    await prisma.inventory.create({
      data: {
        productId,
        merchantId,
        quantity: 15
      }
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

  function runWithContext(buyer: string, fn: () => Promise<any>) {
    return mcpContextStorage.run({
      merchantId,
      buyerId: buyer,
      sessionId,
      requestId: 'security-req'
    }, fn);
  }

  it('1. Create offer', async () => {
    const offer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId, quantity: 10, unitPriceMinor: 100000 }],
        subtotalMinor: 1000000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 1000000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 10000)
      }
    });
    offerId = offer.id;
    expect(offer).toBeDefined();
  });

  it('2. Malicious counter-offer with targetTotalMinor = 1 should fail due to guardrails', async () => {
    await runWithContext(buyerId, async () => {
      const res = await counterOfferTool.handler({ offerId, targetTotalMinor: 1 });
      expect(res.isError).toBeFalsy();
      const payload = JSON.parse((res.content[0] as any).text);
      // Guardrail max discount is 15%. So requested discount is capped to 150,000. Total = 850,000
      expect(payload.approvedTotalMinor).toBe(850000);
    });
  });

  it('3. Accept offer and verify inventory is deducted', async () => {
    await runWithContext(buyerId, async () => {
      const res = await acceptOfferTool.handler({ offerId });
      expect(res.isError).toBeFalsy();
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.paymentLink).toBeDefined();

      const inventory = await prisma.inventory.findUnique({ where: { productId } });
      expect(inventory?.quantity).toBe(5); // Started at 15, reserved 10
    });
  });

  it('4. Replay ACCEPT should be idempotent and not deduct inventory again', async () => {
    await runWithContext(buyerId, async () => {
      // Replay accept returns existing order & paymentUrl idempotently
      const res = await acceptOfferTool.handler({ offerId });
      expect(res.isError).toBeFalsy();
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.paymentLink).toBeDefined();

      const inventory = await prisma.inventory.findUnique({ where: { productId } });
      expect(inventory?.quantity).toBe(5); // Still 5!
    });
  });

  it('5. Concurrent acceptance of limited inventory', async () => {
    // Create an offer for 10 units, but only 5 are left
    const concurrentOffer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId, quantity: 10, unitPriceMinor: 100000 }],
        subtotalMinor: 1000000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 1000000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 10000)
      }
    });

    await runWithContext(buyerId, async () => {
      const res = await acceptOfferTool.handler({ offerId: concurrentOffer.id });
      expect(res.isError).toBe(true);
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.code).toBe('INVENTORY_UNAVAILABLE');

      const inventory = await prisma.inventory.findUnique({ where: { productId } });
      expect(inventory?.quantity).toBe(5);
    });
  });

  it('6. Cannot accept expired offer', async () => {
    const expiredOffer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId, quantity: 1, unitPriceMinor: 100000 }],
        subtotalMinor: 100000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 100000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() - 10000) // Expired
      }
    });

    await runWithContext(buyerId, async () => {
      const res = await acceptOfferTool.handler({ offerId: expiredOffer.id });
      expect(res.isError).toBe(true);
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.code).toBe('OFFER_EXPIRED');
    });
  });

  it('7. Cannot access another buyer\'s offer', async () => {
    await runWithContext('some-other-buyer', async () => {
      const res = await acceptOfferTool.handler({ offerId });
      expect(res.isError).toBe(true);
    });
  });
});
