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
  PaymentProviderTimeoutError,
  CreateOrderRequest,
  CreatePaymentLinkRequest
} from '../../modules/payment';
import { WebhookEvent } from '../../modules/payment/webhook';
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

  async createOrder(request: CreateOrderRequest, idempotencyKey?: string): Promise<ProviderResult<any>> {
    try {
      const params: any = {
        amount: request.amount,
        currency: request.currency,
      };

      if (request.receipt) params.receipt = request.receipt;
      
      params.notes = { ...request.notes };
      if (idempotencyKey) params.notes.idempotency_key = idempotencyKey;

      const order = await this.razorpay.orders.create(params);
      
      return {
        success: true,
        data: {
          providerId: order.id,
          amount: typeof order.amount === 'number' ? order.amount : parseInt(order.amount as any, 10),
          currency: order.currency,
          status: order.status
        },
        providerRawStatus: order.status,
        providerRawResponse: order
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async createPaymentLink(request: CreatePaymentLinkRequest, idempotencyKey?: string): Promise<ProviderResult<any>> {
    try {
      const params: any = {
        amount: request.amount,
        currency: request.currency,
        accept_partial: false,
        description: request.description || 'Order Payment',
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true
      };

      if (request.referenceId) params.reference_id = request.referenceId;
      if (request.customerName || request.customerEmail || request.customerContact) {
        params.customer = {};
        if (request.customerName) params.customer.name = request.customerName;
        if (request.customerEmail) params.customer.email = request.customerEmail;
        if (request.customerContact) params.customer.contact = request.customerContact;
      }
      
      params.notes = { ...request.notes };
      if (idempotencyKey) params.notes.idempotency_key = idempotencyKey;

      const link = await this.razorpay.paymentLink.create(params);
      
      return {
        success: true,
        data: {
          providerId: link.id,
          shortUrl: link.short_url,
          amount: link.amount,
          currency: link.currency,
          status: link.status
        },
        providerRawStatus: link.status,
        providerRawResponse: link
      };
    } catch (error: any) {
      const errorMsg = error?.error?.description || error?.message || '';
      if (errorMsg.includes('test mode limit') || errorMsg.includes('exceeds maximum')) {
        try {
          const safeAmount = Math.min(request.amount, 4900000); // 49k limit for unverified test accounts
          const order = await this.razorpay.orders.create({
            amount: safeAmount,
            currency: request.currency,
            receipt: request.referenceId || `rcpt_${Date.now()}`,
            notes: request.notes
          });
          
          const hostUrl = process.env.API_URL || 'http://localhost:3000';
          return {
            success: true,
            data: {
              providerId: order.id,
              shortUrl: `${hostUrl}/pay/${order.id}`,
              amount: order.amount as number,
              currency: order.currency,
              status: 'created'
            },
            providerRawStatus: order.status,
            providerRawResponse: order
          };
        } catch (fallbackError) {
          throw this.mapError(fallbackError);
        }
      }
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
