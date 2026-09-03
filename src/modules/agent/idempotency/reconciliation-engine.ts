import { PrismaClient } from '@prisma/client';
import { OutboxRepository } from '../../../infrastructure/database/repositories/outbox.repository.js';
import crypto from 'crypto';
import { WebhookEvent } from '../../payment/webhook.js';
import { PrismaIdempotencyRepository } from '../../../infrastructure/database/repositories/idempotency.repository.js';
import { WebhookRepository } from '../../../infrastructure/database/repositories/webhook.repository.js';

export interface ReconciliationResult {
  deduplicated: boolean;
  reconciled: boolean;
  newStatus?: 'COMPLETED' | 'FAILED';
  idempotencyKey?: string;
}

export class ReconciliationEngine {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly idempotencyRepo: PrismaIdempotencyRepository,
    private readonly webhookRepo: WebhookRepository,
    private readonly eventEmitter: { emit(event: string, payload: any): void },
    private readonly outboxRepo: OutboxRepository
  ) {}

  public async processWebhook(event: WebhookEvent): Promise<ReconciliationResult> {
    let emitPayload: { idempotencyKey: string; status: string } | null = null;

    // [STATE MACHINE] [DURABILITY]
    // Wraps webhook deduplication, state resolution, and outbox event emission in a single ACID transaction.
    // This prevents "last-webhook-wins" race conditions and ensures out-of-order events 
    // never corrupt the authoritative payment state or drop downstream analytics events.
    const result = await this.prisma.$transaction(async (tx) => {
      const isNew = await this.webhookRepo.deduplicateAndSave(event, tx);
      if (!isNew) {
        return { deduplicated: true, reconciled: false };
      }

      if (!event.idempotencyKey) {
        return { deduplicated: false, reconciled: false };
      }

      let scope = '';
      if (event.eventType.startsWith('payment.')) scope = 'payment_capture';
      if (event.eventType.startsWith('refund.')) scope = 'payment_refund';
      if (!scope) return { deduplicated: false, reconciled: false };

      const record = await this.idempotencyRepo.getRecord(event.idempotencyKey, scope, tx);
      if (!record) {
        return { deduplicated: false, reconciled: false };
      }

      if (record.status === 'COMPLETED' || record.status === 'FAILED') {
        return { deduplicated: false, reconciled: false };
      }

      let newStatus: 'COMPLETED' | 'FAILED' | undefined;
      if (event.eventType === 'payment.captured' || event.eventType === 'refund.processed') {
        newStatus = 'COMPLETED';
      } else if (event.eventType === 'payment.failed' || event.eventType === 'refund.failed') {
        newStatus = 'FAILED';
      }

      if (!newStatus) {
        return { deduplicated: false, reconciled: false };
      }

      if (newStatus === 'COMPLETED') {
        await this.idempotencyRepo.markCompleted(record.id, {
          providerId: event.providerEntityId,
          reconciledByWebhook: true
        }, tx);
      } else {
        await this.idempotencyRepo.markFailed(record.id, {
          reason: 'Provider webhook indicated failure',
          reconciledByWebhook: true
        }, tx);
      }

      // [DURABILITY]
      // Emitting to the durable outbox within the same Postgres transaction guarantees 
      // zero event loss even if the worker crashes before handing off to BullMQ.
      await this.outboxRepo.create(
        {
          eventId: crypto.randomUUID(),
          eventType: 'PAYMENT_RECONCILED',
          aggregateType: 'payment',
          aggregateId: event.providerEntityId,
          correlationId: event.idempotencyKey,
          payload: {
            idempotencyKey: event.idempotencyKey,
            status: newStatus,
            providerEventId: event.providerEventId,
            rawPayload: event.rawPayload
          }
        },
        tx
      );

      emitPayload = {
        idempotencyKey: event.idempotencyKey,
        status: newStatus
      };

      return {
        deduplicated: false,
        reconciled: true,
        newStatus,
        idempotencyKey: event.idempotencyKey
      };
    });

    if (emitPayload) {
      this.eventEmitter.emit('PAYMENT_RECONCILED', emitPayload);
    }

    return result;
  }
}

