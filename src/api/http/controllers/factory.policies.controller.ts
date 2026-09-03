import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryPoliciesController {
  
  static async getGuardrails(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const guardrails = await prisma.merchantGuardrail.findUnique({
        where: { merchantId }
      });
      res.json({ guardrails });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async updateGuardrails(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const data = req.body;
      
      const guardrails = await prisma.merchantGuardrail.upsert({
        where: { merchantId },
        update: {
          businessType: data.businessType,
          revenueGoal: data.revenueGoal,
          currency: data.currency,
          autonomousPaymentLimitMinor: data.autonomousPaymentLimitMinor,
          approvalAboveMinor: data.approvalAboveMinor,
          maxDiscountBps: data.maxDiscountBps,
          maxAutonomousDiscountBps: data.maxAutonomousDiscountBps,
          maxApprovalDiscountBps: data.maxApprovalDiscountBps,
          minimumMarginBps: data.minimumMarginBps,
          negotiationEnabled: data.negotiationEnabled,
          maxNegotiationRounds: data.maxNegotiationRounds,
          upsellEnabled: data.upsellEnabled,
          crossSellEnabled: data.crossSellEnabled,
          disabledSkills: data.disabledSkills,
        },
        create: {
          merchantId,
          businessType: data.businessType || 'retail',
          revenueGoal: data.revenueGoal || 'BALANCED',
          currency: data.currency || 'INR',
          autonomousPaymentLimitMinor: data.autonomousPaymentLimitMinor || 0,
          approvalAboveMinor: data.approvalAboveMinor || 0,
          maxDiscountBps: data.maxDiscountBps || 0,
          maxAutonomousDiscountBps: data.maxAutonomousDiscountBps || 0,
          maxApprovalDiscountBps: data.maxApprovalDiscountBps || 0,
          minimumMarginBps: data.minimumMarginBps || 0,
          negotiationEnabled: data.negotiationEnabled || false,
          maxNegotiationRounds: data.maxNegotiationRounds || 4,
          upsellEnabled: data.upsellEnabled || false,
          crossSellEnabled: data.crossSellEnabled || false,
          disabledSkills: data.disabledSkills || [],
        }
      });
      
      res.json({ guardrails });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async getCapabilities(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const capabilities = await prisma.merchantCapability.findMany({
        where: { merchantId }
      });
      res.json({ capabilities });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async updateCapabilities(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const { capabilities } = req.body;
      
      if (!Array.isArray(capabilities)) {
        res.status(400).json({ error: { code: 'INVALID_CAPABILITIES', message: 'Capabilities must be an array' }});
        return;
      }
      
      await prisma.$transaction(async (tx) => {
        // Remove old capabilities
        await tx.merchantCapability.deleteMany({
          where: { merchantId }
        });
        
        // Insert new ones
        if (capabilities.length > 0) {
          await tx.merchantCapability.createMany({
            data: capabilities.map((cap: string) => ({
              merchantId,
              capability: cap
            }))
          });
        }
      });

      const updated = await prisma.merchantCapability.findMany({
        where: { merchantId }
      });
      
      res.json({ capabilities: updated });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }
}
