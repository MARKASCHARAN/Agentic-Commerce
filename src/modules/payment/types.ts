export interface PaymentIntent {
  providerId: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'unknown';
  metadata?: Record<string, string>;
}

export interface CaptureRequest {
  paymentId: string;
  amount: number;
  currency: string;
}

export interface CreateOrderRequest {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreatePaymentLinkRequest {
  amount: number;
  currency: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerContact?: string;
  referenceId?: string;
  notes?: Record<string, string>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
  receipt?: string;
}

export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  providerRawStatus?: string;
  providerRawResponse?: any;
}

export interface WebhookPayload {
  eventId: string;
  eventType: string;
  resourceId: string;
  signature: string;
  payload: any;
}
