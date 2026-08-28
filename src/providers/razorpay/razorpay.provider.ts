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
    
    // For network drops where we don't know the status
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
    /**
     * GUARANTEE DOCUMENTATION:
     * Razorpay's `capture` endpoint does not natively support provider-side idempotency keys.
     * The official `razorpay` Node SDK explicitly filters out custom headers.
     * Therefore, for `capturePayment`, EXACTLY-ONCE execution is strictly guaranteed ONLY by our
     * internal PostgreSQL IdempotencyEngine. If a network crash occurs after capture but before DB update,
     * it will result in an UNKNOWN state and require manual reconciliation, since we cannot safely retry capture blindly.
     */
    try {
      // amount is in smallest unit
      const payment = await this.razorpay.payments.capture(request.paymentId, request.amount, request.currency);
      
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
    /**
     * GUARANTEE DOCUMENTATION:
     * While Razorpay REST API supports `X-Refund-Idempotency` for refunds, the official Node SDK's
     * internal request abstraction (`api.js -> allowedHeaders`) aggressively filters out custom headers.
     * Furthermore, the SDK's `refund` method signature does not accept a headers configuration object.
     * Consequently, provider-level idempotency cannot be leveraged here without dropping the SDK.
     * EXACTLY-ONCE execution relies entirely on our internal IdempotencyEngine lock.
     * A crash during refund execution will yield an UNKNOWN state.
     */
    try {
      const params: any = {};
      if (request.amount) params.amount = request.amount;
      if (request.receipt) params.receipt = request.receipt;
      if (request.reason) params.notes = { reason: request.reason };

      const refund = await this.razorpay.payments.refund(request.paymentId, params);
      
      // We must fetch the payment again to get the updated status, or infer it
      // Refund object itself doesn't contain the payment's overall status natively in the same shape.
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

  async reconcileWebhook(payload: any, signature: string, secret: string): Promise<ProviderResult<WebhookPayload>> {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      
      if (expectedSignature !== signature) {
        throw new PaymentProviderError('Invalid webhook signature');
      }

      return {
        success: true,
        data: {
          eventId: payload.id || 'unknown',
          eventType: payload.event || 'unknown',
          resourceId: payload.payload?.payment?.entity?.id || 'unknown',
          signature,
          payload
        }
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }
}
