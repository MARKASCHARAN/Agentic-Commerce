import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryMerchantController {
  
  static async listMerchants(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }
      
      const memberships = await prisma.merchantMembership.findMany({
        where: { userId: user.id },
        include: {
          merchant: {
            include: {
              guardrails: true,
              strategy: true,
              capabilities: true
            }
          }
        }
      });
      const merchants = memberships.map((m: any) => m.merchant);
      res.json({ merchants });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async getDraftMerchant(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const membership = await prisma.merchantMembership.findFirst({
        where: { 
          userId: user.id,
          merchant: { status: 'DRAFT' }
        },
        include: {
          merchant: {
            include: { guardrails: true, strategy: true, capabilities: true, products: true, inventories: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!membership || !membership.merchant) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No draft merchant found' }});
        return;
      }
      
      res.json({ merchant: membership.merchant });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async getMerchant(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        include: {
          guardrails: true,
          strategy: true,
          capabilities: true
        }
      });
      
      if (!merchant) {
        res.status(404).json({ error: { code: 'MERCHANT_NOT_FOUND', message: 'Merchant not found' }});
        return;
      }
      
      res.json({ merchant });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async updateMerchant(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const updates = req.body;
      
      const merchant = await prisma.merchant.update({
        where: { id: merchantId },
        data: updates
      });
      
      res.json({ merchant });
    } catch (e: any) {
      if (e.code === 'P2025') {
        res.status(404).json({ error: { code: 'MERCHANT_NOT_FOUND', message: 'Merchant not found' }});
        return;
      }
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }
  
  static async deleteMerchant(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      
      await prisma.$transaction(async (tx) => {
        await tx.merchantCapability.deleteMany({ where: { merchantId } });
        await tx.merchantGuardrail.deleteMany({ where: { merchantId } });
        await tx.merchantStrategy.deleteMany({ where: { merchantId } });
        await tx.inventory.deleteMany({ where: { merchantId } });
        await tx.product.deleteMany({ where: { merchantId } });
        await tx.merchantMembership.deleteMany({ where: { merchantId } });
        
        await tx.merchant.delete({
          where: { id: merchantId }
        });
      });
      
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Delete Merchant Error]', e);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message || 'Failed to delete workspace' }});
    }
  }
}
