import { z } from 'zod';

export const NegotiationPolicySchema = z.object({
  enabled: z.boolean(),
  maxDiscountBps: z.number().nonnegative().optional(),
  minimumMarginBps: z.number().nonnegative().optional(),
  quantityDiscountTiers: z.array(z.object({
    minQuantity: z.number().int().positive(),
    discountBps: z.number().nonnegative()
  })).optional(),
  negotiable: z.boolean(),
  absoluteFloorMinor: z.number().int().nonnegative().optional(),
});
export type NegotiationPolicy = z.infer<typeof NegotiationPolicySchema>;

export const NegotiationProposalSchema = z.object({
  resourceId: z.string(),
  quantity: z.number().int().positive(),
  originalPriceMinor: z.number().int().nonnegative(),
  proposedPriceMinor: z.number().int().nonnegative(),
  currency: z.string(),
  costMinor: z.number().int().nonnegative().optional(),
});
export type NegotiationProposal = z.infer<typeof NegotiationProposalSchema>;

export const NegotiationResultSchema = z.object({
  allowed: z.boolean(),
  approvedPriceMinor: z.number().int().nonnegative().optional(),
  reason: z.string(),
  appliedRule: z.string().optional(),
  savingsMinor: z.number().int().nonnegative().optional(),
  marginMinor: z.number().int().optional(),
});
export type NegotiationResult = z.infer<typeof NegotiationResultSchema>;
