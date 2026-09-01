import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { mcpContextStorage, MCPContext } from './context.js';

const prisma = new PrismaClient();

export async function mcpAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token = 'ac_demo_xxxxxxxxx'; // Default for Hackathon Claude Demo if header is missing

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // In a full production system, we would map the Bearer token to an Agent/Merchant credential.
    // For this hackathon, we assume the token is literally the merchantId for simplicity,
    // OR it falls back to finding a merchant if the token is a dummy like "ac_demo_xxxxxxxxx"
    let merchantId = token;
    
    // Hackathon fallback check
    if (merchantId === 'ac_demo_xxxxxxxxx' || merchantId === 'demo-token') {
      const firstMerchant = await prisma.merchant.findFirst();
      if (!firstMerchant) {
        return res.status(500).json({ error: 'No merchants exist in database to bind context' });
      }
      merchantId = firstMerchant.id;
    } else {
      // Validate it exists
      const exists = await prisma.merchant.findUnique({ where: { id: merchantId } });
      if (!exists) {
        return res.status(401).json({ error: 'Invalid merchant credential' });
      }
    }

    const buyerId = (req.headers['x-buyer-id'] as string) || 'anonymous-buyer';
    const sessionId = (req.headers['mcp-session-id'] as string) || (req.headers['x-session-id'] as string) || `mcp_session_${Date.now()}`;
    const requestId = (req.headers['x-request-id'] as string) || `mcp_req_${Date.now()}`;

    // Ensure session exists in database to satisfy foreign key constraints for ProtocolEngine
    await prisma.session.upsert({
      where: { id: sessionId },
      update: {},
      create: {
        id: sessionId,
        merchantId,
        userId: null,
        state: 'ACTIVE'
      }
    });

    const context: MCPContext = {
      merchantId,
      buyerId,
      sessionId,
      requestId
    };

    // Wrap the entire next() chain in the AsyncLocalStorage context
    mcpContextStorage.run(context, () => {
      next();
    });
  } catch (error) {
    console.error('MCP Auth Error:', error);
    res.status(500).json({ error: 'Internal Server Error during MCP authentication' });
  }
}
