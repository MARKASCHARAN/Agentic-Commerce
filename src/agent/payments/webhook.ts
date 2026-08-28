export type WebhookEventType = 
  | 'payment.captured'
  | 'payment.failed'
  | 'refund.processed'
  | 'refund.failed';

export interface WebhookEvent {
  provider: string;
  providerEventId: string;
  eventType: WebhookEventType;
  providerEntityId: string;
  idempotencyKey?: string;
  rawPayload: any;
}
