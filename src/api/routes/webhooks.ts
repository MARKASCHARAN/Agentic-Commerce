import { Router, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { RazorpayWebhookAdapter } from '../../providers/razorpay/razorpay.webhook.js';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const adapter = new RazorpayWebhookAdapter(env.providers.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '');

router.post('/razorpay', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    // req.body is a Buffer because we used express.raw({ type: 'application/json' }) in server.ts
    const rawBody = req.body.toString('utf8');

    // This will throw PaymentProviderError if signature is invalid
    const event = adapter.parse(rawBody, signature);

    // Persist the webhook event using Prisma
    // Create an OutboxEvent for BullMQ to process (as requested in Step 9)
    await prisma.$transaction(async (tx) => {
      // 1. Save WebhookEvent
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

      // 2. Enqueue OutboxEvent
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
    // Return 400 for bad signatures so Razorpay knows it failed due to bad request
    res.status(400).json({ error: error.message });
  }
});

export default router;
