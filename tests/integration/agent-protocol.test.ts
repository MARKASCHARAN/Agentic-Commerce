import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import protocolRoutes from '../../src/api/internal/routes/legacy-protocol.routes.js';
import { PrismaClient } from '@prisma/client';

vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    merchant: {
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    }
  };
  return { PrismaClient: vi.fn(() => mPrismaClient) };
});

describe('Protocol Routes', () => {
  let app: express.Express;
  let mockAgentRuntime: any;
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = new PrismaClient();
    
    mockAgentRuntime = {
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        message: 'I can offer that',
        executedTools: [{
          tool: 'checkout.create',
          result: {
            status: 'success',
            checkoutData: {
              paymentLinkUrl: 'https://rzp.io/test',
              orderId: 'order_123'
            }
          }
        }]
      })
    };

    app = express();
    app.use(express.json());
    app.locals.agentRuntime = mockAgentRuntime;
    app.use('/api/protocol', protocolRoutes);
  });

  it('should process a buyer intent and return a payment link', async () => {
    (prisma.merchant.findUnique as any).mockResolvedValue({
      id: 'merchant_123',
      agent: { id: 'agent_123' }
    });
    
    (prisma.session.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'session_123' });

    const response = await request(app)
      .post('/api/protocol/interact')
      .send({
        buyerId: 'buyer_123',
        sessionId: 'session_123',
        merchantId: 'merchant_123',
        intent: 'I want to buy a laptop'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sessionId: 'session_123',
      merchantId: 'merchant_123',
      response: 'I can offer that',
      paymentLinkUrl: 'https://rzp.io/test',
      paymentOrderId: 'order_123',
      status: 'completed'
    });

    expect(mockAgentRuntime.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_123',
        agentId: 'agent_123',
        merchantId: 'merchant_123'
      }),
      'I want to buy a laptop'
    );
  });
});
