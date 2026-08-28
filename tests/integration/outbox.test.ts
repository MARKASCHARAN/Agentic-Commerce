import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { OutboxRepository } from '../../src/database/repositories/outbox.repository';
import { OutboxProcessor } from '../../src/agent/outbox/processor';
import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { WebhookRepository } from '../../src/database/repositories/webhook.repository';
import { ReconciliationEngine } from '../../src/agent/idempotency/reconciliation-engine';
import { EventEmitter } from 'events';
import crypto from 'crypto';

describe.sequential('Phase 16: Durable Outbox', () => {
  let prisma: PrismaClient;
  let outboxRepo: OutboxRepository;

  beforeAll(() => {
    prisma = new PrismaClient();
    outboxRepo = new OutboxRepository(prisma);
  });

  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany({});
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({});
    await prisma.$disconnect();
  });

  describe('1. Outbox Processor', () => {
    it('1a. Fetches pending events, processes, marks DELIVERED', async () => {
      const eventId = crypto.randomUUID();
      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_test_001',
        payload: { amount: 1000 },
      });

      const pending = await outboxRepo.findPending(10);
      expect(pending.length).toBe(1);
      expect(pending[0].eventId).toBe(eventId);

      const processor = new OutboxProcessor(outboxRepo, {
        batchSize: 10,
        pollIntervalMs: 50,
        maxAttempts: 3,
        backoffBaseMs: 100,
        staleTimeoutMs: 60000,
      });

      let handledPayload: any = null;
      processor.registerHandler('PAYMENT_RECONCILED', async (event) => {
        handledPayload = event.payload;
      });

      const processed = await processor.tick();
      expect(processed).toBe(1);
      expect(handledPayload).toMatchObject({ amount: 1000 });

      const delivered = await outboxRepo.getByEventId(eventId);
      expect(delivered!.status).toBe('DELIVERED');
      expect(delivered!.processedAt).not.toBeNull();
    });

    it('1b. Handler failure with retries remaining returns event to PENDING', async () => {
      const eventId = crypto.randomUUID();
      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_retry_001',
        payload: { amount: 500 },
      });

      const processor = new OutboxProcessor(outboxRepo, {
        batchSize: 10,
        pollIntervalMs: 50,
        maxAttempts: 3,
        backoffBaseMs: 10,
        staleTimeoutMs: 60000,
      });

      processor.registerHandler('PAYMENT_RECONCILED', async () => {
        throw new Error('Transient failure');
      });

      await processor.tick();

      const event = await outboxRepo.getByEventId(eventId);
      expect(event!.status).toBe('PENDING');
      expect(event!.attempts).toBe(1);
      expect(event!.lastError).toMatchObject({ reason: 'Transient failure' });
    });

    it('1c. Handler failure at max attempts marks FAILED permanently', async () => {
      const eventId = crypto.randomUUID();
      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_fail_001',
        payload: { amount: 200 },
      });

      const processor = new OutboxProcessor(outboxRepo, {
        batchSize: 10,
        pollIntervalMs: 50,
        maxAttempts: 1,
        backoffBaseMs: 10,
        staleTimeoutMs: 300000,
      });

      processor.registerHandler('PAYMENT_RECONCILED', async () => {
        throw new Error('Permanent failure');
      });

      await processor.tick();

      const event = await outboxRepo.getByEventId(eventId);
      expect(event!.status).toBe('FAILED');
      expect(event!.lastError).toMatchObject({ reason: 'Permanent failure' });
    });

    it('1d. No registered handler marks event FAILED', async () => {
      const eventId = crypto.randomUUID();
      await outboxRepo.create({
        eventId,
        eventType: 'UNKNOWN_EVENT_TYPE',
        aggregateType: 'test',
        aggregateId: 'test_001',
        payload: {},
      });

      const processor = new OutboxProcessor(outboxRepo, {
        batchSize: 10,
        pollIntervalMs: 50,
        maxAttempts: 3,
        backoffBaseMs: 10,
        staleTimeoutMs: 300000,
      });

      await processor.tick();

      const event = await outboxRepo.getByEventId(eventId);
      expect(event!.status).toBe('FAILED');
      expect(event!.lastError).toMatchObject({
        reason: 'No handler registered for event type: UNKNOWN_EVENT_TYPE',
      });
    });

    it('1e. Stale PROCESSING events are recovered back to PENDING', async () => {
      const eventId = crypto.randomUUID();
      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_stale_001',
        payload: { amount: 300 },
      });

      await prisma.outboxEvent.update({
        where: { eventId },
        data: {
          status: 'PROCESSING',
          updatedAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      });

      const staleEvent = await outboxRepo.getByEventId(eventId);
      expect(staleEvent!.status).toBe('PROCESSING');

      const recovered = await outboxRepo.resetStaleProcessing(5 * 60 * 1000);
      expect(recovered).toBe(1);

      const afterRecovery = await outboxRepo.getByEventId(eventId);
      expect(afterRecovery!.status).toBe('PENDING');
    });
  });

  describe('2. Concurrency Tests', () => {
    it('2a. 100 workers claiming same event: only one owns it', async () => {
      const eventId = crypto.randomUUID();
      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_concurrent_001',
        payload: { amount: 5000 },
      });

      const workers = Array.from({ length: 100 }, () =>
        outboxRepo.claimNext(1)
      );

      const results = await Promise.allSettled(workers);

      const claimed = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<any[]>).value)
        .filter((rows) => rows.length > 0);

      expect(claimed.length).toBe(1);

      const event = await outboxRepo.getByEventId(eventId);
      expect(event!.status).toBe('PROCESSING');
      expect(event!.attempts).toBe(1);
    });

    it('2b. Different events can be claimed independently by different workers', async () => {
      const eventIds = Array.from({ length: 5 }, () => crypto.randomUUID());
      for (const eid of eventIds) {
        await outboxRepo.create({
          eventId: eid,
          eventType: 'PAYMENT_RECONCILED',
          aggregateType: 'payment',
          aggregateId: 'pay_' + eid.slice(0, 8),
          payload: { id: eid },
        });
      }

      const workers = Array.from({ length: 5 }, () =>
        outboxRepo.claimNext(1)
      );

      const results = await Promise.allSettled(workers);

      const claimed = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<any[]>).value)
        .filter((rows) => rows.length > 0);

      expect(claimed.length).toBeGreaterThanOrEqual(1);

      const allEvents = await Promise.all(
        eventIds.map((eid) => outboxRepo.getByEventId(eid))
      );

      const processingCount = allEvents.filter(
        (e) => e!.status === 'PROCESSING'
      ).length;
      const pendingCount = allEvents.filter(
        (e) => e!.status === 'PENDING'
      ).length;

      expect(processingCount + pendingCount).toBe(5);
      expect(processingCount).toBeGreaterThanOrEqual(1);
    });

    it('2c. Crashed PROCESSING event becomes reclaimable after stale reset', async () => {
      const eventId = crypto.randomUUID();
      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_crash_001',
        payload: { amount: 1500 },
      });

      const claimed = await outboxRepo.claimNext(1);
      expect(claimed.length).toBe(1);

      const afterClaim = await outboxRepo.getByEventId(eventId);
      expect(afterClaim!.status).toBe('PROCESSING');

      const secondClaim = await outboxRepo.claimNext(1);
      expect(secondClaim.length).toBe(0);

      await prisma.$executeRaw`
        UPDATE "OutboxEvent"
        SET "updatedAt" = NOW() - INTERVAL '10 minutes'
        WHERE "eventId" = ${eventId}
      `;

      await outboxRepo.resetStaleProcessing(5 * 60 * 1000);

      const recovered = await outboxRepo.getByEventId(eventId);
      expect(recovered!.status).toBe('PENDING');

      const reClaimed = await outboxRepo.claimNext(1);
      expect(reClaimed.length).toBe(1);
    });
  });

  describe('3. Transaction Atomicity Tests', () => {
    it('3a. Committed transaction: business state AND outbox event both exist', async () => {
      const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
      const webhookRepo = new WebhookRepository(prisma);
      const eventEmitter = new EventEmitter();
      const engine = new ReconciliationEngine(
        prisma,
        idempotencyRepo,
        webhookRepo,
        eventEmitter,
        outboxRepo
      );

      const idemKey = crypto.randomUUID();
      const providerPaymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);

      const record = await idempotencyRepo.createReservation(idemKey, 'payment_capture', 'fp_outbox_atomicity');
      await idempotencyRepo.markUnknown(record.id);

      const webhookEvent = {
        provider: 'razorpay',
        providerEventId: 'outbox_atom_' + crypto.randomUUID(),
        eventType: 'payment.captured' as const,
        providerEntityId: providerPaymentId,
        idempotencyKey: idemKey,
        rawPayload: { test: 'atomicity' },
      };

      const result = await engine.processWebhook(webhookEvent);
      expect(result.reconciled).toBe(true);
      expect(result.newStatus).toBe('COMPLETED');

      const updatedRecord = await idempotencyRepo.getRecord(idemKey, 'payment_capture');
      expect(updatedRecord!.status).toBe('COMPLETED');

      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { correlationId: idemKey },
      });
      expect(outboxEvents.length).toBe(1);
      expect(outboxEvents[0].eventType).toBe('PAYMENT_RECONCILED');
      expect(outboxEvents[0].status).toBe('PENDING');
      expect(outboxEvents[0].payload).toMatchObject({
        idempotencyKey: idemKey,
        status: 'COMPLETED',
      });
    });

    it('3b. Rolled-back transaction: neither business state nor outbox event exists', async () => {
      const idemKey = crypto.randomUUID();
      const outboxEventId = crypto.randomUUID();

      try {
        await prisma.$transaction(async (tx) => {
          await tx.idempotencyRecord.create({
            data: {
              idempotencyKey: idemKey,
              scope: 'payment_capture',
              requestFingerprint: 'fp_rollback_test',
              status: 'COMPLETED',
              result: { test: true },
              completedAt: new Date(),
            },
          });

          await outboxRepo.create(
            {
              eventId: outboxEventId,
              eventType: 'PAYMENT_RECONCILED',
              aggregateType: 'payment',
              aggregateId: 'pay_rollback',
              correlationId: idemKey,
              payload: { test: 'rollback' },
            },
            tx
          );

          throw new Error('Simulated crash inside transaction');
        });
      } catch (err: any) {
        expect(err.message).toBe('Simulated crash inside transaction');
      }

      const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
      const record = await idempotencyRepo.getRecord(idemKey, 'payment_capture');
      expect(record).toBeNull();

      const outboxEvent = await outboxRepo.getByEventId(outboxEventId);
      expect(outboxEvent).toBeNull();
    });
  });

  describe('4. Duplicate-Processing Safety', () => {
    it('4a. Worker crash before marking DELIVERED → retry by second worker → idempotent handler prevents duplicate side effects', async () => {
      const eventId = crypto.randomUUID();
      const correlationId = crypto.randomUUID();

      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_dedup_001',
        correlationId,
        payload: { amount: 2000, idempotencyKey: correlationId },
      });

      let sideEffectCount = 0;
      const processedKeys = new Set<string>();

      const idempotentHandler = async (event: any) => {
        const key = event.eventId;
        if (processedKeys.has(key)) {
          return;
        }
        processedKeys.add(key);
        sideEffectCount++;
      };

      const claimed = await outboxRepo.claimNext(1);
      expect(claimed.length).toBe(1);

      await idempotentHandler(claimed[0]);
      expect(sideEffectCount).toBe(1);

      await prisma.$executeRaw`
        UPDATE "OutboxEvent"
        SET status = 'PENDING', "updatedAt" = NOW()
        WHERE "eventId" = ${eventId}
      `;

      const reClaimed = await outboxRepo.claimNext(1);
      expect(reClaimed.length).toBe(1);

      await idempotentHandler(reClaimed[0]);

      expect(sideEffectCount).toBe(1);
    });

    it('4b. Full processor lifecycle: crash simulation then recovery', async () => {
      const eventId = crypto.randomUUID();

      await outboxRepo.create({
        eventId,
        eventType: 'PAYMENT_RECONCILED',
        aggregateType: 'payment',
        aggregateId: 'pay_lifecycle_001',
        payload: { amount: 3000 },
      });

      let callCount = 0;
      const processor = new OutboxProcessor(outboxRepo, {
        batchSize: 10,
        pollIntervalMs: 50,
        maxAttempts: 5,
        backoffBaseMs: 10,
        staleTimeoutMs: 300000,
      });

      processor.registerHandler('PAYMENT_RECONCILED', async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Worker A crashed');
        }
      });

      await processor.tick();

      const afterCrash = await outboxRepo.getByEventId(eventId);
      expect(afterCrash!.status).toBe('PENDING');
      expect(afterCrash!.attempts).toBe(1);

      await prisma.$executeRaw`
        UPDATE "OutboxEvent"
        SET "availableAt" = NOW()
        WHERE "eventId" = ${eventId}
      `;

      await processor.tick();

      const afterRecovery = await outboxRepo.getByEventId(eventId);
      expect(afterRecovery!.status).toBe('DELIVERED');
      expect(afterRecovery!.processedAt).not.toBeNull();
      expect(callCount).toBe(2);
    });
  });

  describe('5. End-to-End: Webhook → Transaction → Outbox → Processor → Delivered', () => {
    it('5a. Full pipeline from webhook to outbox delivery', async () => {
      const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
      const webhookRepo = new WebhookRepository(prisma);
      const eventEmitter = new EventEmitter();
      const engine = new ReconciliationEngine(
        prisma,
        idempotencyRepo,
        webhookRepo,
        eventEmitter,
        outboxRepo
      );

      const idemKey = crypto.randomUUID();
      const providerPaymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);

      const record = await idempotencyRepo.createReservation(idemKey, 'payment_capture', 'fp_e2e');
      await idempotencyRepo.markUnknown(record.id);

      const webhookEvent = {
        provider: 'razorpay',
        providerEventId: 'e2e_' + crypto.randomUUID(),
        eventType: 'payment.captured' as const,
        providerEntityId: providerPaymentId,
        idempotencyKey: idemKey,
        rawPayload: { e2e: true },
      };

      await engine.processWebhook(webhookEvent);

      const outboxPre = await prisma.outboxEvent.findMany({
        where: { correlationId: idemKey },
      });
      expect(outboxPre.length).toBe(1);
      expect(outboxPre[0].status).toBe('PENDING');

      let deliveredPayload: any = null;
      const processor = new OutboxProcessor(outboxRepo, {
        batchSize: 10,
        pollIntervalMs: 50,
        maxAttempts: 3,
        backoffBaseMs: 10,
        staleTimeoutMs: 300000,
      });

      processor.registerHandler('PAYMENT_RECONCILED', async (event) => {
        deliveredPayload = event.payload;
      });

      const processed = await processor.tick();
      expect(processed).toBe(1);

      expect(deliveredPayload).toMatchObject({
        idempotencyKey: idemKey,
        status: 'COMPLETED',
      });

      const outboxPost = await prisma.outboxEvent.findMany({
        where: { correlationId: idemKey },
      });
      expect(outboxPost[0].status).toBe('DELIVERED');
      expect(outboxPost[0].processedAt).not.toBeNull();
    });
  });
});
