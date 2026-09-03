import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryAuditController {
  static async listEvents(req: Request, res: Response) {
    try {
      const merchantId = req.params.merchantId as string;
      const { limit = 50, offset = 0 } = req.query;

      const [events, total] = await Promise.all([
        prisma.agentDecisionLog.findMany({
          where: { merchantId },
          orderBy: { timestamp: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.agentDecisionLog.count({ where: { merchantId } }),
      ]);

      res.json({ data: events, meta: { total, limit: Number(limit), offset: Number(offset) } });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  }
}
