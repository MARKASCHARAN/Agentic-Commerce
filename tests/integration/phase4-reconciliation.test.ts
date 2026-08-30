import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { RevenueTracker } from '../../src/agent/intelligence/revenue-tracker';
import { PrismaCatalogProvider } from '../../src/catalog/prisma-catalog.provider';
import { createPaymentReconciliationHandler } from '../../src/agent/payments/reconciliation';
import { createCheckoutTool } from '../../src/agent/tools/payment/checkout.tools';
import { getDashboardMetrics } from '../../src/api/routes/ui.routes';
import crypto from 'crypto';

describe.sequential('Phase 4: Measurement & Reconciliation Validation', () => {
  let prisma: PrismaClient;
  let revenueEngine: RevenueIntelligenceEngine;
  let catalogProvider: PrismaCatalogProvider;
  let reconciliationHandler: any;
  let checkoutTool: any;

  // Mock Razorpay Provider
  const mockRazorpay = {
    createOrder: async (input: any, idempotencyKey?: string) => {
      if (input.receipt && input.notes?.receipt !== input.receipt) {
        throw new Error('Regression: Razorpay createOrder payload must contain notes.receipt matching the root receipt (CommerceOrder.id)');
      }
      return {
        success: true,
        data: {
          providerId: `order_${crypto.randomBytes(8).toString('hex')}`,
          amountMinor: input.amount,
          currency: input.currency
        }
      };
    },
    reconcileWebhook: async () => ({ success: true, data: {} })
  } as any;

  const mockInventory = {
    check: async () => ({ available: true, quantity: 100 }),
    reserve: async () => true,
    release: async () => true
  } as any;

  beforeAll(async () => {
    prisma = new PrismaClient();
    catalogProvider = new PrismaCatalogProvider(prisma);
    const tracker = new RevenueTracker(prisma);
    
    // Proper instantiation
    const policyEngine = { evaluate: async () => ({ status: 'ALLOW' }) } as any;
    const modelGateway = { chat: async () => ({ text: 'mock' }) } as any;
    const capabilityResolver = {
      resolve: async (mId: string) => ({
        has: () => true // Allow all for tests
      })
    } as any;
    
    revenueEngine = new RevenueIntelligenceEngine(policyEngine, modelGateway, capabilityResolver, prisma);
    reconciliationHandler = createPaymentReconciliationHandler(prisma);
    checkoutTool = createCheckoutTool(catalogProvider, mockInventory, mockRazorpay, prisma);

    // Clean up
    await prisma.revenueOpportunityLog.deleteMany({});
    await prisma.webhookEvent.deleteMany({});
    await prisma.paymentIntent.deleteMany({});
    await prisma.commerceItem.deleteMany({});
    await prisma.commerceOrder.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.session.deleteMany({});
    
    // Clean up products
    await prisma.inventory.deleteMany({ where: { merchantId: 'merchant-saas-phase4' } });
    await prisma.product.deleteMany({ where: { merchantId: 'merchant-saas-phase4' } });
    await prisma.inventory.deleteMany({ where: { merchantId: 'merchant-hardware-phase4' } });
    await prisma.product.deleteMany({ where: { merchantId: 'merchant-hardware-phase4' } });

    // Seed Merchants
    await prisma.user.upsert({
      where: { id: 'user-p4' },
      update: {},
      create: { id: 'user-p4', email: 'p4@example.com' }
    });
    await prisma.merchant.upsert({
      where: { id: 'merchant-saas-phase4' },
      update: {},
      create: { id: 'merchant-saas-phase4', name: 'Phase 4 SaaS Merchant', userId: 'user-p4' }
    });
    await prisma.merchant.upsert({
      where: { id: 'merchant-hardware-phase4' },
      update: {},
      create: { id: 'merchant-hardware-phase4', name: 'Phase 4 Hardware Merchant', userId: 'user-p4' }
    });

    // Seed SaaS Products
    await prisma.product.create({
      data: {
        id: 'prod_basic_p4',
        merchantId: 'merchant-saas-phase4',
        name: 'Basic Cloud Plan',
        priceMinor: 100000,
        currency: 'INR',
        description: '<!-- seatLimit: 5 -->'
      }
    });
    await prisma.product.create({
      data: {
        id: 'prod_pro_p4',
        merchantId: 'merchant-saas-phase4',
        name: 'Pro Cloud Plan',
        priceMinor: 500000,
        currency: 'INR',
        description: '<!-- seatLimit: 20 -->'
      }
    });

    // Seed Hardware Products
    await prisma.product.create({
      data: {
        id: 'prod_laptop_p4',
        merchantId: 'merchant-hardware-phase4',
        name: 'Developer Laptop',
        priceMinor: 15000000,
        currency: 'INR',
        description: '<!-- rel: ["prod_mouse_p4"] -->' // Cross-sell
      }
    });
    await prisma.product.create({
      data: {
        id: 'prod_mouse_p4',
        merchantId: 'merchant-hardware-phase4',
        name: 'Wireless Mouse',
        priceMinor: 500000,
        currency: 'INR'
      }
    });
    
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function simulatePaymentWebhook(providerOrderId: string, orderId: string, eventType: string = 'payment.captured') {
    // Inject mock webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        provider: 'razorpay',
        providerEventId: crypto.randomUUID(),
        eventType,
        payload: {
          payload: {
            payment: {
              entity: {
                order_id: providerOrderId,
                notes: { receipt: orderId }
              }
            }
          }
        }
      }
    });

    await reconciliationHandler({
      eventId: webhookEvent.id,
      eventType: 'webhook.razorpay',
      aggregateType: 'payment',
      aggregateId: providerOrderId,
      correlationId: orderId,
      payload: {
        type: eventType,
        providerEntityId: providerOrderId,
        eventId: webhookEvent.id
      }
    });
  }

  it('1. Normal Purchase -> No AI Revenue', async () => {
    const sessionId = crypto.randomUUID();
    await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-saas-phase4', state: 'ACTIVE' } });

    // Checkout Basic Plan
    const result = await checkoutTool.adapter.execute({ items: [{ productId: 'prod_basic_p4', quantity: 1 }] }, {
      merchantId: 'merchant-saas-phase4',
      sessionId: sessionId,
      cartProductIds: ['prod_basic_p4'] // Fix: authorize item
    });

    expect(result.status).toBe('success');
    const orderId = result.checkoutData.orderId;
    const razorpayOrderId = result.checkoutData.razorpayOrderId;

    // Simulate payment webhook
    await simulatePaymentWebhook(razorpayOrderId, orderId);

    // Verify dashboard metrics
    const metrics = await getDashboardMetrics(prisma, 'merchant-saas-phase4');
    expect(metrics.totalRevenue).toBe(1000); // 100000 minor = 1000 major
    expect(metrics.aiAssistedRevenue).toBe(0);
    expect(metrics.convertedOpportunities).toBe(0);
  });

  it('2. Upsell (SaaS focus) -> Partial AI Revenue', async () => {
    const sessionId = crypto.randomUUID();
    await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-saas-phase4', state: 'ACTIVE' } });

    // Step 1: Detect Upsell (Buyer wants more seats)
    const context = {
      requestedSeats: 10,
      currentPlanId: 'prod_basic_p4'
    };
    const rawOpps = await revenueEngine.analyze('merchant-saas-phase4', { sessionId, ...context } as any);
    // Since analyze handles returning single or array in some engines, let's treat it safely
    const opp = Array.isArray(rawOpps) ? rawOpps[0] : rawOpps;

    expect(opp).not.toBeNull();
    expect(opp!.type).toBe('UPGRADE');
    expect(opp!.expectedImpactValue).toBe(400000); // 500k - 100k

    // Step 2: Accept Opportunity
    const { acceptOpportunity } = await import('../../src/agent/cart/cart-state');
    
    await prisma.revenueOpportunityLog.create({
      data: {
        id: opp!.id,
        merchantId: 'merchant-saas-phase4',
        sessionId: sessionId,
        opportunityType: opp!.type,
        expectedImpactMinor: opp!.expectedImpactValue,
        status: 'PROPOSED'
      }
    });
    
    await acceptOpportunity(prisma, sessionId, opp!.id, 'prod_pro_p4');

    // Step 3: Checkout Pro Plan (as recommended)
    const result = await checkoutTool.adapter.execute({ items: [{ productId: 'prod_pro_p4', quantity: 1 }] }, {
      merchantId: 'merchant-saas-phase4',
      sessionId: sessionId,
      cartProductIds: ['prod_basic_p4'] // Mock they originally had basic in mind/cart
    });

    expect(result.status).toBe('success');
    
    // Step 4: Webhook Reconciles Payment
    await simulatePaymentWebhook(result.checkoutData.razorpayOrderId, result.checkoutData.orderId);

    // Step 5: Verify AI metrics
    const metrics = await getDashboardMetrics(prisma, 'merchant-saas-phase4');
    expect(metrics.convertedOpportunities).toBe(1);
    
    // Total Revenue is Basic + Pro (1000 + 5000)
    expect(metrics.totalRevenue).toBe(6000); 
    
    // AI Incremental is ONLY the upsell diff! 400000 minor = 4000 major
    expect(metrics.aiAssistedRevenue).toBe(4000);
  });

  it('3. Cross-sell -> Partial AI Revenue', async () => {
    const sessionId = crypto.randomUUID();
    await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-hardware-phase4', state: 'ACTIVE' } });

    // Add Laptop to Cart
    await prisma.cart.create({
      data: {
        sessionId,
        items: [{ productId: 'prod_laptop_p4', quantity: 1 }] as any
      }
    });

    // Detect Cross-Sell
    const opp = await revenueEngine.analyze('merchant-hardware-phase4', { 
      sessionId, 
      cartProductIds: ['prod_laptop_p4'] 
    } as any);

    expect(opp).not.toBeNull();
    expect(opp!.type).toBe('CROSS_SELL');
    expect(opp!.affectedResources[0]).toBe('prod_mouse_p4');
    expect(opp!.expectedImpactValue).toBe(500000); // Mouse price

    // Accept Opportunity
    const { acceptOpportunity } = await import('../../src/agent/cart/cart-state');
    
    await prisma.revenueOpportunityLog.create({
      data: {
        id: opp!.id,
        merchantId: 'merchant-hardware-phase4',
        sessionId: sessionId,
        opportunityType: opp!.type,
        expectedImpactMinor: opp!.expectedImpactValue,
        status: 'PROPOSED'
      }
    });
    
    await acceptOpportunity(prisma, sessionId, opp!.id, 'prod_mouse_p4');

    // Checkout Laptop + Mouse
    const result = await checkoutTool.adapter.execute({ 
      items: [
        { productId: 'prod_laptop_p4', quantity: 1 },
        { productId: 'prod_mouse_p4', quantity: 1 }
      ] 
    }, {
      merchantId: 'merchant-hardware-phase4',
      sessionId: sessionId,
      cartProductIds: ['prod_laptop_p4']
    });

    // Webhook Reconciles
    await simulatePaymentWebhook(result.checkoutData.razorpayOrderId, result.checkoutData.orderId);

    // Verify Dashboard
    const metrics = await getDashboardMetrics(prisma, 'merchant-hardware-phase4');
    expect(metrics.convertedOpportunities).toBe(1);
    expect(metrics.totalRevenue).toBe(155000); // 150000 (laptop) + 5000 (mouse)
    expect(metrics.aiAssistedRevenue).toBe(5000); // ONLY mouse
  });

  it('4. Recovery -> Full AI Revenue', async () => {
    const sessionId = crypto.randomUUID();
    await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-saas-phase4', state: 'ACTIVE' } });

    await prisma.cart.create({
      data: {
        sessionId,
        items: [{ productId: 'prod_pro_p4', quantity: 1 }] as any
      }
    });

    // Simulate Abandoned Checkout
    const opp = await revenueEngine.analyze('merchant-saas-phase4', { 
      sessionId,
      checkoutAbandoned: true,
      cartProductIds: ['prod_pro_p4']
    } as any);

    expect(opp).not.toBeNull();
    expect(opp!.type).toBe('RECOVERY');
    expect(opp!.expectedImpactValue).toBe(500000);

    // Accept
    const { acceptOpportunity } = await import('../../src/agent/cart/cart-state');

    await prisma.revenueOpportunityLog.create({
      data: {
        id: opp!.id,
        merchantId: 'merchant-saas-phase4',
        sessionId: sessionId,
        opportunityType: opp!.type,
        expectedImpactMinor: opp!.expectedImpactValue,
        status: 'PROPOSED'
      }
    });
    
    await acceptOpportunity(prisma, sessionId, opp!.id, 'prod_pro_p4');

    // Checkout
    const result = await checkoutTool.adapter.execute({ items: [{ productId: 'prod_pro_p4', quantity: 1 }] }, {
      merchantId: 'merchant-saas-phase4',
      sessionId: sessionId,
      cartProductIds: ['prod_pro_p4']
    });

    await simulatePaymentWebhook(result.checkoutData.razorpayOrderId, result.checkoutData.orderId);

    // Verify
    const metrics = await getDashboardMetrics(prisma, 'merchant-saas-phase4');
    // From before: 6000 total, 4000 AI
    // Now adding 5000 total, 5000 AI
    expect(metrics.totalRevenue).toBe(11000); 
    expect(metrics.aiAssistedRevenue).toBe(9000); // 4000 (Upsell) + 5000 (Recovery)
  });

  it('5. Repeat Purchase -> Full AI Revenue', async () => {
    const sessionId = crypto.randomUUID();
    await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-saas-phase4', state: 'ACTIVE', userId: 'user-p4' } });

    await prisma.commerceOrder.create({
      data: {
        id: crypto.randomUUID(),
        merchantId: 'merchant-saas-phase4',
        sessionId,
        total: 1000,
        status: 'paid',
        items: {
          create: [{ productId: 'prod_basic_p4', quantity: 1, price: 1000 }]
        }
      }
    });

    // Reorder triggered
    const opp = await revenueEngine.analyze('merchant-saas-phase4', { 
      sessionId,
      buyerRequestedReorder: true,
      priorPurchases: ['prod_basic_p4']
    } as any);

    expect(opp).not.toBeNull();
    expect(opp!.type).toBe('REPEAT_PURCHASE');
    expect(opp!.expectedImpactValue).toBe(100000);

    // Accept
    const { acceptOpportunity } = await import('../../src/agent/cart/cart-state');

    await prisma.revenueOpportunityLog.create({
      data: {
        id: opp!.id,
        merchantId: 'merchant-saas-phase4',
        sessionId: sessionId,
        opportunityType: opp!.type,
        expectedImpactMinor: opp!.expectedImpactValue,
        status: 'PROPOSED'
      }
    });
    
    await acceptOpportunity(prisma, sessionId, opp!.id, 'prod_basic_p4');

    // Checkout
    const result = await checkoutTool.adapter.execute({ items: [{ productId: 'prod_basic_p4', quantity: 1 }] }, {
      merchantId: 'merchant-saas-phase4',
      sessionId: sessionId,
      cartProductIds: []
    });

    await simulatePaymentWebhook(result.checkoutData.razorpayOrderId, result.checkoutData.orderId);

    // Verify
    const metrics = await getDashboardMetrics(prisma, 'merchant-saas-phase4');
    // Total +1000, AI +1000
    expect(metrics.totalRevenue).toBe(13000);  
    expect(metrics.aiAssistedRevenue).toBe(10000); // 9000 + 1000
  });

});
