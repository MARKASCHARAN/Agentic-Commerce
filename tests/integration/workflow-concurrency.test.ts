import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaWorkflowRepository } from '../../src/database/repositories/workflow.repository';
import { StaleWorkflowWorkerError } from '../../src/agent/workflows/errors';

describe('Phase 15.5: Workflow Concurrency & Optimistic Locking', () => {
  let prisma: PrismaClient;
  let workflowRepo: PrismaWorkflowRepository;

  beforeEach(() => {
    prisma = new PrismaClient();
    workflowRepo = new PrismaWorkflowRepository();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it('1. Two concurrent workers on same instance: exactly one succeeds', async () => {
    const instance = await workflowRepo.create({
      workflowId: 'concurrency-test',
      currentState: 'PENDING',
      status: 'ACTIVE'
    });

    const results = await Promise.allSettled([
      workflowRepo.saveTransition(instance.id, instance.version, 'PROCESSING'),
      workflowRepo.saveTransition(instance.id, instance.version, 'PROCESSING'),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const failedReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failedReason).toBeInstanceOf(StaleWorkflowWorkerError);
  });

  it('2. 100 concurrent workers on same instance: exactly one succeeds', async () => {
    const instance = await workflowRepo.create({
      workflowId: 'concurrency-test-100',
      currentState: 'PENDING',
      status: 'ACTIVE'
    });

    const workers = Array.from({ length: 100 }, () =>
      workflowRepo.saveTransition(instance.id, instance.version, 'PROCESSING')
    );

    const results = await Promise.allSettled(workers);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    failures.forEach(f => {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(StaleWorkflowWorkerError);
    });

    const finalInstance = await workflowRepo.load(instance.id);
    expect(finalInstance!.version).toBe(2);
    expect(finalInstance!.currentState).toBe('PROCESSING');
  });

  it('3. Sequential version increments work correctly', async () => {
    const instance = await workflowRepo.create({
      workflowId: 'sequential-test',
      currentState: 'A',
      status: 'ACTIVE'
    });

    expect(instance.version).toBe(1);

    const v2 = await workflowRepo.saveTransition(instance.id, 1, 'B');
    expect(v2.version).toBe(2);
    expect(v2.currentState).toBe('B');

    const v3 = await workflowRepo.saveTransition(instance.id, 2, 'C');
    expect(v3.version).toBe(3);
    expect(v3.currentState).toBe('C');

    await expect(
      workflowRepo.saveTransition(instance.id, 1, 'STALE')
    ).rejects.toThrow(StaleWorkflowWorkerError);

    const finalInstance = await workflowRepo.load(instance.id);
    expect(finalInstance!.version).toBe(3);
    expect(finalInstance!.currentState).toBe('C');
  });

  it('4. StaleWorkflowWorkerError carries correct metadata', async () => {
    const instance = await workflowRepo.create({
      workflowId: 'metadata-test',
      currentState: 'INIT',
      status: 'ACTIVE'
    });

    await workflowRepo.saveTransition(instance.id, 1, 'NEXT');

    try {
      await workflowRepo.saveTransition(instance.id, 1, 'CONFLICT');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(StaleWorkflowWorkerError);
      const err = e as StaleWorkflowWorkerError;
      expect(err.instanceId).toBe(instance.id);
      expect(err.expectedVersion).toBe(1);
    }
  });

  it('5. Reconciliation uses $transaction atomically', async () => {
    const { PrismaIdempotencyRepository } = await import('../../src/database/repositories/idempotency.repository');
    const { WebhookRepository } = await import('../../src/database/repositories/webhook.repository');
    const { OutboxRepository } = await import('../../src/database/repositories/outbox.repository');
    const { ReconciliationEngine } = await import('../../src/agent/idempotency/reconciliation-engine');
    const { EventEmitter } = await import('events');
    const crypto = await import('crypto');

    const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
    const webhookRepo = new WebhookRepository(prisma);
    const outboxRepo = new OutboxRepository(prisma);
    const eventEmitter = new EventEmitter();
    const engine = new ReconciliationEngine(prisma, idempotencyRepo, webhookRepo, eventEmitter, outboxRepo);

    const idemKey = crypto.randomUUID();
    const providerPaymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);

    const record = await idempotencyRepo.createReservation(idemKey, 'payment_capture', 'fp_atomic');
    await idempotencyRepo.markUnknown(record.id);

    const webhookEvent = {
      provider: 'razorpay',
      providerEventId: 'atomic_test_' + crypto.randomUUID(),
      eventType: 'payment.captured' as const,
      providerEntityId: providerPaymentId,
      idempotencyKey: idemKey,
      rawPayload: { test: true }
    };

    const result = await engine.processWebhook(webhookEvent);
    expect(result.reconciled).toBe(true);
    expect(result.newStatus).toBe('COMPLETED');

    const updatedRecord = await idempotencyRepo.getRecord(idemKey, 'payment_capture');
    expect(updatedRecord!.status).toBe('COMPLETED');
  });
});
