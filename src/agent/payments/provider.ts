import { CaptureRequest, PaymentIntent, ProviderResult, RefundRequest, WebhookPayload } from './types';

export interface PaymentProvider {
  
  fetchPayment(paymentId: string): Promise<ProviderResult<PaymentIntent>>;

  capturePayment(request: CaptureRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>>;

  refundPayment(request: RefundRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>>;

  reconcileWebhook(payload: any, signature: string, secret: string): Promise<ProviderResult<WebhookPayload>>;
}
