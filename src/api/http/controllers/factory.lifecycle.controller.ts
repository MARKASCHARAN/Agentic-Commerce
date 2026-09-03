import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryLifecycleController {
  
  static async validate(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      
      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        include: { guardrails: true, capabilities: true }
      });
      
      if (!merchant) {
        res.status(404).json({ error: { code: 'MERCHANT_NOT_FOUND', message: 'Merchant not found' }});
        return;
      }
      
      const agent = await prisma.agent.findFirst({ where: { owner: merchantId } });
      const productsCount = await prisma.product.count({ where: { merchantId, active: true } });
      
      const checks = [
        {
          id: 'catalog',
          name: 'Active Catalog',
          status: productsCount > 0 ? 'PASSED' : 'FAILED',
          message: productsCount > 0 ? `${productsCount} active products found.` : 'At least one active product is required.'
        },
        {
          id: 'guardrails',
          name: 'Guardrails Configured',
          status: merchant.guardrails ? 'PASSED' : 'FAILED',
          message: merchant.guardrails ? 'Guardrails have been configured.' : 'Guardrails must be configured.'
        },
        {
          id: 'agent',
          name: 'Agent Provisioned',
          status: !!agent ? 'PASSED' : 'FAILED',
          message: agent ? 'Agent provisioned.' : 'No agent found. Provision an agent first.'
        }
      ];
      
      const overallStatus = checks.every(c => c.status === 'PASSED') ? 'READY' : 'NOT_READY';
      
      res.json({ status: overallStatus, checks });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async publish(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      // Ideally call validate internally first
      const merchant = await prisma.merchant.update({
        where: { id: merchantId },
        data: { status: 'ACTIVE' }
      });
      res.json({ success: true, status: merchant.status });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async pause(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const merchant = await prisma.merchant.update({
        where: { id: merchantId },
        data: { status: 'PAUSED' }
      });
      res.json({ success: true, status: merchant.status });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async resume(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const merchant = await prisma.merchant.update({
        where: { id: merchantId },
        data: { status: 'ACTIVE' }
      });
      res.json({ success: true, status: merchant.status });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }
}
