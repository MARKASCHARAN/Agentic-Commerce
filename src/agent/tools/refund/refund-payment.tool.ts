import { Tool, ToolId } from '../types';
import { z } from 'zod';
import { PaymentProvider } from '../../payments';
import { InProcessToolAdapter } from '../adapters/in-process-adapter';

export interface RefundPaymentInput {
  paymentId: string;
  amount?: number;
  reason?: string;
  receipt?: string;
}

export function createRefundPaymentTool(provider: PaymentProvider): Tool<RefundPaymentInput, any> {
  return {
    metadata: {
      id: 'refund-payment' as ToolId,
      name: 'Refund Payment',
      description: 'Refunds a captured payment.',
      version: '1.0.0'
    },
    inputSchema: z.object({
      paymentId: z.string(),
      amount: z.number().optional(),
      reason: z.string().optional(),
      receipt: z.string().optional()
    }),
    outputSchema: z.any(),
    policy: { id: 'financial-policy' },
    idempotency: { required: true, scope: 'payment_refund' },
    adapter: new InProcessToolAdapter<RefundPaymentInput, any>(async (input, context) => {
      try {
        const result = await provider.refundPayment({
          paymentId: input.paymentId,
          amount: input.amount,
          reason: input.reason,
          receipt: input.receipt
        }, context.idempotencyKey);
        
        return result.data;
      } catch (error: any) {
        if (error.name === 'PaymentProviderTimeoutError' || error.name === 'PaymentUnknownError') {
          throw error;
        }
        throw new Error(`Refund failed: ${error.message}`);
      }
    })
  };
}
