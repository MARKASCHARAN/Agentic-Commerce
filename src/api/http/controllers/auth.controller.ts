import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'hackathon_secret';

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: { message: 'Email and password are required' } });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: { message: 'Email already exists' } });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name
        }
      });

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(201).json({ data: { user: { id: user.id, email: user.email, name: user.name } } });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: { message: 'Email and password are required' } });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.password) {
        return res.status(401).json({ error: { message: 'Invalid email or password' } });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: { message: 'Invalid email or password' } });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({ data: { user: { id: user.id, email: user.email, name: user.name } } });
    } catch (error: any) {
      res.status(500).json({ error: { message: error.message } });
    }
  }

  static async logout(req: Request, res: Response) {
    res.clearCookie('auth_token');
    res.json({ success: true });
  }

  static async me(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = req.cookies.auth_token || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
      
      if (!token) {
        return res.status(401).json({ error: { message: 'Unauthorized' } });
      }
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, merchants: true }
      });

      if (!user) {
        return res.status(404).json({ error: { message: 'User not found' } });
      }

      res.json({ data: user });
    } catch (error: any) {
      res.status(401).json({ error: { message: 'Invalid token' } });
    }
  }
}
