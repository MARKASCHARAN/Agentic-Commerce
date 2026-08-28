import { z } from 'zod';

export const ProtocolVersion = '1.0';

export const DiscoverPayloadSchema = z.object({
  query: z.string().optional(),
});

export const QuoteRequestPayloadSchema = z.object({
  items: z.array(z.object({
    resourceId: z.string(),
    quantity: z.number().int().positive(),
  })),
});

export const QuotePayloadSchema = z.object({
  quoteId: z.string(),
  items: z.array(z.object({
    resourceId: z.string(),
    quantity: z.number().int().positive(),
    unitPriceMinor: z.number().int().nonnegative(),
  })),
  currency: z.string(),
  expiresAt: z.string().datetime().optional(),
});

export const OfferPayloadSchema = z.object({
  offerId: z.string(),
  items: z.array(z.object({
    resourceId: z.string(),
    quantity: z.number().int().positive(),
    unitPriceMinor: z.number().int().nonnegative(),
  })),
  discountMinor: z.number().int().nonnegative().optional(),
  currency: z.string(),
  expiresAt: z.string().datetime(),
  terms: z.string().optional(),
});

export const CounterOfferPayloadSchema = z.object({
  referenceOfferId: z.string(),
  items: z.array(z.object({
    resourceId: z.string(),
    quantity: z.number().int().positive(),
    proposedPriceMinor: z.number().int().nonnegative(),
  })),
});

export const AcceptPayloadSchema = z.object({
  referenceId: z.string(),
});

export const RejectPayloadSchema = z.object({
  referenceId: z.string(),
  reason: z.string().optional(),
});

export const OrderCreatePayloadSchema = z.object({
  referenceId: z.string(), 
});

export const PaymentRequestPayloadSchema = z.object({
  orderId: z.string(),
  paymentMethod: z.string().optional(),
});

export const PaymentResultPayloadSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  status: z.enum(['SUCCESS', 'FAILED']),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string(),
});

export const CancelPayloadSchema = z.object({
  referenceId: z.string(),
  reason: z.string().optional(),
});

export const CommerceMessagePayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('DISCOVER'), data: DiscoverPayloadSchema }),
  z.object({ type: z.literal('QUOTE_REQUEST'), data: QuoteRequestPayloadSchema }),
  z.object({ type: z.literal('QUOTE'), data: QuotePayloadSchema }),
  z.object({ type: z.literal('OFFER'), data: OfferPayloadSchema }),
  z.object({ type: z.literal('COUNTER_OFFER'), data: CounterOfferPayloadSchema }),
  z.object({ type: z.literal('ACCEPT'), data: AcceptPayloadSchema }),
  z.object({ type: z.literal('REJECT'), data: RejectPayloadSchema }),
  z.object({ type: z.literal('ORDER_CREATE'), data: OrderCreatePayloadSchema }),
  z.object({ type: z.literal('PAYMENT_REQUEST'), data: PaymentRequestPayloadSchema }),
  z.object({ type: z.literal('PAYMENT_RESULT'), data: PaymentResultPayloadSchema }),
  z.object({ type: z.literal('CANCEL'), data: CancelPayloadSchema }),
]);

export type CommerceMessagePayload = z.infer<typeof CommerceMessagePayloadSchema>;

export const CommerceMessageEnvelopeSchema = z.object({
  protocolVersion: z.string(),
  messageId: z.string().uuid(),
  sessionId: z.string(),
  sender: z.string(),
  recipient: z.string(),
  timestamp: z.string().datetime(),
  correlationId: z.string(),
  expiresAt: z.string().datetime().optional(),
  payload: CommerceMessagePayloadSchema,
});

export type CommerceMessageEnvelope = z.infer<typeof CommerceMessageEnvelopeSchema>;
