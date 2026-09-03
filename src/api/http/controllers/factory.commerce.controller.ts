import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FactoryCommerceController {
  static async listOrders(req: Request, res: Response) {
    try {
      const merchantId = req.params.merchantId;
      const { status, limit = 50, offset = 0 } = req.query;

      const where: any = { merchantId };
      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.offer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.offer.count({ where }),
      ]);

      res.json({ data: orders, meta: { total, limit: Number(limit), offset: Number(offset) } });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  }

  static async listPayments(req: Request, res: Response) {
    try {
      const merchantId = req.params.merchantId;
      const { limit = 50, offset = 0 } = req.query;

      // For payments, we just return offers that have a paymentUrl or status='PAID'
      const where: any = {
        merchantId,
        OR: [
          { status: 'PAID' },
          { status: 'PAYMENT_PENDING' }
        ]
      };

      const [payments, total] = await Promise.all([
        prisma.offer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.offer.count({ where }),
      ]);

      res.json({ data: payments, meta: { total, limit: Number(limit), offset: Number(offset) } });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  }
}
