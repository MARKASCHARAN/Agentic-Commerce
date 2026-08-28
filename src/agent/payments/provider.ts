import { CaptureRequest, PaymentIntent, ProviderResult, RefundRequest, WebhookPayload } from './types';

export interface PaymentProvider {
  /**
   * Fetch an existing payment intent/order from the provider.
   */
  fetchPayment(paymentId: string): Promise<ProviderResult<PaymentIntent>>;

  /**
   * Capture a previously authorized payment.
   * If the provider supports idempotency headers for this operation, it MUST be passed down.
   */
  capturePayment(request: CaptureRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>>;

  /**
   * Refund a captured payment.
   * If the provider supports idempotency headers for this operation, it MUST be passed down.
   */
  refundPayment(request: RefundRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>>;

  /**
   * Verify the authenticity of a webhook payload and parse it.
   */
  reconcileWebhook(payload: any, signature: string, secret: string): Promise<ProviderResult<WebhookPayload>>;
}
