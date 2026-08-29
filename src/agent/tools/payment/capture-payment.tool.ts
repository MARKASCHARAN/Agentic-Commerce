import { Tool, ToolId } from '../types';
import { z } from 'zod';
import { PaymentProvider } from '../../payments';
import { InProcessToolAdapter } from '../adapters/in-process-adapter';

export interface CapturePaymentInput {
  paymentId: string;
  amountMinor: number;
  currency: string;
}

export function createCapturePaymentTool(provider: PaymentProvider): Tool<CapturePaymentInput, any> {
  return {
    metadata: {
      id: 'capture-payment' as ToolId,
      name: 'Capture Payment',
      description: 'Captures a previously authorized payment.',
      version: '1.0.0'
    },
    inputSchema: z.object({
      paymentId: z.string(),
      amountMinor: z.number().int().positive(),
      currency: z.string()
    }),
    outputSchema: z.any(),
    policy: { id: 'financial-policy' },
    requiredCapabilities: ['payment.create'],
    idempotency: { required: true, scope: 'payment_capture' },
    adapter: new InProcessToolAdapter<CapturePaymentInput, any>(async (input, context) => {
      try {
        const result = await provider.capturePayment({
          paymentId: input.paymentId,
          amount: input.amountMinor,
          currency: input.currency
        }, context.idempotencyKey);
        
        return result.data;
      } catch (error: any) {
        if (error.name === 'PaymentProviderTimeoutError' || error.name === 'PaymentUnknownError') {
          
          throw error;
        }
        throw new Error(`Capture failed: ${error.message}`);
      }
    })
  };
}
