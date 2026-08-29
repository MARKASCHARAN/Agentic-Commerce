import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { getSessionExperimentGroup } from '../../src/agent/intelligence/experiment';
import { getOrCreateCart } from '../../src/agent/cart/cart-state';
import uiRouter from '../../src/api/routes/ui.routes';

describe('Phase 36: Revenue Attribution + Experimentation', () => {
  let prisma: PrismaClient;
  let capRepo: MerchantCapabilityRepository;
  let capResolver: MerchantCapabilityResolver;
  let engine: RevenueIntelligenceEngine;

  const merchantId = 'merchant-exp-test';
  const userId = 'user-exp-test';
  const productId = 'prod-exp-test';

  // Find two session IDs mapping deterministically to ASSISTED and CONTROL
  let sessionIdAssisted = '';
  let sessionIdControl = '';

  beforeAll(async () => {
    prisma = new PrismaClient();
    capRepo = new MerchantCapabilityRepository();
    capResolver = new MerchantCapabilityResolver(capRepo);
    engine = new RevenueIntelligenceEngine({} as any, {} as any, capResolver, prisma);

    for (let i = 0; i < 100; i++) {
      const id = `sess-exp-${i}`;
      const group = getSessionExperimentGroup(id);
      if (group === 'ASSISTED' && !sessionIdAssisted) sessionIdAssisted = id;
      if (group === 'CONTROL' && !sessionIdControl) sessionIdControl = id;
      if (sessionIdAssisted && sessionIdControl) break;
    }

    // Clean up test data
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId: { in: [sessionIdAssisted, sessionIdControl] } } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId: { in: [sessionIdAssisted, sessionIdControl] } } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.cart.deleteMany({ where: { sessionId: { in: [sessionIdAssisted, sessionIdControl] } } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: { in: [sessionIdAssisted, sessionIdControl] } } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed test merchant
    await prisma.user.create({ data: { id: userId, email: 'exp@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Experiment Test Merchant' } });

    // Create session records in DB
    await prisma.session.create({ data: { id: sessionIdAssisted, userId, merchantId, state: 'ACTIVE' } });
    await prisma.session.create({ data: { id: sessionIdControl, userId, merchantId, state: 'ACTIVE' } });

    await capRepo.setCapabilities(merchantId, [
      'catalog' as any,
      'inventory' as any
    ]);

    await prisma.merchantGuardrail.create({
      data: {
        merchantId,
        revenueGoal: 'BALANCED',
        disabledSkills: []
      }
    });

    await prisma.product.create({
      data: {
        id: productId,
        merchantId,
        name: 'Experiment Item',
        priceMinor: 5000, // ₹50.00
        currency: 'INR',
        active: true,
        description: '<!-- rel: ["prod-rel-id"] -->'
      }
    });

    // Seed related product to allow cross-sell suggestion
    await prisma.product.create({
      data: {
        id: 'prod-rel-id',
        merchantId,
        name: 'Related Complement Product',
        priceMinor: 2000,
        currency: 'INR',
        active: true,
        description: 'Complement description'
      }
    });

    await prisma.inventory.create({
      data: { merchantId, productId, quantity: 20 }
    });
    await prisma.inventory.create({
      data: { merchantId, productId: 'prod-rel-id', quantity: 20 }
    });

    // Populate carts
    await getOrCreateCart(prisma, sessionIdAssisted, [{ productId, quantity: 1 }]);
    await getOrCreateCart(prisma, sessionIdControl, [{ productId, quantity: 1 }]);
  });

  afterAll(async () => {
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId: { in: [sessionIdAssisted, sessionIdControl] } } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId: { in: [sessionIdAssisted, sessionIdControl] } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: [productId, 'prod-rel-id'] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productId, 'prod-rel-id'] } } });
    await prisma.cart.deleteMany({ where: { sessionId: { in: [sessionIdAssisted, sessionIdControl] } } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: { in: [sessionIdAssisted, sessionIdControl] } } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. Deterministic session splitting works', () => {
    expect(getSessionExperimentGroup(sessionIdAssisted)).toBe('ASSISTED');
    expect(getSessionExperimentGroup(sessionIdControl)).toBe('CONTROL');
  });

  it('2. CONTROL group sessions bypass active revenue opportunities', async () => {
    const result = await engine.analyze(merchantId, {
      sessionId: sessionIdControl,
      currentProductId: productId,
      experimentEnabled: true
    });
    // Should be completely bypassed and return null
    expect(result).toBeNull();
  });

  it('3. ASSISTED group sessions process revenue opportunities normally', async () => {
    const result = await engine.analyze(merchantId, {
      sessionId: sessionIdAssisted,
      currentProductId: productId,
      cartProductIds: [productId],
      experimentEnabled: true
    });
    expect(result).not.toBeNull();
  });

  it('4. Dashboard computes cohort-specific metrics and uplifts correctly', async () => {
    // Add completed order to ASSISTED session
    const orderAssisted = await prisma.commerceOrder.create({
      data: {
        sessionId: sessionIdAssisted,
        merchantId,
        buyerId: userId,
        total: 100.00, // ₹100.00
        status: 'completed'
      }
    });
    await prisma.commerceItem.create({
      data: { orderId: orderAssisted.id, productId, quantity: 2, price: 50.00 }
    });

    // Add completed order to CONTROL session
    const orderControl = await prisma.commerceOrder.create({
      data: {
        sessionId: sessionIdControl,
        merchantId,
        buyerId: userId,
        total: 50.00, // ₹50.00
        status: 'completed'
      }
    });
    await prisma.commerceItem.create({
      data: { orderId: orderControl.id, productId, quantity: 1, price: 50.00 }
    });

    // Invoke the dashboard route handler directly
    const req = {
      query: { merchantId },
      headers: {}
    } as any;

    let resData: any = null;
    const res = {
      status: (code: number) => {
        return {
          json: (data: any) => {
            resData = { code, data };
          }
        };
      },
      json: (data: any) => {
        resData = { code: 200, data };
      }
    } as any;

    const dashboardRoute = uiRouter.stack.find(
      layer => layer.route && layer.route.path === '/dashboard'
    );
    expect(dashboardRoute).toBeDefined();

    const handler = dashboardRoute!.route.stack[0].handle;
    await handler(req, res);

    expect(resData).not.toBeNull();
    expect(resData.code).toBe(200);

    const data = resData.data;
    expect(data.merchantId).toBe(merchantId);
    expect(data.totalRevenue).toBe(150.00);

    // Verify cohorts structure
    expect(data.cohorts).toBeDefined();
    expect(data.cohorts.assisted.sessions).toBe(1);
    expect(data.cohorts.assisted.orders).toBe(1);
    expect(data.cohorts.assisted.revenue).toBe(100.00);
    expect(data.cohorts.assisted.aov).toBe(100.00);
    expect(data.cohorts.assisted.conversionRate).toBe(100.00);

    expect(data.cohorts.control.sessions).toBe(1);
    expect(data.cohorts.control.orders).toBe(1);
    expect(data.cohorts.control.revenue).toBe(50.00);
    expect(data.cohorts.control.aov).toBe(50.00);
    expect(data.cohorts.control.conversionRate).toBe(100.00);

    // Uplift metrics
    expect(data.cohorts.uplift.conversionRate).toBe(0.00); // 100% - 100%
    expect(data.cohorts.uplift.aov).toBe(50.00); // 100.00 - 50.00
    expect(data.cohorts.uplift.revenuePerSession).toBe(50.00); // 100.00 - 50.00
  });
});
