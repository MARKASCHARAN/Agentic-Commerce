import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createNegotiationTool } from '../../src/agent/tools/payment/negotiation.tools';
import { createCheckoutTool } from '../../src/agent/tools/payment/checkout.tools';
import { PrismaCatalogProvider } from '../../src/catalog/prisma-catalog.provider';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { MerchantGuardrailRepository } from '../../src/database/repositories/merchant-guardrail.repository';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { getOrCreateCart } from '../../src/agent/cart/cart-state';
import crypto from 'crypto';

describe('Phase 32: Bounded Offer Engine', () => {
  let prisma: PrismaClient;
  let catalogProvider: PrismaCatalogProvider;
  let capRepo: MerchantCapabilityRepository;
  let capResolver: MerchantCapabilityResolver;
  let guardrailRepo: MerchantGuardrailRepository;
  let toolRegistry: ToolRegistry;
  let toolGateway: ToolGateway;

  const merchantId = 'merchant-offer-test';
  const sessionId = 'session-offer-test';
  const userId = 'user-offer-test';
  const productId = 'prod-offer-test-1';

  beforeAll(async () => {
    prisma = new PrismaClient();
    catalogProvider = new PrismaCatalogProvider(prisma);
    capRepo = new MerchantCapabilityRepository();
    capResolver = new MerchantCapabilityResolver(capRepo);
    guardrailRepo = new MerchantGuardrailRepository(prisma);

    // Clean up test data
    await prisma.paymentIntent.deleteMany({ where: { order: { sessionId } } });
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.cart.deleteMany({ where: { sessionId } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });

    // Seed test merchant & capabilities
    await prisma.user.create({ data: { id: userId, email: 'offer@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Offer Test Merchant' } });
    await prisma.session.create({ data: { id: sessionId, merchantId, state: 'ACTIVE' } });

    await capRepo.setCapabilities(merchantId, [
      'catalog' as any,
      'inventory' as any,
      'checkout.create' as any,
      'negotiation.create' as any
    ]);

    await prisma.merchantGuardrail.create({
      data: {
        merchantId,
        revenueGoal: 'BALANCED',
        upsellEnabled: true,
        crossSellEnabled: true,
        negotiationEnabled: true, // Enable negotiation guardrail!
        disabledSkills: [],
        maxDiscountBps: 1500, // 15%
        autonomousPaymentLimitMinor: 1000000
      }
    });

    // Seed test product with cost and neg metadata
    await prisma.product.create({
      data: {
        id: productId,
        merchantId,
        name: 'Offer Engine Test Shoes',
        priceMinor: 100000, // ₹1000.00
        currency: 'INR',
        active: true,
        description: '<!-- costMinor: 400000 --><!-- neg: { "enabled": true, "negotiable": true, "maxDiscountBps": 1500 } -->'
      }
    });

    await prisma.inventory.create({
      data: { merchantId, productId, quantity: 10 }
    });

    // Setup gateway
    toolRegistry = new ToolRegistry();
    toolRegistry.register(createNegotiationTool(catalogProvider, guardrailRepo, prisma));

    const mockRazorpay = {
      createOrder: async () => ({ success: true, data: { providerId: 'ord_123' } })
    } as any;
    toolRegistry.register(createCheckoutTool(catalogProvider, catalogProvider, mockRazorpay, prisma));

    toolGateway = new ToolGateway({
      toolRegistry,
      policyEngine: { evaluate: async () => ({ status: 'ALLOW' }) } as any,
      idempotencyEngine: { execute: async (k, s, fp, fn) => fn() } as any,
      capabilityResolver: capResolver,
      guardrailRepository: guardrailRepo,
      eventEmitter: { emit: () => {} }
    });
  });

  afterAll(async () => {
    await prisma.paymentIntent.deleteMany({ where: { order: { sessionId } } });
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.cart.deleteMany({ where: { sessionId } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. Proposes a valid negotiation discount -> ACCEPTED and checkout price updated', async () => {
    // Clear cart first
    await prisma.cart.deleteMany({ where: { sessionId } });
    await getOrCreateCart(prisma, sessionId, [{ productId, quantity: 1 }]);

    const result = await toolGateway.execute({
      toolId: 'negotiation.create',
      input: {
        productId,
        quantity: 1,
        proposedPriceMinor: 90000 // ₹900.00 (10% discount, allowed)
      },
      context: {
        executionId: 'exec-neg-1',
        agentId: 'agent-1',
        sessionId,
        merchantId,
        idempotencyKey: 'idem-neg-1'
      }
    });

    expect(result.output.status).toBe('success');
    expect(result.output.approvedPriceMinor).toBe(90000);
    expect(result.output.savingsMinor).toBe(10000);

    // Verify DB cart contains negotiatedPriceMinor
    const cart = await prisma.cart.findUnique({ where: { sessionId } });
    const item = (cart?.items as any[]).find(i => i.productId === productId);
    expect(item.negotiatedPriceMinor).toBe(90000);

    // Execute checkout
    const checkoutResult = await toolGateway.execute({
      toolId: 'checkout.create',
      input: {
        items: [{ productId, quantity: 1 }]
      },
      context: {
        executionId: 'exec-chk-1',
        agentId: 'agent-1',
        sessionId,
        merchantId,
        idempotencyKey: 'idem-chk-1',
        cartProductIds: [productId]
      }
    });

    expect(checkoutResult.output.status).toBe('success');
    expect(checkoutResult.output.checkoutData.amountMinor).toBe(90000); // Verify it uses negotiated rate!
  });

  it('2. Proposes excessive discount -> capped/floored to maximum allowed discount', async () => {
    await prisma.cart.deleteMany({ where: { sessionId } });
    await getOrCreateCart(prisma, sessionId, [{ productId, quantity: 1 }]);

    const result = await toolGateway.execute({
      toolId: 'negotiation.create',
      input: {
        productId,
        quantity: 1,
        proposedPriceMinor: 70000 // ₹700 (30% discount, exceeds 15% limit)
      },
      context: {
        executionId: 'exec-neg-2',
        agentId: 'agent-1',
        sessionId,
        merchantId,
        idempotencyKey: 'idem-neg-2'
      }
    });

    // Should be denied but approvedPriceMinor should be floored at ₹850 (85000 minor, 15% max discount)
    expect(result.output.status).toBe('denied');
    expect(result.output.approvedPriceMinor).toBe(85000);

    // Cart should store the floored price
    const cart = await prisma.cart.findUnique({ where: { sessionId } });
    const item = (cart?.items as any[]).find(i => i.productId === productId);
    expect(item.negotiatedPriceMinor).toBe(85000);

    // Execute checkout
    const checkoutResult = await toolGateway.execute({
      toolId: 'checkout.create',
      input: {
        items: [{ productId, quantity: 1 }]
      },
      context: {
        executionId: 'exec-chk-2',
        agentId: 'agent-1',
        sessionId,
        merchantId,
        idempotencyKey: 'idem-chk-2',
        cartProductIds: [productId]
      }
    });

    expect(checkoutResult.output.status).toBe('success');
    expect(checkoutResult.output.checkoutData.amountMinor).toBe(85000);
  });

  it('3. Checkout rejects out of bounds negotiated prices (security gate)', async () => {
    // Inject a malicious cart item with negotiated price set to negative
    await prisma.cart.deleteMany({ where: { sessionId } });
    await prisma.cart.create({
      data: {
        sessionId,
        items: [
          { productId, quantity: 1, negotiatedPriceMinor: -100 } // negative price
        ],
        rejectedOpportunities: [],
        acceptedOpportunities: []
      }
    });

    await expect(
      toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [{ productId, quantity: 1 }]
        },
        context: {
          executionId: 'exec-chk-3',
          agentId: 'agent-1',
          sessionId,
          merchantId,
          idempotencyKey: 'idem-chk-3',
          cartProductIds: [productId]
        }
      })
    ).rejects.toThrow('Security Exception: Negotiated price (-100) is out of safe bounds.');
  });
});
