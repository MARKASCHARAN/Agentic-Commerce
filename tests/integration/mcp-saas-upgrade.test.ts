import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createRequestTool } from '../../src/api/mcp/tools/merchant-create-request.tool';
import { mcpContextStorage } from '../../src/api/mcp/context';

const prisma = new PrismaClient();

describe('merchant.create_request tool (SaaS Vertical)', () => {
  let merchantId: string;
  let buyerId = 'saas-buyer-id';
  let sessionId = 'saas-mcp-session';
  let starterPlanId: string;
  let businessPlanId: string;

  beforeEach(async () => {
    // Teardown
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
    await prisma.session.deleteMany();
    await prisma.product.deleteMany();
    await prisma.merchantCapability.deleteMany();
    await prisma.merchant.deleteMany();
    await prisma.user.deleteMany();

    // Create SaaS Merchant
    const merchant = await prisma.merchant.create({
      data: {
        id: 'merchant-saas',
        name: 'Test SaaS Merchant',
        user: {
          create: {
            id: 'user-saas',
            email: 'saas@merchant.com',
            name: 'Test SaaS User',
          }
        },
        capabilities: {
          create: [
            { capability: 'CATALOG' },
            { capability: 'subscriptions' },
            { capability: 'usage' }
          ]
        }
      }
    });
    merchantId = merchant.id;

    // Create SaaS Plans (Products)
    const starterPlan = await prisma.product.create({
      data: {
        merchantId,
        name: 'Starter Plan',
        type: 'SAAS_PLAN',
        metadata: { maxSeats: 5 },
        priceMinor: 99900,
        currency: 'INR',
        active: true
      }
    });
    starterPlanId = starterPlan.id;

    const businessPlan = await prisma.product.create({
      data: {
        merchantId,
        name: 'Business Plan',
        type: 'SAAS_PLAN',
        metadata: { maxSeats: 20 },
        priceMinor: 249900,
        currency: 'INR',
        active: true
      }
    });
    businessPlanId = businessPlan.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  function runWithContext(fn: () => Promise<any>) {
    return mcpContextStorage.run({
      merchantId,
      buyerId,
      sessionId,
      requestId: 'saas-req'
    }, fn);
  }

  it('A. Requesting 3 seats of Starter Plan creates a standard offer', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: starterPlanId, quantity: 1, attributes: { requestedSeats: 3 } }]
      });

      expect(result.isError).toBeFalsy();
      const payload = JSON.parse((result.content[0] as any).text);
      expect(payload.offer.items).toHaveLength(1);
      expect(payload.offer.items[0].productId).toBe(starterPlanId);
      expect(payload.offer.items[0].quantity).toBe(1); // 1 license of a 3-seat config
      expect(payload.offer.items[0].unitPriceMinor).toBe(99900);
      expect(payload.offer.subtotalMinor).toBe(99900); // 1 plan * 99900
    });
  });

  it('B. Requesting 15 seats of Starter Plan triggers UPGRADE opportunity via Revenue Intelligence Engine', async () => {
    await runWithContext(async () => {
      const result = await createRequestTool.handler({
        items: [{ productId: starterPlanId, quantity: 1, attributes: { requestedSeats: 15 } }]
      });

      // It should NOT create an offer. It should return a deterministic capacity limit exceeded response.
      expect(result.isError).toBeFalsy(); 
      const payload = JSON.parse((result.content[0] as any).text);
      
      expect(payload.code).toBe('CAPACITY_LIMIT_EXCEEDED');
      expect(payload.opportunities).toBeDefined();
      expect(payload.opportunities).toHaveLength(1);
      
      // RevenueEngine wraps the detector output, which is an array of RevenueOpportunity objects.
      const opportunity = payload.opportunities[0];
      expect(opportunity.type).toBe('UPGRADE');
      expect(opportunity.proposedAction.resourceId).toBe(businessPlanId);
      expect(opportunity.evidence).toContain('User requested 15 seats');
      expect(opportunity.evidence).toContain('exceeds current limit of 5');
    });
  });
});
