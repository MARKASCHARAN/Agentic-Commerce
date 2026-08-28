import Razorpay from 'razorpay';
import {
  PaymentIntent,
  CaptureRequest,
  RefundRequest,
  ProviderResult,
  WebhookPayload,
  PaymentProvider,
  PaymentProviderError,
  PaymentUnknownError,
  PaymentProviderTimeoutError
} from '../../agent/payments';
import { WebhookEvent } from '../../agent/payments/webhook';
import { RazorpayWebhookAdapter } from './razorpay.webhook';

export class RazorpayProvider implements PaymentProvider {
  private razorpay: Razorpay;

  constructor(keyId: string, keySecret: string) {
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  }

  private mapError(error: any): Error {
    if (error?.statusCode === 504 || error?.code === 'ETIMEDOUT') {
      return new PaymentProviderTimeoutError('Razorpay request timed out', error?.statusCode?.toString(), error);
    }

    if (error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND') {
      return new PaymentUnknownError('Razorpay connection dropped, state unknown', error?.code, error);
    }

    return new PaymentProviderError(error?.error?.description || error?.message || 'Razorpay operation failed', error?.statusCode?.toString(), error);
  }

  private mapStatus(razorpayStatus: string): PaymentIntent['status'] {
    switch (razorpayStatus) {
      case 'created': return 'created';
      case 'authorized': return 'authorized';
      case 'captured': return 'captured';
      case 'refunded': return 'refunded';
      case 'failed': return 'failed';
      default: return 'unknown';
    }
  }

  async fetchPayment(paymentId: string): Promise<ProviderResult<PaymentIntent>> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      
      return {
        success: true,
        data: {
          providerId: payment.id,
          amount: typeof payment.amount === 'number' ? payment.amount : parseInt(payment.amount, 10),
          currency: payment.currency,
          status: this.mapStatus(payment.status)
        },
        providerRawStatus: payment.status,
        providerRawResponse: payment
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async capturePayment(request: CaptureRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>> {
    try {
      const params: any = {
        amount: request.amount,
        currency: request.currency
      };
      
      if (idempotencyKey) {
        params.notes = { idempotency_key: idempotencyKey };
      }

      const payment = await this.razorpay.payments.capture(request.paymentId, params.amount, request.currency);
      
      return {
        success: true,
        data: {
          providerId: payment.id,
          amount: typeof payment.amount === 'number' ? payment.amount : parseInt(payment.amount as any, 10),
          currency: payment.currency,
          status: this.mapStatus(payment.status)
        },
        providerRawStatus: payment.status,
        providerRawResponse: payment
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async refundPayment(request: RefundRequest, idempotencyKey?: string): Promise<ProviderResult<PaymentIntent>> {
    try {
      const params: any = {};
      if (request.amount) params.amount = request.amount;
      if (request.receipt) params.receipt = request.receipt;
      
      params.notes = {};
      if (request.reason) params.notes.reason = request.reason;
      if (idempotencyKey) params.notes.idempotency_key = idempotencyKey;

      const refund = await this.razorpay.payments.refund(request.paymentId, params);
      const payment = await this.razorpay.payments.fetch(request.paymentId);

      return {
        success: true,
        data: {
          providerId: payment.id,
          amount: typeof payment.amount === 'number' ? payment.amount : parseInt(payment.amount as any, 10),
          currency: payment.currency,
          status: this.mapStatus(payment.status)
        },
        providerRawStatus: payment.status,
        providerRawResponse: refund
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async reconcileWebhook(payload: any, signature: string, secret: string): Promise<ProviderResult<WebhookEvent>> {
    try {
      const adapter = new RazorpayWebhookAdapter(secret);
      const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
      const event = adapter.parse(rawBody, signature);

      return {
        success: true,
        data: event
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }
}
