import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { mcpContextStorage } from '../../src/api/mcp/context.js';
import { startCommerceMissionTool } from '../../src/api/mcp/tools/merchant-start-commerce-mission.tool.js';

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

describe('merchant.start_commerce_mission tool', () => {
  const prisma = new PrismaClient();
  let merchantId: string;
  let buyerId: string;
  let sessionId: string;
  let laptopId: string;

  beforeAll(async () => {
    merchantId = 'merchant-mission-' + crypto.randomUUID().slice(0, 8);
    buyerId = 'buyer-mission-' + crypto.randomUUID().slice(0, 8);
    sessionId = 'session-mission-' + crypto.randomUUID().slice(0, 8);

    await prisma.user.create({
      data: { id: merchantId, email: merchantId + '@example.com' }
    });

    await prisma.merchant.create({
      data: {
        id: merchantId,
        name: 'Mission Merchant',
        userId: merchantId,
        guardrails: {
          create: {
            maxDiscountBps: 1000, // 10% max discount
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
        id: 'prod-lapt-m-' + crypto.randomUUID().slice(0, 8),
        merchantId,
        name: 'MacBook Pro M3 32GB',
        priceMinor: 18500000, // ₹1,85,000
        currency: 'INR',
        active: true
      }
    });
    laptopId = laptop.id;

    await prisma.inventory.create({
      data: { productId: laptopId, merchantId, quantity: 20 }
    });

    await prisma.session.create({
      data: { id: sessionId, merchantId, state: 'ACTIVE' }
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
      requestId: 'mission-req'
    }, fn);
  }

  it('Persists OutboxEvent in PostgreSQL and dispatches autonomous background mission', async () => {
    await runWithContext(async () => {
      const res = await startCommerceMissionTool.handler({
        budgetMinor: 20000000, // ₹2,00,000
        requirements: 'MacBook',
        buyerEmail: 'markascharan@gmail.com'
      });

      expect(res.isError).toBeFalsy();
      const payload = JSON.parse((res.content[0] as any).text);
      expect(payload.status).toBe('MISSION_PERSISTED_AND_DISPATCHED');
      expect(payload.missionId).toBeDefined();
      expect(payload.buyerEmail).toBe('markascharan@gmail.com');

      // Verify OutboxEvent was persisted in PostgreSQL database
      const outboxEvent = await prisma.outboxEvent.findUnique({
        where: { eventId: payload.missionId }
      });
      expect(outboxEvent).toBeDefined();
      expect(outboxEvent?.eventType).toBe('commerce.mission.requested');
    });
  });
});
