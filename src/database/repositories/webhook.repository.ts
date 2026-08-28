import { PrismaClient } from '@prisma/client';
import { WebhookEvent } from '../../agent/payments/webhook';

export class WebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async deduplicateAndSave(event: WebhookEvent, tx?: any): Promise<boolean> {
    const client = tx || this.prisma;
    try {
      await client.webhookEvent.create({
        data: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payload: event.rawPayload
        }
      });
      return true;
    } catch (e: any) {
      if (e.code === 'P2002') {
        return false;
      }
      throw e;
    }
  }
}

