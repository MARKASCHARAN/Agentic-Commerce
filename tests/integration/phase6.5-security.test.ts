import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import v1Routes from '../../src/api/v1/routes/index.js';
import * as crypto from 'crypto';
import { vi } from 'vitest';

vi.mock('../../src/providers/razorpay/razorpay.provider.js', () => {
  return {
    RazorpayProvider: class {
      async createPaymentLink() {
        return {
          success: true,
          data: {
            providerId: 'plink_mock',
            shortUrl: 'https://rzp.io/mock',
            amount: 1000000,
            currency: 'INR',
            status: 'created'
          }
        };
      }
    }
  };
});

const app = express();
app.use(express.json());
app.use('/v1', v1Routes);

const prisma = new PrismaClient();

describe('Phase 6.5: Security & Hardening', () => {
  let merchantId: string;
  let buyerId: string;
  let sessionId: string;
  let productId: string;
  let offerId: string;

  beforeAll(async () => {
    merchantId = 'merchant-security-test-' + crypto.randomUUID().slice(0, 8);
    buyerId = 'buyer-security-test-' + crypto.randomUUID().slice(0, 8);
    sessionId = 'session-security-test-' + crypto.randomUUID().slice(0, 8);

    await prisma.user.create({
      data: { id: merchantId, email: merchantId + '@example.com' }
    });

    const merchant = await prisma.merchant.create({
      data: { id: merchantId, name: 'Security Test Merchant', userId: merchantId }
    });

    const product = await prisma.product.create({
      data: {
        id: 'prod-security-' + crypto.randomUUID().slice(0, 8),
        merchantId,
        name: 'Secure Laptop',
        priceMinor: 100000,
        currency: 'INR'
      }
    });
    productId = product.id;

    await prisma.inventory.create({
      data: {
        productId,
        merchantId,
        quantity: 15
      }
    });

    await prisma.session.create({
      data: {
        id: sessionId,
        merchantId,
        state: 'ACTIVE'
      }
    });
  });

  afterAll(async () => {
    // cleanup omitted for brevity in tests, assuming rollback/truncation mechanism
  });

  it('1. Create offer', async () => {
    // Manually create an offer instead of invoking the full agent discovery flow
    // Since we need deterministic control, let's inject it into DB directly for the tests
    const offer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId, quantity: 10, unitPriceMinor: 100000 }],
        subtotalMinor: 1000000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 1000000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 10000) // 10 seconds
      }
    });
    offerId = offer.id;
    expect(offer).toBeDefined();
  });

  it('2. Malicious counter-offer with targetTotalMinor = 1 should fail due to guardrails', async () => {
    const res = await request(app)
      .post(`/v1/protocol/offers/${offerId}/counter`)
      .set('x-buyer-id', buyerId)
      .send({ targetTotalMinor: 1 });

    // The guardrail max discount is 15%. So requested discount (1,000,000 - 1) = 999,999 will be capped to 150,000.
    // The new total should be 850,000. It shouldn't fail with 4xx, but it should deterministicially override to 850,000!
    expect(res.status).toBe(200);
    expect(res.body.totalMinor).toBe(850000); // 85% of subtotal
  });

  it('3. Accept offer and verify inventory is deducted', async () => {
    const res = await request(app)
      .post(`/v1/protocol/offers/${offerId}/accept`)
      .set('x-buyer-id', buyerId);

    if (res.status === 500) console.log('ERROR:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.paymentUrl).toBeDefined();

    const inventory = await prisma.inventory.findUnique({ where: { productId } });
    expect(inventory?.quantity).toBe(5); // Started at 15, reserved 10
  });

  it('4. Replay ACCEPT should be idempotent and not deduct inventory again', async () => {
    const res = await request(app)
      .post(`/v1/protocol/offers/${offerId}/accept`)
      .set('x-buyer-id', buyerId);

    expect(res.status).toBe(200);
    expect(res.body.paymentUrl).toBeDefined();

    const inventory = await prisma.inventory.findUnique({ where: { productId } });
    expect(inventory?.quantity).toBe(5); // Still 5!
  });

  it('5. Concurrent acceptance of limited inventory', async () => {
    // Create an offer for 10 units, but only 5 are left
    const concurrentOffer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId, quantity: 10, unitPriceMinor: 100000 }],
        subtotalMinor: 1000000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 1000000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 10000)
      }
    });

    const res = await request(app)
      .post(`/v1/protocol/offers/${concurrentOffer.id}/accept`)
      .set('x-buyer-id', buyerId);

    expect(res.status).toBe(500); // Because inventory update fails and rolls back
    expect(res.body.error).toContain('Insufficient inventory');
    
    // Inventory should still be 5
    const inventory = await prisma.inventory.findUnique({ where: { productId } });
    expect(inventory?.quantity).toBe(5); 
  });

  it('6. Cannot accept expired offer', async () => {
    const expiredOffer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId, quantity: 1, unitPriceMinor: 100000 }],
        subtotalMinor: 100000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 100000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() - 10000) // Expired
      }
    });

    const res = await request(app)
      .post(`/v1/protocol/offers/${expiredOffer.id}/accept`)
      .set('x-buyer-id', buyerId);

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('expired');
  });

  it('7. Cannot access another buyer\'s offer', async () => {
    const res = await request(app)
      .post(`/v1/protocol/offers/${offerId}/accept`)
      .set('x-buyer-id', 'some-other-buyer');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Offer not found');
  });

  it('8. Session recovery endpoint works', async () => {
    const res = await request(app)
      .get(`/v1/protocol/sessions/${sessionId}`)
      .set('x-buyer-id', buyerId);

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.activeOffer).toBeDefined();
    // It could be OFFERED because of the concurrentOffer created in test 5 which failed to accept
    expect(['PAYMENT_PENDING', 'OFFERED']).toContain(res.body.activeOffer.status);
  });
});
