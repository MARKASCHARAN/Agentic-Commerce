import { Tool, ToolId } from '../types';
import { z } from 'zod';
import { PaymentProvider } from '../../payments';
import { InProcessToolAdapter } from '../adapters/in-process-adapter';

export interface CapturePaymentInput {
  paymentId: string;
  amount: number;
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
      amount: z.number(),
      currency: z.string()
    }),
    outputSchema: z.any(),
    policy: { id: 'financial-policy' },
    idempotency: { required: true, scope: 'payment_capture' },
    adapter: new InProcessToolAdapter<CapturePaymentInput, any>(async (input, context) => {
      try {
        const result = await provider.capturePayment({
          paymentId: input.paymentId,
          amount: input.amount,
          currency: input.currency
        }, context.idempotencyKey);
        
        return result.data;
      } catch (error: any) {
        if (error.name === 'PaymentProviderTimeoutError' || error.name === 'PaymentUnknownError') {
          // Bubble up exactly as is so the gateway/idempotency engine knows it's an UNKNOWN state
          throw error;
        }
        throw new Error(`Capture failed: ${error.message}`);
      }
    })
  };
}
