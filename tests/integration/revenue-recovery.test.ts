import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { getOrCreateCart } from '../../src/agent/cart/cart-state';
import crypto from 'crypto';

describe('Phase 34: Revenue Recovery Detector', () => {
  let prisma: PrismaClient;
  let capRepo: MerchantCapabilityRepository;
  let capResolver: MerchantCapabilityResolver;
  let engine: RevenueIntelligenceEngine;

  const merchantId = 'merchant-rev-rec';
  const sessionId = 'session-rev-rec';
  const userId = 'user-rev-rec';
  const productId = 'prod-rev-rec-1';

  beforeAll(async () => {
    prisma = new PrismaClient();
    capRepo = new MerchantCapabilityRepository();
    capResolver = new MerchantCapabilityResolver(capRepo);
    engine = new RevenueIntelligenceEngine({} as any, capResolver, prisma);

    // Clean up test data
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.cart.deleteMany({ where: { sessionId } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed test user, merchant, session
    await prisma.user.create({ data: { id: userId, email: 'rev-rec@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Revenue Recovery Merchant' } });
    await prisma.session.create({ data: { id: sessionId, merchantId, state: 'ACTIVE' } });

    await capRepo.setCapabilities(merchantId, [
      'catalog' as any,
      'inventory' as any
    ]);

    await prisma.merchantGuardrail.create({
      data: {
        merchantId,
        revenueGoal: 'BALANCED',
        disabledSkills: [] // No disabled skills initially
      }
    });

    // Create test product with recoveryDiscountBps tag
    await prisma.product.create({
      data: {
        id: productId,
        merchantId,
        name: 'Recoverable Product',
        priceMinor: 50000, // ₹500.00
        currency: 'INR',
        active: true,
        description: '<!-- recoveryDiscountBps: 1000 -->' // 10% recovery discount
      }
    });

    await prisma.inventory.create({
      data: { merchantId, productId, quantity: 10 }
    });
  });

  afterAll(async () => {
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

  it('1. Proposes recovery proposal when paymentFailed: true and cart is active', async () => {
    // Setup active cart item
    await prisma.cart.deleteMany({ where: { sessionId } });
    await getOrCreateCart(prisma, sessionId, [{ productId, quantity: 2 }]);

    const result = await engine.analyze(merchantId, {
      sessionId,
      paymentFailed: true
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('RECOVERY');
    expect(result!.affectedResources).toContain(productId);
    expect(result!.proposedAction?.actionType).toBe('RESUME_CHECKOUT');
    expect(result!.proposedAction?.priceMinor).toBe(90000); // 100000 original - 10% (10000) = 90000 minor
    expect(result!.proposedAction?.discountMinor).toBe(10000);
    expect(result!.evidence).toContain('Detected failed payment signal');
  });

  it('2. Proposes recovery proposal when checkoutAbandoned: true and cart is active', async () => {
    await prisma.cart.deleteMany({ where: { sessionId } });
    await getOrCreateCart(prisma, sessionId, [{ productId, quantity: 1 }]);

    const result = await engine.analyze(merchantId, {
      sessionId,
      checkoutAbandoned: true
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('RECOVERY');
    expect(result!.proposedAction?.priceMinor).toBe(45000); // 50000 - 10% (5000) = 45000 minor
    expect(result!.proposedAction?.discountMinor).toBe(5000);
    expect(result!.evidence).toContain('Detected abandoned checkout signal');
  });

  it('3. Does NOT propose recovery if cart is empty', async () => {
    await prisma.cart.deleteMany({ where: { sessionId } });

    const result = await engine.analyze(merchantId, {
      sessionId,
      paymentFailed: true
    });

    expect(result).toBeNull();
  });

  it('4. Does NOT propose recovery if recovery is disabled in merchant guardrails', async () => {
    await prisma.cart.deleteMany({ where: { sessionId } });
    await getOrCreateCart(prisma, sessionId, [{ productId, quantity: 1 }]);

    // Disable recovery in guardrails
    await prisma.merchantGuardrail.update({
      where: { merchantId },
      data: { disabledSkills: ['recovery'] }
    });

    const result = await engine.analyze(merchantId, {
      sessionId,
      paymentFailed: true
    });

    expect(result).toBeNull();
  });
});
