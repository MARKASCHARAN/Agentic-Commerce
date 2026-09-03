import { z } from 'zod';

export const MerchantGuardrailConfigSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string(),
  revenueGoal: z.string().default('BALANCED'),
  currency: z.string().default('USD'),
  autonomousPaymentLimitMinor: z.number().int().nonnegative().default(0),
  approvalAboveMinor: z.number().int().nonnegative().default(0),
  maxDiscountBps: z.number().int().nonnegative().max(10000).default(0),
  maxAutonomousDiscountBps: z.number().int().nonnegative().max(10000).default(0),
  maxApprovalDiscountBps: z.number().int().nonnegative().max(10000).default(0),
  minimumMarginBps: z.number().int().nonnegative().max(10000).default(0),
  negotiationEnabled: z.boolean().default(false),
  upsellEnabled: z.boolean().default(false),
  crossSellEnabled: z.boolean().default(false),
  disabledSkills: z.array(z.string()).default([]),
});

export type MerchantGuardrailConfig = z.infer<typeof MerchantGuardrailConfigSchema>;
