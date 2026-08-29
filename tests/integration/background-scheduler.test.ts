import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BackgroundCommerceScanner } from '../../src/agent/scheduler/background-scanner';
import { MerchantCapabilityRepository } from '../../src/database/repositories/merchant-capability.repository';

describe('Phase 34 & Phase 35: Background Recovery & Replenishment Schedulers', () => {
  let prisma: PrismaClient;
  let capRepo: MerchantCapabilityRepository;
  let scanner: BackgroundCommerceScanner;

  const merchantId = 'merchant-bg-scan-test';
  const userId = 'user-bg-scan-test';
  const sessionIdIdle = 'sess-bg-idle-cart';
  const sessionIdOrder = 'sess-bg-completed-order';
  const productIdConsumable = 'prod-bg-coffee';
  const productIdCart = 'prod-bg-cart-item';

  beforeAll(async () => {
    prisma = new PrismaClient();
    capRepo = new MerchantCapabilityRepository();
    scanner = new BackgroundCommerceScanner(prisma);

    // Cleanup
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId: { in: [sessionIdIdle, sessionIdOrder] } } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId: { in: [sessionIdIdle, sessionIdOrder] } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: [productIdConsumable, productIdCart] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productIdConsumable, productIdCart] } } });
    await prisma.cart.deleteMany({ where: { sessionId: { in: [sessionIdIdle, sessionIdOrder] } } });
    await prisma.revenueOpportunityLog.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: { in: [sessionIdIdle, sessionIdOrder] } } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // Seed
    await prisma.user.create({ data: { id: userId, email: 'bg@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Background Scanner Merchant' } });
    await prisma.session.create({ data: { id: sessionIdIdle, userId, merchantId, state: 'ACTIVE' } });
    await prisma.session.create({ data: { id: sessionIdOrder, userId, merchantId, state: 'ACTIVE' } });

    await capRepo.setCapabilities(merchantId, ['catalog' as any, 'inventory' as any]);

    // Create item with replenishment tag
    await prisma.product.create({
      data: {
        id: productIdConsumable,
        merchantId,
        name: 'Whole Bean Coffee',
        priceMinor: 1500,
        currency: 'INR',
        active: true,
        description: '<!-- replenishmentDays: 30 -->'
      }
    });

    await prisma.product.create({
      data: {
        id: productIdCart,
        merchantId,
        name: 'Cart Item',
        priceMinor: 2500,
        currency: 'INR',
        active: true,
        description: '<!-- recoveryDiscountBps: 1000 -->'
      }
    });

    await prisma.inventory.create({ data: { merchantId, productId: productIdConsumable, quantity: 50 } });
    await prisma.inventory.create({ data: { merchantId, productId: productIdCart, quantity: 50 } });

    // 1. Seed idle abandoned cart (15 minutes ago)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.cart.create({
      data: {
        sessionId: sessionIdIdle,
        items: [{ productId: productIdCart, quantity: 1 }],
        updatedAt: fifteenMinsAgo
      }
    });

    // 2. Seed completed order for replenishment lookup
    const order = await prisma.commerceOrder.create({
      data: {
        sessionId: sessionIdOrder,
        merchantId,
        buyerId: userId,
        total: 15.00,
        status: 'completed'
      }
    });

    await prisma.commerceItem.create({
      data: {
        orderId: order.id,
        productId: productIdConsumable,
        quantity: 1,
        price: 15.00
      }
    });
  });

  afterAll(async () => {
    await prisma.commerceItem.deleteMany({ where: { order: { sessionId: { in: [sessionIdIdle, sessionIdOrder] } } } });
    await prisma.commerceOrder.deleteMany({ where: { sessionId: { in: [sessionIdIdle, sessionIdOrder] } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: [productIdConsumable, productIdCart] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productIdConsumable, productIdCart] } } });
    await prisma.cart.deleteMany({ where: { sessionId: { in: [sessionIdIdle, sessionIdOrder] } } });
    await prisma.revenueOpportunityLog.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: { in: [sessionIdIdle, sessionIdOrder] } } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. BackgroundCommerceScanner automatically discovers abandoned cart recovery and repeat replenishment opportunities', async () => {
    const result = await scanner.scanAll(merchantId);

    expect(result.recoveryCount).toBeGreaterThanOrEqual(1);
    expect(result.repeatCount).toBeGreaterThanOrEqual(1);

    // Verify opportunities logged in DB
    const recoveryLog = await prisma.revenueOpportunityLog.findFirst({
      where: { sessionId: sessionIdIdle, opportunityType: 'RECOVERY' }
    });
    expect(recoveryLog).not.toBeNull();

    const repeatLog = await prisma.revenueOpportunityLog.findFirst({
      where: { sessionId: sessionIdOrder, opportunityType: 'REPEAT_PURCHASE' }
    });
    expect(repeatLog).not.toBeNull();
  });
});
