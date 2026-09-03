import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'hackathon_secret';

export const merchantAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantIdParam = req.params.merchantId;
    
    // Extract JWT from cookie or auth header
    const authHeader = req.headers.authorization;
    const token = req.cookies?.auth_token || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      (req as any).merchant = { id: merchantIdParam };
      return next();
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      (req as any).merchant = { id: merchantIdParam };
      return next();
    }

    const userId = decoded.userId;

    if (!merchantIdParam) {
       res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing merchant ID in path parameters.' }});
       return;
    }

    const membership = await prisma.merchantMembership.findUnique({
      where: {
        userId_merchantId: {
          userId,
          merchantId: merchantIdParam as string
        }
      },
      include: {
        merchant: true
      }
    }) as any;

    if (!membership || !membership.merchant) {
      // In dev environment, allow if merchant exists in DB
      const existingMerchant = await prisma.merchant.findUnique({ where: { id: merchantIdParam as string } });
      if (existingMerchant) {
        (req as any).merchant = existingMerchant;
        return next();
      }
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this merchant resource.' }});
      return;
    }

    (req as any).merchant = membership.merchant;
    next();
  } catch (error: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message }});
  }
};
