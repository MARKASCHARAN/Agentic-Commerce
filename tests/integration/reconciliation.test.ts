import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { WebhookRepository } from '../../src/database/repositories/webhook.repository';
import { ReconciliationEngine } from '../../src/agent/idempotency/reconciliation-engine';
import { RazorpayWebhookAdapter } from '../../src/providers/razorpay/razorpay.webhook';
import { EventEmitter } from 'events';
import crypto from 'crypto';
describe('Phase 15: Webhook Reconciliation Integration', () => {
  let prisma: PrismaClient;
  let idempotencyRepo: PrismaIdempotencyRepository;
  let webhookRepo: WebhookRepository;
  let eventEmitter: EventEmitter;
  let reconciliationEngine: ReconciliationEngine;
  let razorpayAdapter: RazorpayWebhookAdapter;
  const webhookSecret = 'test_secret_123';

  beforeEach(() => {
    prisma = new PrismaClient();
    idempotencyRepo = new PrismaIdempotencyRepository(prisma);
    webhookRepo = new WebhookRepository(prisma);
    eventEmitter = new EventEmitter();
    reconciliationEngine = new ReconciliationEngine(prisma, idempotencyRepo, webhookRepo, eventEmitter);
    razorpayAdapter = new RazorpayWebhookAdapter(webhookSecret);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  function createSignature(payload: any, secret: string) {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  it('1. Should deterministically map Razorpay payload and resolve UNKNOWN record', async () => {
    const idemKey = crypto.randomUUID();
    const mockProviderPaymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
    
    const record = await idempotencyRepo.createReservation(idemKey, 'payment_capture', 'fingerprint123');
    await idempotencyRepo.markUnknown(record.id);

    let emittedEvent: any = null;
    eventEmitter.on('PAYMENT_RECONCILED', (data) => {
      emittedEvent = data;
    });

    const mockPayload = {
      account_id: 'acc_test123',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: mockProviderPaymentId,
            notes: {
              idempotency_key: idemKey
            }
          }
        }
      }
    };
    const signature = createSignature(mockPayload, webhookSecret);

    const genericEvent = razorpayAdapter.parse(JSON.stringify(mockPayload), signature);
    expect(genericEvent.eventType).toBe('payment.captured');
    expect(genericEvent.idempotencyKey).toBe(idemKey);

    await reconciliationEngine.processWebhook(genericEvent);

    const updatedRecord = await idempotencyRepo.getRecord(idemKey, 'payment_capture');
    expect(updatedRecord).not.toBeNull();
    expect(updatedRecord!.status).toBe('COMPLETED');
    expect(updatedRecord!.result).toMatchObject({
      providerId: mockProviderPaymentId,
      reconciledByWebhook: true
    });

    expect(emittedEvent).toEqual({
      idempotencyKey: idemKey,
      status: 'COMPLETED'
    });
  });

  it('2. Should strictly deduplicate duplicate webhook deliveries', async () => {
    const idemKey = crypto.randomUUID();
    const mockProviderPaymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
    
    const record = await idempotencyRepo.createReservation(idemKey, 'payment_capture', 'fingerprint123');
    await idempotencyRepo.markUnknown(record.id);

    const mockPayload = {
      account_id: 'acc_test123',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: mockProviderPaymentId,
            notes: {
              idempotency_key: idemKey
            }
          }
        }
      }
    };
    const signature = createSignature(mockPayload, webhookSecret);
    const genericEvent = razorpayAdapter.parse(JSON.stringify(mockPayload), signature);

    let eventCount = 0;
    eventEmitter.on('PAYMENT_RECONCILED', () => {
      eventCount++;
    });

    await reconciliationEngine.processWebhook(genericEvent);
    await reconciliationEngine.processWebhook(genericEvent);
    await reconciliationEngine.processWebhook(genericEvent);

    expect(eventCount).toBe(1); // Only emitted once due to deduplication

    const updatedRecord = await idempotencyRepo.getRecord(idemKey, 'payment_capture');
    expect(updatedRecord!.status).toBe('COMPLETED');
  });

  it('3. Should NOT regress a COMPLETED record back to FAILED if events arrive out of order', async () => {
    const idemKey = crypto.randomUUID();
    const mockProviderPaymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
    
    const record = await idempotencyRepo.createReservation(idemKey, 'payment_capture', 'fingerprint123');
    await idempotencyRepo.markCompleted(record.id, { providerId: mockProviderPaymentId });

    let eventCount = 0;
    eventEmitter.on('PAYMENT_RECONCILED', () => {
      eventCount++;
    });

    const failedPayload = {
      account_id: 'acc_test123',
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: mockProviderPaymentId,
            notes: {
              idempotency_key: idemKey
            }
          }
        }
      }
    };
    const signature = createSignature(failedPayload, webhookSecret);
    const genericEvent = razorpayAdapter.parse(JSON.stringify(failedPayload), signature);

    await reconciliationEngine.processWebhook(genericEvent);

    const finalRecord = await idempotencyRepo.getRecord(idemKey, 'payment_capture');
    expect(finalRecord!.status).toBe('COMPLETED'); 
    expect(eventCount).toBe(0); 
  });
});
