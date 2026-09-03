import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class FactoryAgentController {
  
  static async getAgent(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const agent = await prisma.agent.findFirst({
        where: { owner: merchantId }
      });
      
      if (!agent) {
        res.status(404).json({ error: { code: 'AGENT_NOT_FOUND', message: 'No agent provisioned for this merchant' }});
        return;
      }
      
      res.json({ agent });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async provisionAgent(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      
      // Idempotency check: see if agent already exists
      let agent = await prisma.agent.findFirst({
        where: { owner: merchantId }
      });

      if (!agent) {
        // Create new agent
        agent = await prisma.agent.create({
          data: {
            owner: merchantId,
            role: 'merchant_commerce_agent',
            permissions: ['manage_offers', 'negotiate', 'manage_orders']
          }
        });

        // Provision a fresh credential
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await prisma.agentCredential.create({
          data: {
            agentId: agent.id,
            provider: 'mcp_direct',
            credentials_hash: tokenHash
          }
        });

        res.json({ 
          agent, 
          credential: {
            token: rawToken,
            note: 'Store this securely. It will not be shown again.'
          }
        });
        return;
      }
      
      res.json({ agent, message: 'Agent already provisioned' });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }

  static async rotateCredential(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = (req.params.merchantId as string);
      const agent = await prisma.agent.findFirst({
        where: { owner: merchantId }
      });

      if (!agent) {
        res.status(404).json({ error: { code: 'AGENT_NOT_FOUND', message: 'No agent found' }});
        return;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.$transaction(async (tx) => {
        await tx.agentCredential.deleteMany({
          where: { agentId: agent.id, provider: 'mcp_direct' }
        });
        await tx.agentCredential.create({
          data: {
            agentId: agent.id,
            provider: 'mcp_direct',
            credentials_hash: tokenHash
          }
        });
      });

      res.json({ 
        success: true,
        credential: {
          token: rawToken,
          note: 'Store this securely. It will not be shown again.'
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: e.message }});
    }
  }
}
