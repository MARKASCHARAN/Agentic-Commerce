import { Request, Response } from 'express';
import { env } from '../../../config/env.js';
import { RazorpayWebhookAdapter } from '../../../infrastructure/razorpay/razorpay.webhook.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const adapter = new RazorpayWebhookAdapter(env.providers.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '');

export class WebhookController {
  static async handleRazorpay(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Missing signature' });
        return;
      }

      const rawBody = req.body.toString('utf8');

      const event = adapter.parse(rawBody, signature);

      await prisma.$transaction(async (tx) => {

        const savedEvent = await tx.webhookEvent.upsert({
          where: {
            provider_providerEventId: {
              provider: event.provider,
              providerEventId: event.providerEventId
            }
          },
          update: {},
          create: {
            provider: event.provider,
            providerEventId: event.providerEventId,
            eventType: event.eventType,
            payload: event.rawPayload
          }
        });

        await tx.outboxEvent.create({
          data: {
            eventId: savedEvent.id,
            eventType: 'payment.webhook',
            aggregateType: 'WebhookEvent',
            aggregateId: savedEvent.id,
            payload: {
              eventId: savedEvent.id,
              type: event.eventType,
              providerEntityId: event.providerEntityId,
              idempotencyKey: event.idempotencyKey,
            },
            status: 'PENDING'
          }
        });
      });

      res.status(200).json({ status: 'ok' });
    } catch (error: any) {
      console.error('Webhook Error:', error);

      res.status(400).json({ error: error.message });
    }
  }
}
