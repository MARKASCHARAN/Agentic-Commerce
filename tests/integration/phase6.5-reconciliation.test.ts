import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import webhookRoutes from '../../src/api/routes/webhooks.js';
import * as crypto from 'crypto';
import { BullMQOutboxWorker } from '../../src/agent/outbox/bullmq-worker.js';
import { OutboxRepository } from '../../src/database/repositories/outbox.repository.js';
import { createPaymentReconciliationHandler } from '../../src/agent/payments/reconciliation.js';
import { Queue } from 'bullmq';
import { OutboxPublisher } from '../../src/agent/outbox/publisher.js';
import { RazorpayWebhookAdapter } from '../../src/providers/razorpay/razorpay.webhook.js';

const app = express();
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));
app.use('/api/webhooks', webhookRoutes);

const prisma = new PrismaClient();

describe('Phase 6.5: Webhook Reconciliation', () => {
  let merchantId: string;
  let buyerId: string;
  let sessionId: string;
  let orderId: string;
  let offerId: string;
  let worker: BullMQOutboxWorker;
  let publisher: OutboxPublisher;

  beforeAll(async () => {
    merchantId = 'merchant-recon-' + crypto.randomUUID().slice(0, 8);
    buyerId = 'buyer-recon-' + crypto.randomUUID().slice(0, 8);
    sessionId = 'session-recon-' + crypto.randomUUID().slice(0, 8);
    orderId = 'order-recon-' + crypto.randomUUID().slice(0, 8);

    await prisma.user.create({ data: { id: merchantId, email: merchantId + '@example.com' } });
    await prisma.merchant.create({ data: { id: merchantId, name: 'Recon Merchant', userId: merchantId } });

    await prisma.session.create({ data: { id: sessionId, merchantId, state: 'ACTIVE' } });

    const order = await prisma.commerceOrder.create({
      data: {
        id: orderId,
        merchantId,
        sessionId,
        total: 1000,
        status: 'created',
      }
    });

    const offer = await prisma.offer.create({
      data: {
        merchantId,
        buyerId,
        sessionId,
        items: [],
        subtotalMinor: 100000,
        discountMinor: 0,
        shippingMinor: 0,
        totalMinor: 100000,
        currency: 'INR',
        status: 'PAYMENT_PENDING',
        orderId: order.id,
        expiresAt: new Date(Date.now() + 100000)
      }
    });
    offerId = offer.id;

    await prisma.paymentIntent.create({
      data: {
        orderId: order.id,
        amount: 100000,
        status: 'created',
        idempotency_key: `accept_${offer.id}`
      }
    });

    await prisma.revenueOpportunityLog.create({
      data: {
        merchantId,
        orderId: order.id,
        sessionId,
        status: 'ACCEPTED',
        expectedImpactMinor: 100000,
        opportunityType: 'SALES_CONVERSION'
      }
    });

    // Start Worker
    const outboxRepo = new OutboxRepository(prisma);
    const queueName = 'agentic-commerce-outbox-test-recon';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    worker = new BullMQOutboxWorker(outboxRepo, { queueName, redisUrl, concurrency: 1 });
    worker.registerHandler('payment.webhook', createPaymentReconciliationHandler(prisma));
    worker.start();

    const bullQueue = new Queue(queueName, { connection: { url: redisUrl } });
    publisher = new OutboxPublisher(outboxRepo, bullQueue);
    publisher.start();
  });

  afterAll(async () => {
    if (publisher) await publisher.stop();
    if (worker) await worker.stop();
  });

  it('1. Razorpay payment.captured webhook should reconcile order and offer', async () => {
    // Generate valid webhook payload and signature
    const adapter = new RazorpayWebhookAdapter(process.env.RAZORPAY_WEBHOOK_SECRET || '');
    const payloadObj = {
      entity: 'event',
      account_id: 'acc_123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_test_' + crypto.randomUUID().slice(0, 8),
            amount: 100000,
            currency: 'INR',
            status: 'captured',
            order_id: 'rzp_test_order_123',
            notes: {
              receipt: orderId
            }
          }
        }
      },
      created_at: 1234567890
    };
    
    const payloadStr = JSON.stringify(payloadObj);
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
                            .update(payloadStr)
                            .digest('hex');

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payloadStr);

    // Check outbox event directly
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { eventType: 'payment.webhook' },
      orderBy: { createdAt: 'desc' }
    });
    
    // Instead of relying on Redis/BullMQ in CI, execute handler directly for the test
    const handler = createPaymentReconciliationHandler(prisma);
    if (!outboxEvent) {
      throw new Error('Outbox event not found');
    }
    
    await handler(outboxEvent as any);

    const updatedOrder = await prisma.commerceOrder.findUnique({ where: { id: orderId } });
    expect(updatedOrder?.status).toBe('captured');

    const updatedOffer = await prisma.offer.findUnique({ where: { id: offerId } });
    expect(updatedOffer?.status).toBe('PAID');

    const intent = await prisma.paymentIntent.findFirst({ where: { orderId } });
    expect(intent?.status).toBe('captured');

    const revLog = await prisma.revenueOpportunityLog.findFirst({ where: { orderId } });
    expect(revLog?.status).toBe('CONVERTED');
  });
});
