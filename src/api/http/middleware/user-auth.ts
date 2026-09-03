import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hackathon_secret';

export const userAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    (req as any).user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
     res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Authorization verification failed.' }});
  }
};
