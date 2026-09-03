import { PrismaClient } from '@prisma/client';
import { MerchantGuardrailConfig, MerchantGuardrailConfigSchema } from '../../../modules/policy/guardrails';

export class MerchantGuardrailRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getGuardrails(merchantId: string): Promise<MerchantGuardrailConfig | null> {
    const record = await this.prisma.merchantGuardrail.findUnique({
      where: { merchantId },
    });

    if (!record) {
      return null;
    }

    // Prisma returns String[] for disabledSkills since it is TEXT[]
    const config = MerchantGuardrailConfigSchema.parse({
      id: record.id,
      merchantId: record.merchantId,
      revenueGoal: record.revenueGoal,
      currency: record.currency,
      autonomousPaymentLimitMinor: record.autonomousPaymentLimitMinor,
      approvalAboveMinor: record.approvalAboveMinor,
      maxDiscountBps: record.maxDiscountBps,
      maxAutonomousDiscountBps: record.maxAutonomousDiscountBps,
      maxApprovalDiscountBps: record.maxApprovalDiscountBps,
      minimumMarginBps: record.minimumMarginBps,
      negotiationEnabled: record.negotiationEnabled,
      upsellEnabled: record.upsellEnabled,
      crossSellEnabled: record.crossSellEnabled,
      disabledSkills: record.disabledSkills,
    });

    return config;
  }

  async upsertGuardrails(config: Omit<MerchantGuardrailConfig, 'id'>): Promise<MerchantGuardrailConfig> {
    const record = await this.prisma.merchantGuardrail.upsert({
      where: { merchantId: config.merchantId },
      update: {
        revenueGoal: config.revenueGoal,
        currency: config.currency,
        autonomousPaymentLimitMinor: config.autonomousPaymentLimitMinor,
        approvalAboveMinor: config.approvalAboveMinor,
        maxDiscountBps: config.maxDiscountBps,
        maxAutonomousDiscountBps: config.maxAutonomousDiscountBps,
        maxApprovalDiscountBps: config.maxApprovalDiscountBps,
        minimumMarginBps: config.minimumMarginBps,
        negotiationEnabled: config.negotiationEnabled,
        upsellEnabled: config.upsellEnabled,
        crossSellEnabled: config.crossSellEnabled,
        disabledSkills: config.disabledSkills,
      },
      create: {
        merchantId: config.merchantId,
        revenueGoal: config.revenueGoal,
        currency: config.currency,
        autonomousPaymentLimitMinor: config.autonomousPaymentLimitMinor,
        approvalAboveMinor: config.approvalAboveMinor,
        maxDiscountBps: config.maxDiscountBps,
        maxAutonomousDiscountBps: config.maxAutonomousDiscountBps,
        maxApprovalDiscountBps: config.maxApprovalDiscountBps,
        minimumMarginBps: config.minimumMarginBps,
        negotiationEnabled: config.negotiationEnabled,
        upsellEnabled: config.upsellEnabled,
        crossSellEnabled: config.crossSellEnabled,
        disabledSkills: config.disabledSkills,
      },
    });

    return MerchantGuardrailConfigSchema.parse({
      id: record.id,
      merchantId: record.merchantId,
      revenueGoal: record.revenueGoal,
      currency: record.currency,
      autonomousPaymentLimitMinor: record.autonomousPaymentLimitMinor,
      approvalAboveMinor: record.approvalAboveMinor,
      maxDiscountBps: record.maxDiscountBps,
      minimumMarginBps: record.minimumMarginBps,
      negotiationEnabled: record.negotiationEnabled,
      upsellEnabled: record.upsellEnabled,
      crossSellEnabled: record.crossSellEnabled,
      disabledSkills: record.disabledSkills,
    });
  }
}
