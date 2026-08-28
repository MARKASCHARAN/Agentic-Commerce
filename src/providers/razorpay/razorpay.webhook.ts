import { validateWebhookSignature } from 'razorpay/dist/utils/razorpay-utils';
import { WebhookEvent, WebhookEventType } from '../../agent/payments/webhook';
import { PaymentProviderError } from '../../agent/payments/errors';

export class RazorpayWebhookAdapter {
  constructor(private readonly webhookSecret: string) {}

  public parse(rawBody: string, signature: string): WebhookEvent {
    try {
      const isValid = validateWebhookSignature(rawBody, signature, this.webhookSecret);
      if (!isValid) {
        throw new PaymentProviderError('Invalid webhook signature', 'WEBHOOK_SIGNATURE_INVALID');
      }
    } catch (e: any) {
      throw new PaymentProviderError('Failed to validate webhook signature', 'WEBHOOK_VALIDATION_ERROR', e);
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (e: any) {
      throw new PaymentProviderError('Invalid webhook JSON payload', 'WEBHOOK_PAYLOAD_INVALID', e);
    }

    const event = payload.event;
    if (!event) {
      throw new PaymentProviderError('Missing event type in webhook payload', 'WEBHOOK_EVENT_MISSING');
    }

    let eventType: WebhookEventType;
    let providerEntityId: string;
    let idempotencyKey: string | undefined;

    switch (event) {
      case 'payment.captured':
        eventType = 'payment.captured';
        providerEntityId = payload.payload.payment.entity.id;
        idempotencyKey = payload.payload.payment.entity.notes?.idempotency_key;
        break;
      case 'payment.failed':
        eventType = 'payment.failed';
        providerEntityId = payload.payload.payment.entity.id;
        idempotencyKey = payload.payload.payment.entity.notes?.idempotency_key;
        break;
      case 'refund.processed':
        eventType = 'refund.processed';
        providerEntityId = payload.payload.refund.entity.payment_id;
        idempotencyKey = payload.payload.refund.entity.notes?.idempotency_key;
        break;
      case 'refund.failed':
        eventType = 'refund.failed';
        providerEntityId = payload.payload.refund.entity.payment_id;
        idempotencyKey = payload.payload.refund.entity.notes?.idempotency_key;
        break;
      default:
        throw new PaymentProviderError(`Unsupported webhook event: ${event}`, 'WEBHOOK_EVENT_UNSUPPORTED');
    }

    // fallback to header if notes wasn't used but they somehow provided it via custom header mirroring
    if (!idempotencyKey && payload.payload.payment?.entity?.notes?.['X-Refund-Idempotency']) {
      idempotencyKey = payload.payload.payment.entity.notes['X-Refund-Idempotency'];
    }

    return {
      provider: 'razorpay',
      providerEventId: payload.account_id + '_' + event + '_' + providerEntityId,
      eventType,
      providerEntityId,
      idempotencyKey,
      rawPayload: payload
    };
  }
}
