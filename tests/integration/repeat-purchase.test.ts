import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import crypto from 'crypto';

describe('Phase 35: Repeat Purchase Engine', () => {
  let prisma: PrismaClient;
  let capRepo: MerchantCapabilityRepository;
  let capResolver: MerchantCapabilityResolver;
  let engine: RevenueIntelligenceEngine;

  const merchantId = 'merchant-repeat-test';
  const sessionId = 'session-repeat-test';
  const oldSessionId = 'session-repeat-test-old';
  const userId = 'user-repeat-test';
  const productId = 'prod-repeat-test-1';

  beforeAll(async () => {
    prisma = new PrismaClient();
    capRepo = new MerchantCapabilityRepository();
    capResolver = new MerchantCapabilityResolver(capRepo);
    engine = new RevenueIntelligenceEngine({} as any, capResolver, prisma);

    // Clean up test data
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId: { in: [sessionId, oldSessionId] } } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId: { in: [sessionId, oldSessionId] } } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.cart.deleteMany({ where: { sessionId: { in: [sessionId, oldSessionId] } } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: { in: [sessionId, oldSessionId] } } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed test records
    await prisma.user.create({ data: { id: userId, email: 'repeat@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Repeat Purchase Merchant' } });
    
    // Create active session and old session (both for the same user)
    await prisma.session.create({ data: { id: oldSessionId, userId, merchantId, state: 'ACTIVE' } });
    await prisma.session.create({ data: { id: sessionId, userId, merchantId, state: 'ACTIVE' } });

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
        name: 'Daily Vitamin Pack',
        priceMinor: 2500, // ₹25.00
        currency: 'INR',
        active: true,
        description: '<!-- replenishmentDays: 30 -->'
      }
    });

    await prisma.inventory.create({
      data: { merchantId, productId, quantity: 100 }
    });

    // Create a completed order on the old session
    const order = await prisma.commerceOrder.create({
      data: {
        sessionId: oldSessionId,
        merchantId,
        buyerId: userId,
        total: 50.00,
        status: 'completed'
      }
    });

    await prisma.commerceItem.create({
      data: {
        orderId: order.id,
        productId,
        quantity: 2,
        price: 25.00
      }
    });
  });

  afterAll(async () => {
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId: { in: [sessionId, oldSessionId] } } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId: { in: [sessionId, oldSessionId] } } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.cart.deleteMany({ where: { sessionId: { in: [sessionId, oldSessionId] } } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: { in: [sessionId, oldSessionId] } } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. Recommends reorder of last purchased product when buyerRequestedReorder: true is set', async () => {
    const result = await engine.analyze(merchantId, {
      sessionId,
      buyerRequestedReorder: true
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('REPEAT_PURCHASE');
    expect(result!.affectedResources).toContain(productId);
    expect(result!.proposedAction?.actionType).toBe('ADD_PRODUCT');
    expect(result!.proposedAction?.resourceId).toBe(productId);
    expect(result!.proposedAction?.quantity).toBe(2);
    expect(result!.proposedAction?.priceMinor).toBe(2500);
    expect(result!.evidence).toContain('Buyer requested a reorder');
  });

  it('2. Recommends replenishment suggestion when replenishmentDue: true is set', async () => {
    const result = await engine.analyze(merchantId, {
      sessionId,
      replenishmentDue: true
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('REPEAT_PURCHASE');
    expect(result!.affectedResources).toContain(productId);
    expect(result!.proposedAction?.actionType).toBe('ADD_PRODUCT');
    expect(result!.proposedAction?.resourceId).toBe(productId);
    expect(result!.proposedAction?.quantity).toBe(1);
    expect(result!.proposedAction?.priceMinor).toBe(2500);
    expect(result!.evidence).toContain('Replenishment interval of 30 days reached');
  });

  it('3. Does NOT suggest repeat purchase if repeat_purchase skill is disabled', async () => {
    await prisma.merchantGuardrail.update({
      where: { merchantId },
      data: { disabledSkills: ['repeat_purchase'] }
    });

    const result = await engine.analyze(merchantId, {
      sessionId,
      buyerRequestedReorder: true
    });

    expect(result).toBeNull();
  });
});
