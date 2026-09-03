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
       res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing authentication context.' }});
       return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
       res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token.' }});
       return;
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
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this merchant resource.' }});
      return;
    }

    // Inject verified merchant and role into request context
    (req as any).merchant = membership.merchant;
    (req as any).merchantRole = membership.role;
    next();
  } catch (error) {
     res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Authorization verification failed.' }});
  }
};
