import { CaptureRequest, CreateOrderRequest, CreatePaymentLinkRequest, PaymentIntent, ProviderResult, RefundRequest } from './types';
import { WebhookEvent } from './webhook';

export interface PaymentProvider {
  
  fetchPayment(paymentId: string): Promise<ProviderResult<PaymentIntent>>;
  
  createOrder(request: CreateOrderRequest, idempotencyKey?: string): Promise<ProviderResult<any>>;

  createPaymentLink(request: CreatePaymentLinkRequest, idempotencyKey?: string): Promise<ProviderResult<any>>;

  capturePayment(request: CaptureRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>>;

  refundPayment(request: RefundRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>>;

  reconcileWebhook(payload: any, signature: string, secret: string): Promise<ProviderResult<WebhookEvent>>;
}
