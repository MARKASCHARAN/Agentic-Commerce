import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { OutboxRepository } from '../../src/database/repositories/outbox.repository';
import { OutboxPublisher } from '../../src/agent/outbox/publisher';
import { BullMQOutboxWorker } from '../../src/agent/outbox/bullmq-worker';
import { calculateBackoff, DEFAULT_RETRY_CONFIG } from '../../src/agent/outbox/retry-policy';
import { PaymentUnknownError } from '../../src/agent/payments/errors';
import crypto from 'crypto';

class TransientTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

class ValidationTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

describe.sequential('Phase 18: Retry + Failure Classification', () => {
  let prisma: PrismaClient;
  let outboxRepo: OutboxRepository;
  let redisClient: IORedis;
  let bullQueue: Queue;
  let publisher: OutboxPublisher;
  let worker: BullMQOutboxWorker;

  const QUEUE_NAME = 'test-retry-events';
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

  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
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

  it('1. TRANSIENT failures retry safely up to the bounded limit', async () => {
    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'TRANSIENT_RETRY_TEST',
      aggregateType: 'test',
      aggregateId: 't1',
      payload: {},
    });

    await publisher.tick();

    const job = await bullQueue.getJob(eventId);
    expect(job!.opts.attempts).toBe(DEFAULT_RETRY_CONFIG.maxAttempts);
    expect((job!.opts.backoff as any)?.type).toBe('custom');
  });

  it('2. Backoff math correctly calculates exponential delay and bounds', () => {
    const config = {
      maxAttempts: 5,
      backoffBaseMs: 1000,
      maxBackoffMs: 5000,
      jitterMs: 0, 
    };

    expect(calculateBackoff(1, config)).toBe(1000);
    
    expect(calculateBackoff(2, config)).toBe(2000);
    
    expect(calculateBackoff(3, config)).toBe(4000);
    
    expect(calculateBackoff(4, config)).toBe(5000);
  });

  it('3. PERMANENT failure skips retries and fails immediately', async () => {
    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'PERMANENT_RETRY_TEST',
      aggregateType: 'test',
      aggregateId: 't2',
      payload: {},
    });

    let executionCount = 0;
    worker.registerHandler('PERMANENT_RETRY_TEST', async () => {
      executionCount++;
      throw new ValidationTestError('Invalid schema');
    });

    worker.start();
    await publisher.tick();

    await new Promise(r => setTimeout(r, 2000));
    await worker.stop();

    expect(executionCount).toBe(1);

    const job = await bullQueue.getJob(eventId);
    expect(await job!.isFailed()).toBe(true);
    expect(job!.failedReason).toContain('[PERMANENT]');
  });

  it('4. UNKNOWN failure skips retries and stops (reconciliation handler)', async () => {
    const eventId = crypto.randomUUID();
    await outboxRepo.create({
      eventId,
      eventType: 'UNKNOWN_RETRY_TEST',
      aggregateType: 'test',
      aggregateId: 't3',
      payload: {},
    });

    let executionCount = 0;
    worker.registerHandler('UNKNOWN_RETRY_TEST', async () => {
      executionCount++;
      throw new PaymentUnknownError('Razorpay connection reset after transmission');
    });

    worker.start();
    const publishedCount = await publisher.tick();
    console.log(`[Test 4] Publisher queued ${publishedCount} jobs.`);

    await new Promise(r => setTimeout(r, 2000));
    await worker.stop();

    console.log(`[Test 4] executionCount is ${executionCount}`);

    expect(executionCount).toBe(1);

    const job = await bullQueue.getJob(eventId);
    expect(await job!.isFailed()).toBe(true);
    expect(job!.failedReason).toContain('[UNKNOWN]');
  });
});
