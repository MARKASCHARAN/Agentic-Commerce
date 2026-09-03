import { Request, Response, NextFunction } from 'express';

export const requireBuyerId = (req: Request, res: Response, next: NextFunction): void => {
  const buyerId = req.headers['x-buyer-id'];
  if (!buyerId) {
    res.status(401).json({ error: 'Missing x-buyer-id header' });
    return;
  }
  (req as any).buyerId = buyerId;
  next();
};
