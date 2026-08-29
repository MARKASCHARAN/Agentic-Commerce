import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BullMQOutboxWorker, BullMQWorkerConfig } from '../../src/agent/outbox/bullmq-worker';
import { OutboxRepository } from '../../src/database/repositories/outbox.repository';
import { OutboxPublisher } from '../../src/agent/outbox/publisher';
import { Queue } from 'bullmq';
import { RevenueTracker } from '../../src/agent/intelligence/revenue-tracker';
import { RevenueAnalytics } from '../../src/agent/intelligence/revenue-analytics';
import { RevenueOpportunity } from '../../src/agent/intelligence/types';
import crypto from 'crypto';

const queueName = 'test-revenue-queue';
const redisUrl = 'redis://localhost:6380'; 

describe.sequential('Phase 20: Measurable Revenue Optimization', () => {
  let prisma: PrismaClient;
  let outboxRepo: OutboxRepository;
  let worker: BullMQOutboxWorker;
  let publisher: OutboxPublisher;
  let queue: Queue;
  let tracker: RevenueTracker;
  let analytics: RevenueAnalytics;

  beforeAll(async () => {
    prisma = new PrismaClient();
    outboxRepo = new OutboxRepository(prisma);

    await prisma.revenueOpportunityLog.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.paymentIntent.deleteMany({});
    await prisma.commerceItem.deleteMany({});
    await prisma.commerceOrder.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.toolCall.deleteMany({});
    await prisma.skillExecution.deleteMany({});
    await prisma.session.deleteMany({});

    queue = new Queue(queueName, { connection: { url: redisUrl } });
    await queue.drain();

    publisher = new OutboxPublisher(outboxRepo, queue, {
      batchSize: 10,
      pollIntervalMs: 50,
      staleTimeoutMs: 60000,
    });
    
    tracker = new RevenueTracker(prisma);
    analytics = new RevenueAnalytics(prisma);

    const config: BullMQWorkerConfig = {
      queueName,
      redisUrl,
      concurrency: 1
    };
    worker = new BullMQOutboxWorker(outboxRepo, config);

    worker.registerHandler('PAYMENT_SUCCESS', async (event) => {
      const payload = event.payload as any;
      if (payload.opportunityId && payload.realizedImpactMinor) {
        await tracker.recordConversion(
          payload.opportunityId, 
          payload.realizedImpactMinor, 
          payload.orderId, 
          payload.paymentIntentId
        );
      }
    });

    worker.start();
  });

  afterAll(async () => {
    await worker.stop();
    await queue.close();
    await prisma.$disconnect();
  });

  it('1. Detects opportunity, logs proposal, and records acceptance', async () => {
    const merchantId = 'merchant-demo-1';

    const session = await prisma.session.create({ data: { state: 'ACTIVE' } });

    const opportunity: RevenueOpportunity = {
      id: crypto.randomUUID(),
      merchantId,
      sessionId: session.id,
      type: 'UPSELL',
      affectedResources: ['prod-socks-1'],
      expectedImpactValue: 699,
      confidence: 0.9,
      evidence: 'test',
      proposedAction: {
        actionType: 'ADD_PRODUCT',
        priceMinor: 699
      }
    };

    await tracker.logProposal(opportunity);
    
    let log = await prisma.revenueOpportunityLog.findUnique({ where: { id: opportunity.id }});
    expect(log).not.toBeNull();
    expect(log!.status).toBe('PROPOSED');
    expect(log!.expectedImpactMinor).toBe(699);

    await tracker.recordAcceptance(opportunity.id);

    log = await prisma.revenueOpportunityLog.findUnique({ where: { id: opportunity.id }});
    expect(log!.status).toBe('ACCEPTED');
  });

  it('2. Successful payment webhook completes conversion and updates analytics (Idempotently)', async () => {
    const merchantId = 'merchant-demo-1';

    const session = await prisma.session.create({ data: { state: 'ACTIVE' } });
    const oppId = crypto.randomUUID();

    const opportunity: RevenueOpportunity = {
      id: oppId,
      merchantId,
      sessionId: session.id,
      type: 'UPSELL',
      affectedResources: ['prod-socks-1'],
      expectedImpactValue: 699,
      confidence: 0.9,
      evidence: 'test',
      proposedAction: {
        actionType: 'ADD_PRODUCT',
        priceMinor: 699
      }
    };

    await tracker.logProposal(opportunity);
    await tracker.recordAcceptance(oppId);

    await outboxRepo.create({
      eventId: crypto.randomUUID(),
      eventType: 'PAYMENT_SUCCESS',
      aggregateType: 'PAYMENT',
      aggregateId: 'pay-123',
      payload: {
        opportunityId: oppId,
        realizedImpactMinor: 699,
        orderId: 'order-123',
        paymentIntentId: 'pay-123'
      }
    });
    await publisher.tick();

    await new Promise(resolve => setTimeout(resolve, 1500));

    let log = await prisma.revenueOpportunityLog.findUnique({ where: { id: oppId }});
    expect(log!.status).toBe('CONVERTED');
    expect(log!.realizedImpactMinor).toBe(699);

    await outboxRepo.create({
      eventId: crypto.randomUUID(),
      eventType: 'PAYMENT_SUCCESS',
      aggregateType: 'PAYMENT',
      aggregateId: 'pay-123',
      payload: {
        opportunityId: oppId,
        realizedImpactMinor: 1000, 
        orderId: 'order-123',
        paymentIntentId: 'pay-123'
      }
    });
    await publisher.tick();

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    log = await prisma.revenueOpportunityLog.findUnique({ where: { id: oppId }});
    expect(log!.realizedImpactMinor).toBe(699); 

    const metrics = await analytics.getMetricsForMerchant(merchantId);
    expect(metrics.totalProposals).toBe(2);
    expect(metrics.totalAccepted).toBe(2);
    expect(metrics.totalConverted).toBe(1);
    expect(metrics.attributedIncrementalRevenueMinor).toBe(699);
  });

  it('3. Failed payment does not convert the opportunity', async () => {

    const merchantId = 'merchant-demo-1';
    const session = await prisma.session.create({ data: { state: 'ACTIVE' } });
    const oppId = crypto.randomUUID();

    await tracker.logProposal({
      id: oppId, merchantId, sessionId: session.id, type: 'UPSELL', affectedResources: [],
      expectedImpactValue: 500, confidence: 1, evidence: '', proposedAction: { actionType: 'ADD_PRODUCT' }
    } as any);

    await tracker.recordAcceptance(oppId);

    await outboxRepo.create({
      eventId: crypto.randomUUID(),
      eventType: 'PAYMENT_FAILED',
      aggregateType: 'PAYMENT',
      aggregateId: 'pay-999',
      payload: { opportunityId: oppId }
    });
    await publisher.tick();

    await new Promise(resolve => setTimeout(resolve, 1500));

    const log = await prisma.revenueOpportunityLog.findUnique({ where: { id: oppId }});
    expect(log!.status).toBe('ACCEPTED'); 
    expect(log!.realizedImpactMinor).toBe(0);
  });

  it('4. Multi-business model aggregation (D2C vs SaaS)', async () => {
    const merchantSaaS = 'merchant-saas';
    const session = await prisma.session.create({ data: { state: 'ACTIVE' } });
    const oppId = crypto.randomUUID();

    await tracker.logProposal({
      id: oppId, merchantId: merchantSaaS, sessionId: session.id, type: 'UPGRADE', affectedResources: [],
      expectedImpactValue: 99900, confidence: 1, evidence: '', proposedAction: { actionType: 'UPGRADE_PLAN' }
    } as any);
    await tracker.recordAcceptance(oppId);
    
    await outboxRepo.create({
      eventId: crypto.randomUUID(),
      eventType: 'PAYMENT_SUCCESS',
      aggregateType: 'PAYMENT',
      aggregateId: 'pay-saas-1',
      payload: {
        opportunityId: oppId,
        realizedImpactMinor: 99900
      }
    });
    await publisher.tick();

    await new Promise(resolve => setTimeout(resolve, 1500));

    const metricsSaaS = await analytics.getMetricsForMerchant(merchantSaaS);
    expect(metricsSaaS.totalProposals).toBe(1);
    expect(metricsSaaS.totalConverted).toBe(1);
    expect(metricsSaaS.attributedIncrementalRevenueMinor).toBe(99900);

    const metricsD2C = await analytics.getMetricsForMerchant('merchant-demo-1');
    expect(metricsD2C.attributedIncrementalRevenueMinor).toBe(699); 
  });
});
