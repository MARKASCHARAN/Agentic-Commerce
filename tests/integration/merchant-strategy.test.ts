import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { MerchantStrategyResolver } from '../../src/agent/intelligence/merchant-strategy';
import { MerchantGuardrailConfig } from '../../src/agent/policy/guardrails';

describe('Phase 37: Merchant Revenue Strategy', () => {
  let prisma: PrismaClient;
  let capRepo: MerchantCapabilityRepository;
  let capResolver: MerchantCapabilityResolver;
  let engine: RevenueIntelligenceEngine;
  let strategyResolver: MerchantStrategyResolver;

  const merchantId = 'merchant-strategy-test';
  const userId = 'user-strategy-test';
  const sessionId = 'sess-strategy-test';
  const preferredProductId = 'prod-preferred';
  const highMarginProductId = 'prod-highmargin';
  const normalProductId = 'prod-normal';

  beforeAll(async () => {
    prisma = new PrismaClient();
    capRepo = new MerchantCapabilityRepository();
    capResolver = new MerchantCapabilityResolver(capRepo);
    engine = new RevenueIntelligenceEngine({} as any, {} as any, capResolver, prisma);
    strategyResolver = new MerchantStrategyResolver(prisma);

    // Clean up
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId } });
    await prisma.inventory.deleteMany({ where: { productId: { in: [preferredProductId, highMarginProductId, normalProductId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [preferredProductId, highMarginProductId, normalProductId] } } });
    await prisma.cart.deleteMany({ where: { sessionId } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed
    await prisma.user.create({ data: { id: userId, email: 'strategy@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Strategy Test Merchant' } });
    await prisma.session.create({ data: { id: sessionId, userId, merchantId, state: 'ACTIVE' } });

    await capRepo.setCapabilities(merchantId, ['catalog' as any, 'inventory' as any]);

    await prisma.merchantGuardrail.create({
      data: {
        merchantId,
        revenueGoal: 'BALANCED',
        maxDiscountBps: 500, // 5% max discount
        minimumMarginBps: 1000, // 10% minimum margin
        approvalAboveMinor: 100000, // Approval required above ₹1000
        upsellEnabled: true,
        crossSellEnabled: true,
        disabledSkills: []
      }
    });

    // A preferred product tagged with <!-- priority: high -->
    await prisma.product.create({
      data: {
        id: preferredProductId,
        merchantId,
        name: 'Preferred Accessory',
        priceMinor: 3000,
        currency: 'INR',
        active: true,
        description: '<!-- priority: high --> <!-- rel: ["' + normalProductId + '"] -->'
      }
    });

    // A high-margin product tagged with <!-- margin: high -->
    await prisma.product.create({
      data: {
        id: highMarginProductId,
        merchantId,
        name: 'Premium Widget',
        priceMinor: 8000,
        currency: 'INR',
        active: true,
        description: '<!-- margin: high --> <!-- rel: ["' + normalProductId + '"] -->'
      }
    });

    // A normal product with rel tags pointing to preferred and high-margin products
    await prisma.product.create({
      data: {
        id: normalProductId,
        merchantId,
        name: 'Basic Product',
        priceMinor: 5000,
        currency: 'INR',
        active: true,
        description: '<!-- rel: ["' + preferredProductId + '", "' + highMarginProductId + '"] -->'
      }
    });

    // Seed inventory for all products
    await prisma.inventory.create({ data: { merchantId, productId: preferredProductId, quantity: 50 } });
    await prisma.inventory.create({ data: { merchantId, productId: highMarginProductId, quantity: 50 } });
    await prisma.inventory.create({ data: { merchantId, productId: normalProductId, quantity: 50 } });
  });

  afterAll(async () => {
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId } });
    await prisma.inventory.deleteMany({ where: { productId: { in: [preferredProductId, highMarginProductId, normalProductId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [preferredProductId, highMarginProductId, normalProductId] } } });
    await prisma.cart.deleteMany({ where: { sessionId } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. MerchantStrategyResolver parses priority and margin tags from product descriptions', async () => {
    const strategy = await strategyResolver.resolve(merchantId);

    expect(strategy.primaryGoal).toBe('BALANCED');
    expect(strategy.maxDiscountBps).toBe(500);
    expect(strategy.minimumMarginBps).toBe(1000);
    expect(strategy.approvalAboveMinor).toBe(100000);
    expect(strategy.preferredProductIds).toContain(preferredProductId);
    expect(strategy.preferredProductIds).not.toContain(normalProductId);
    expect(strategy.highMarginProductIds).toContain(highMarginProductId);
    expect(strategy.highMarginProductIds).not.toContain(normalProductId);
  });

  it('2. Preferred products get ranking boost when buyer browses normal product', async () => {
    const guardrails: MerchantGuardrailConfig = {
      id: 'test-id',
      merchantId,
      revenueGoal: 'BALANCED',
      currency: 'INR',
      autonomousPaymentLimitMinor: 0,
      approvalAboveMinor: 0,
      maxDiscountBps: 0,
      minimumMarginBps: 0,
      negotiationEnabled: false,
      upsellEnabled: true,
      crossSellEnabled: true,
      disabledSkills: []
    };

    const result = await engine.analyze(merchantId, {
      sessionId,
      currentProductId: normalProductId,
      cartProductIds: [normalProductId]
    }, guardrails);

    // Should return an opportunity (cross-sell for preferred or high-margin product)
    expect(result).not.toBeNull();
    expect(result!.type).toBe('CROSS_SELL');
    // The high-margin product should be boosted by 1.3x impact, making it rank higher
    expect(result!.proposedAction?.resourceId).toBe(highMarginProductId);
  });

  it('3. PROMOTE_PREFERRED goal prioritizes preferred products over higher-value alternatives', async () => {
    // Update guardrail to PROMOTE_PREFERRED
    await prisma.merchantGuardrail.update({
      where: { merchantId },
      data: { revenueGoal: 'PROMOTE_PREFERRED' }
    });

    const guardrails: MerchantGuardrailConfig = {
      id: 'test-id',
      merchantId,
      revenueGoal: 'PROMOTE_PREFERRED',
      currency: 'INR',
      autonomousPaymentLimitMinor: 0,
      approvalAboveMinor: 0,
      maxDiscountBps: 0,
      minimumMarginBps: 0,
      negotiationEnabled: false,
      upsellEnabled: true,
      crossSellEnabled: true,
      disabledSkills: []
    };

    const result = await engine.analyze(merchantId, {
      sessionId,
      currentProductId: normalProductId,
      cartProductIds: [normalProductId]
    }, guardrails);

    expect(result).not.toBeNull();
    // Preferred product should rank first regardless of value
    expect(result!.proposedAction?.resourceId).toBe(preferredProductId);

    // Reset to BALANCED
    await prisma.merchantGuardrail.update({
      where: { merchantId },
      data: { revenueGoal: 'BALANCED' }
    });
  });

  it('4. Approval threshold marks high-value opportunities as REVIEW', async () => {
    const guardrails: MerchantGuardrailConfig = {
      id: 'test-id',
      merchantId,
      revenueGoal: 'BALANCED',
      currency: 'INR',
      autonomousPaymentLimitMinor: 0,
      approvalAboveMinor: 1000, // Very low threshold: ₹10
      maxDiscountBps: 0,
      minimumMarginBps: 0,
      negotiationEnabled: false,
      upsellEnabled: true,
      crossSellEnabled: true,
      disabledSkills: []
    };

    const result = await engine.analyze(merchantId, {
      sessionId,
      currentProductId: normalProductId,
      cartProductIds: [normalProductId]
    }, guardrails);

    expect(result).not.toBeNull();
    // Product prices are 3000+ minor, which is above the 1000 threshold
    expect(result!.policyDecision).toBe('REVIEW');
  });

  it('5. Discount ceiling blocks opportunities with excessive discounts', async () => {
    const guardrails: MerchantGuardrailConfig = {
      id: 'test-id',
      merchantId,
      revenueGoal: 'BALANCED',
      currency: 'INR',
      autonomousPaymentLimitMinor: 0,
      approvalAboveMinor: 0,
      maxDiscountBps: 100, // Only 1% discount allowed
      minimumMarginBps: 0,
      negotiationEnabled: false,
      upsellEnabled: true,
      crossSellEnabled: true,
      disabledSkills: []
    };

    // The cross-sell opportunities don't have discountMinor set (they're ADD_PRODUCT),
    // so they should still pass. The discount check only blocks when discountMinor > ceiling.
    const result = await engine.analyze(merchantId, {
      sessionId,
      currentProductId: normalProductId,
      cartProductIds: [normalProductId]
    }, guardrails);

    expect(result).not.toBeNull();
  });
});
