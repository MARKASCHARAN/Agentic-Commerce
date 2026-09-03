import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import crypto from 'crypto';

describe('Phase 33: Conversion Optimization Detector', () => {
  let prisma: PrismaClient;
  let capRepo: MerchantCapabilityRepository;
  let capResolver: MerchantCapabilityResolver;
  let engine: RevenueIntelligenceEngine;

  const merchantId = 'merchant-conv-opt';
  const sessionId = 'session-conv-opt';
  const userId = 'user-conv-opt';
  const primaryProductId = 'prod-conv-opt-primary';
  const altProductId = 'prod-conv-opt-alt';

  beforeAll(async () => {
    prisma = new PrismaClient();
    capRepo = new MerchantCapabilityRepository();
    capResolver = new MerchantCapabilityResolver(capRepo);
    engine = new RevenueIntelligenceEngine({} as any, capResolver, prisma);

    // Clean up test data
    await prisma.inventory.deleteMany({ where: { productId: { in: [primaryProductId, altProductId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [primaryProductId, altProductId] } } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed test merchant & capabilities
    await prisma.user.create({ data: { id: userId, email: 'conv-opt@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Conversion Opt Merchant' } });
    await prisma.session.create({ data: { id: sessionId, merchantId, state: 'ACTIVE' } });

    await capRepo.setCapabilities(merchantId, [
      'catalog' as any,
      'inventory' as any
    ]);

    // Create primary and alternative products
    await prisma.product.create({
      data: {
        id: primaryProductId,
        merchantId,
        name: 'Standard Laptop',
        priceMinor: 7500000, // ₹75000
        currency: 'INR',
        active: true,
        description: `<!-- alt: ["${altProductId}"] --><!-- neg: { "enabled": true, "negotiable": true, "maxDiscountBps": 1000 } --> Standard laptop description`
      }
    });

    await prisma.product.create({
      data: {
        id: altProductId,
        merchantId,
        name: 'Alternative Premium Laptop',
        priceMinor: 9500000, // ₹95000
        currency: 'INR',
        active: true,
        description: `Premium laptop alternative`
      }
    });

    await prisma.inventory.create({
      data: { merchantId, productId: primaryProductId, quantity: 5 }
    });
  });

  afterAll(async () => {
    await prisma.inventory.deleteMany({ where: { productId: { in: [primaryProductId, altProductId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [primaryProductId, altProductId] } } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. Recommends alternative product if buyer shows hesitation and alternative is in stock', async () => {
    // Set alternative product in-stock
    await prisma.inventory.upsert({
      where: { productId: altProductId },
      update: { quantity: 10 },
      create: { merchantId, productId: altProductId, quantity: 10 }
    });

    const result = await engine.analyze(merchantId, {
      sessionId,
      buyerHesitated: true,
      currentProductId: primaryProductId
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('RECOVERY');
    expect(result!.affectedResources).toContain(altProductId);
    expect(result!.proposedAction?.actionType).toBe('ADD_PRODUCT');
    expect(result!.proposedAction?.resourceId).toBe(altProductId);
    expect(result!.proposedAction?.priceMinor).toBe(9500000);
  });

  it('2. Does NOT recommend alternative product if alternative is out of stock', async () => {
    // Set alternative product out of stock
    await prisma.inventory.update({
      where: { productId: altProductId },
      data: { quantity: 0 }
    });

    const result = await engine.analyze(merchantId, {
      sessionId,
      buyerHesitated: true,
      currentProductId: primaryProductId
    });

    // Since alternative is out of stock, no alternative should be recommended
    expect(result).toBeNull();
  });

  it('3. Proposes discount on price objection based on negotiation policy description', async () => {
    const result = await engine.analyze(merchantId, {
      sessionId,
      priceObjection: true,
      currentProductId: primaryProductId
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('RECOVERY');
    expect(result!.affectedResources).toContain(primaryProductId);
    expect(result!.proposedAction?.actionType).toBe('APPLY_DISCOUNT');
    expect(result!.proposedAction?.resourceId).toBe(primaryProductId);
    expect(result!.proposedAction?.priceMinor).toBe(6750000); // 7500000 - 10% (750000) = 6750000
    expect(result!.proposedAction?.discountMinor).toBe(750000);
  });
});
