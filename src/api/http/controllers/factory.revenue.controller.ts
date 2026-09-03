import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryRevenueController {
  static async listOpportunities(req: Request, res: Response) {
    try {
      const merchantId = req.params.merchantId;
      const { status, limit = 50, offset = 0 } = req.query;

      const where: any = { merchantId };
      if (status) {
        where.status = status;
      }

      const [opportunities, total] = await Promise.all([
        prisma.revenueOpportunityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.revenueOpportunityLog.count({ where }),
      ]);

      res.json({ data: opportunities, meta: { total, limit: Number(limit), offset: Number(offset) } });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  }
}
