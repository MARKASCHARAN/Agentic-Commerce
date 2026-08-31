import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import supertest from 'supertest';
import v1Routes from '../../src/api/v1/routes/index.js';
import { BullMQOutboxWorker } from '../../src/agent/outbox/bullmq-worker.js';
import { OutboxRepository } from '../../src/database/repositories/outbox.repository.js';
import { createPaymentReconciliationHandler } from '../../src/agent/payments/reconciliation.js';

vi.mock('../../src/providers/razorpay/razorpay.provider.js', () => {
  return {
    RazorpayProvider: class {
      async createPaymentLink() {
        return {
          success: true,
          data: {
            id: 'pay_link_mock_' + Date.now(),
            shortUrl: 'https://rzp.io/i/mock' + Date.now()
          }
        };
      }
    }
  };
});

describe('Phase 7: Merchant Agent Factory E2E', () => {
  let app: express.Application;
  const prisma = new PrismaClient();
  let worker: BullMQOutboxWorker;
  const queueName = 'agentic-commerce-outbox-test-factory';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  let merchantId: string;
  let offerId: string;
  let orderId: string;
  let sessionId = 'session_fac_' + Date.now();
  let buyerId = 'buyer_fac_' + Date.now();

  beforeAll(async () => {
    app = express();
    app.use('/v1/webhooks/razorpay', express.raw({ type: 'application/json' }));
    app.use(express.json());
    app.use('/v1', v1Routes);

    const outboxRepo = new OutboxRepository(prisma);
    worker = new BullMQOutboxWorker(outboxRepo, { queueName, redisUrl, concurrency: 1 });
    worker.registerHandler('payment.webhook', createPaymentReconciliationHandler(prisma));
    worker.start();
  });

  afterAll(async () => {
    await worker.stop();
    await prisma.$disconnect();
  });

  it('1. Should provision a new merchant via Factory API', async () => {
    const res = await supertest(app)
      .post('/v1/factory/merchants')
      .send({
        name: "Acme Electronics Test",
        businessType: "electronics",
        pricing: {
          maxDiscountBps: 800, // 8% max discount
          minimumMarginBps: 1200
        },
        negotiation: {
          enabled: true,
          maxRounds: 4
        },
        revenueStrategy: {
          primary: "CONVERSION",
          secondary: ["AOV", "MARGIN"]
        },
        skills: {
          crossSell: true,
          upsell: true,
          invalidSkill: true
        },
        autonomy: {
          autoApproveBelowMinor: 5000000,
          humanApprovalAboveMinor: 5000000
        },
        capabilities: [
          "catalog",
          "inventory",
          "pricing",
          "negotiation",
          "invalidCapability"
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.merchantId).toBeDefined();
    
    // Assert Allowlist worked
    expect(res.body.provisionedCapabilities).toContain('catalog');
    expect(res.body.provisionedCapabilities).not.toContain('invalidCapability');
    
    // Assert Skills were provisioned due to capabilities
    expect(res.body.provisionedSkills.crossSell).toBe(true);

    merchantId = res.body.merchantId;

    // Verify DB states
    const guardrail = await prisma.merchantGuardrail.findUnique({ where: { merchantId } });
    expect(guardrail?.maxDiscountBps).toBe(800);
    expect(guardrail?.negotiationEnabled).toBe(true);

    const strategy = await prisma.merchantStrategy.findUnique({ where: { merchantId } });
    expect(strategy?.primary).toBe('CONVERSION');
  });

  it('2. Should provision catalog and inventory', async () => {
    // 2a. Catalog
    const catalogRes = await supertest(app)
      .post(`/v1/factory/merchants/${merchantId}/catalog`)
      .send({
        products: [
          {
            externalId: "LAPTOP-001",
            name: "ThinkPro 14",
            description: "32GB RAM, 1TB SSD",
            priceMinor: 1000000, // 10,000 INR
            currency: "INR",
            active: true
          }
        ]
      });

    expect(catalogRes.status).toBe(200);
    expect(catalogRes.body.created).toBe(1);
    
    const productId = catalogRes.body.products[0].productId;

    // 2b. Inventory
    const inventoryRes = await supertest(app)
      .post(`/v1/factory/merchants/${merchantId}/inventory`)
      .send({
        items: [
          {
            productId: productId,
            quantity: 50
          }
        ]
      });

    expect(inventoryRes.status).toBe(200);
    expect(inventoryRes.body.updated).toBe(1);
  });

  it('3. Should simulate a COMMERCE_REQUEST and dynamically apply guardrails', async () => {
    // Fetch product
    const product = await prisma.product.findFirst({ where: { merchantId } });
    
    // Create an initial offer directly bypassing AgentRuntime for deterministic test
    const offerRes = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [{ productId: product!.id, quantity: 1, unitPriceMinor: 1000000 }],
        subtotalMinor: 1000000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 1000000,
        currency: 'INR',
        status: 'OFFERED',
        expiresAt: new Date(Date.now() + 100000)
      }
    });

    offerId = offerRes.id;

    // Attempt a counter offer that asks for 20% discount (target 80,000)
    // The configured maxDiscountBps is 800 (8%). So it should cap at 8,000 discount (92,000 total).
    const counterRes = await supertest(app)
      .post(`/v1/protocol/offers/${offerId}/counter`)
      .set('x-buyer-id', buyerId)
      .send({
        merchantId,
        targetTotalMinor: 800000 // 8,000 INR
      });

    expect(counterRes.status).toBe(200);
    expect(counterRes.body.status).toBe('COUNTERED');
    expect(counterRes.body.totalMinor).toBe(920000); // 8% limit: 80,000 minor
    expect(counterRes.body.discountMinor).toBe(80000); 
  });

  it('4. Should accept offer and process payment webhook seamlessly', async () => {
    // Need a dummy RevenueOpportunityLog to avoid foreign key issues during accept / payment intent creation
    // Wait, the test uses the real v1.routes which doesn't check for RevenueOpportunityLog unless passed, but the `acceptOffer` route just creates a payment link.
    // However, does the payment intent creation require a session? Yes, PaymentIntent is linked to CommerceOrder, CommerceOrder is linked to Session.
    
    // Let's create a Session first, which is needed by CommerceOrder
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: null,
        merchantId,
        state: 'ACTIVE'
      }
    });

    // ACCEPT
    const acceptRes = await supertest(app)
      .post(`/v1/protocol/offers/${offerId}/accept`)
      .set('x-buyer-id', buyerId)
      .send({ buyerId });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.orderId).toBeDefined();
    expect(acceptRes.body.paymentUrl).toBeDefined();

    orderId = acceptRes.body.orderId;

    // WEBHOOK
    const payloadObj = {
      entity: 'event',
      account_id: 'acc_123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_fac_test_' + Date.now(),
            amount: 920000,
            currency: 'INR',
            status: 'captured',
            order_id: 'rzp_fac_test_123',
            notes: {
              receipt: orderId
            }
          }
        }
      },
      created_at: Math.floor(Date.now() / 1000)
    };
    
    const eventId = 'evt_fac_' + Date.now();
    
    // Create the WebhookEvent first
    await prisma.webhookEvent.create({
      data: {
        id: eventId,
        provider: 'razorpay',
        providerEventId: payloadObj.payload.payment.entity.id,
        eventType: 'payment.captured',
        payload: payloadObj
      }
    });
    
    const outboxEventRes = await prisma.outboxEvent.create({
      data: {
        eventId: eventId,
        eventType: 'payment.webhook',
        aggregateType: 'WebhookEvent',
        aggregateId: eventId,
        payload: {
          eventId: eventId,
          type: 'payment.captured',
          providerEntityId: payloadObj.payload.payment.entity.id,
          rawPayload: payloadObj
        }
      }
    });

    const handler = createPaymentReconciliationHandler(prisma);
    await handler(outboxEventRes as any);

    // Verify DB states
    const updatedOrder = await prisma.commerceOrder.findUnique({ where: { id: orderId } });
    expect(updatedOrder?.status).toBe('captured');

    const updatedOffer = await prisma.offer.findUnique({ where: { id: offerId } });
    expect(updatedOffer?.status).toBe('PAID');
  });
});
