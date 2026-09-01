import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import protocolRoutes from '../../src/api/v1/routes/protocol.routes.js';
import { PrismaClient } from '@prisma/client';

// Mock dependencies before importing routes
vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    merchant: { findUnique: vi.fn(), findMany: vi.fn() },
    session: { findUnique: vi.fn(), create: vi.fn() },
    message: { create: vi.fn(), findMany: vi.fn() },
    offer: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    commerceOrder: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    agentDecisionLog: { create: vi.fn() },
    $transaction: vi.fn((cb) => cb(mPrismaClient))
  };
  return { PrismaClient: class { constructor() { return mPrismaClient; } } };
});

// Mock ui.routes to avoid instantiating the real AgentRuntime and BullMQ
vi.mock('../../src/api/internal/routes/ui.routes.js', () => {
  return {
    agentRuntime: {
      execute: vi.fn().mockResolvedValue({
        payload: {
          text: 'I can offer that',
          toolName: 'checkout.create',
          result: {
            paymentLinkUrl: 'https://rzp.io/test',
            orderId: 'order_123'
          }
        }
      })
    }
  };
});

describe('Protocol Routes', () => {
  let app: express.Express;
  let prisma: any;
  let agentRuntime: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = new PrismaClient();
    const uiRoutes = await import('../../src/api/internal/routes/ui.routes.js');
    agentRuntime = uiRoutes.agentRuntime;
    
    app = express();
    app.use(express.json());
    
    // Add fake auth middleware matching v1 protocol
    app.use((req: any, res, next) => {
      req.buyerId = req.headers['x-buyer-id'] || 'buyer_123';
      next();
    });
    
    app.use('/api/v1/protocol', protocolRoutes);
  });

  it('should process a buyer intent and return a simulated runtime response', async () => {
    (prisma.merchant.findUnique as any).mockResolvedValue({
      id: 'merchant_123',
      userId: 'user_123'
    });
    
    (prisma.session.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'session_123', merchantId: 'merchant_123', state: 'ACTIVE' });

    const response = await request(app)
      .post('/api/v1/protocol/requests')
      .set('x-buyer-id', 'buyer_123')
      .send({
        sessionId: 'session_123',
        merchantId: 'merchant_123',
        message: 'I want to buy a laptop'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sessionId: 'session_123',
      merchantId: 'merchant_123',
      response: 'I can offer that'
    });

    expect(agentRuntime.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_123',
        merchantId: 'merchant_123'
      }),
      'I want to buy a laptop'
    );
  });
});
