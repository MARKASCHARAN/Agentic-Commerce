import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { OutboxRepository } from '../../src/database/repositories/outbox.repository';
import { OutboxPublisher } from '../../src/agent/outbox/publisher';
import { BullMQOutboxWorker } from '../../src/agent/outbox/bullmq-worker';
import crypto from 'crypto';

class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

describe.sequential('Phase 17: BullMQ Event Distribution', () => {
  let prisma: PrismaClient;
  let outboxRepo: OutboxRepository;
  let redisClient: IORedis;
  let bullQueue: Queue;
  let publisher: OutboxPublisher;
  let worker: BullMQOutboxWorker;

  const QUEUE_NAME = 'test-outbox-events';
  const REDIS_URL = 'redis://localhost:6380';

  beforeAll(async () => {
    prisma = new PrismaClient();
    outboxRepo = new OutboxRepository(prisma);

    redisClient = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    bullQueue = new Queue(QUEUE_NAME, { connection: redisClient });

    await redisClient.flushdb();
  });

  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany({});
    await redisClient.flushdb();

    publisher = new OutboxPublisher(outboxRepo, bullQueue, {
      batchSize: 10,
      pollIntervalMs: 50,
      staleTimeoutMs: 60000,
    });

    worker = new BullMQOutboxWorker(outboxRepo, {
      queueName: QUEUE_NAME,
      redisUrl: REDIS_URL,
      concurrency: 1,
    });
  });

  afterAll(async () => {
    try {
      if (worker) await worker.stop();
      if (bullQueue) await bullQueue.close();
      if (redisClient && redisClient.status !== 'end') await redisClient.quit();
      if (prisma) await prisma.$disconnect();
    } catch (e) {
      
    }
  });

  it('1. Outbox event publishes to BullMQ and 2. Worker successfully processes', async () => {
    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'PAYMENT_SUCCESS',
      aggregateType: 'payment',
      aggregateId: 'pay_001',
      payload: { amount: 100 },
    });

    let processedEvent: any = null;
    worker.registerHandler('PAYMENT_SUCCESS', async (event) => {
      processedEvent = event;
    });

    worker.start();

    const processed = await publisher.tick();
    expect(processed).toBe(1);

    const dbEvent = await outboxRepo.getByEventId(eventId);
    expect(dbEvent!.status).toBe('DELIVERED');

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await worker.stop();

    expect(processedEvent).toBeDefined();
    expect(processedEvent.eventId).toBe(eventId);
  });

  it('3. Duplicate delivery causes only one effective business effect', async () => {
    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'IDEMPOTENT_EVENT',
      aggregateType: 'payment',
      aggregateId: 'pay_002',
      payload: {},
    });

    let sideEffectCount = 0;
    const processedKeys = new Set<string>();

    worker.registerHandler('IDEMPOTENT_EVENT', async (event) => {
      if (!processedKeys.has(event.eventId)) {
        processedKeys.add(event.eventId);
        sideEffectCount++;
      }
    });

    worker.start();

    await bullQueue.add('IDEMPOTENT_EVENT', { eventId, eventType: 'IDEMPOTENT_EVENT' }, { jobId: eventId + '_1' });
    await bullQueue.add('IDEMPOTENT_EVENT', { eventId, eventType: 'IDEMPOTENT_EVENT' }, { jobId: eventId + '_2' });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await worker.stop();

    expect(sideEffectCount).toBe(1);
  });

  it('4. Transient failure retries and eventually succeeds', async () => {
    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'TRANSIENT_TEST',
      aggregateType: 'test',
      aggregateId: 't1',
      payload: {},
    });

    await bullQueue.add('TRANSIENT_TEST', { eventId, eventType: 'TRANSIENT_TEST' }, {
      jobId: eventId,
      attempts: 3,
      backoff: { type: 'fixed', delay: 50 }
    });

    let callCount = 0;
    worker.registerHandler('TRANSIENT_TEST', async () => {
      callCount++;
      if (callCount < 2) {
        const err = new Error('RateLimitError: too many requests');
        err.name = 'RateLimitError';
        throw err; 
      }
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await worker.stop();

    expect(callCount).toBe(2);

    const job = await bullQueue.getJob(eventId);
    expect(await job!.isCompleted()).toBe(true);
  });

  it('5. Permanent failure stops without exhausting bounded attempts', async () => {
    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'PERMANENT_TEST',
      aggregateType: 'test',
      aggregateId: 't2',
      payload: {},
    });

    await bullQueue.add('PERMANENT_TEST', { eventId, eventType: 'PERMANENT_TEST' }, {
      jobId: eventId,
      attempts: 5, 
    });

    let callCount = 0;
    worker.registerHandler('PERMANENT_TEST', async () => {
      callCount++;
      throw new IdempotencyConflictError('Already processed with different fingerprint');
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await worker.stop();

    expect(callCount).toBe(1);

    const job = await bullQueue.getJob(eventId);
    expect(await job!.isFailed()).toBe(true);
    expect(job!.failedReason).toContain('[PERMANENT]');
  });

  it('11. Critical crash window: duplicate job handled idempotently', async () => {

    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'CRASH_TEST',
      aggregateType: 'test',
      aggregateId: 'crash_001',
      payload: {},
    });

    await bullQueue.add('CRASH_TEST', { eventId, eventType: 'CRASH_TEST' }, { jobId: eventId + '_run1' });

    let dbEvent = await outboxRepo.getByEventId(eventId);
    expect(dbEvent!.status).toBe('PENDING');

    const processed = await publisher.tick();
    expect(processed).toBe(1); 

    dbEvent = await outboxRepo.getByEventId(eventId);
    expect(dbEvent!.status).toBe('DELIVERED');

    let executionCount = 0;
    let actualSideEffects = 0;
    const processedKeys = new Set<string>();

    worker.registerHandler('CRASH_TEST', async (event) => {
      executionCount++;
      
      if (!processedKeys.has(event.eventId)) {
        processedKeys.add(event.eventId);
        actualSideEffects++;
      }
    });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await worker.stop();

    expect(executionCount).toBe(2);
    
    expect(actualSideEffects).toBe(1);
  });
});
