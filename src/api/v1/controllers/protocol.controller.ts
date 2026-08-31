import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ProtocolEngine } from '../../../agent/protocol/protocol-engine.js';
import { PricingService } from '../../../agent/intelligence/pricing-service.js';
import { MerchantDiscoveryService } from '../../../agent/discovery/merchant-discovery.js';
import { RazorpayProvider } from '../../../providers/razorpay/razorpay.provider.js';
import { env } from '../../../config/env.js';
import { AgentRuntime } from '../../../agent/runtime/agent-runtime.js';
import { agentRuntime } from '../../internal/routes/ui.routes.js';

const prisma = new PrismaClient();
const pricingService = new PricingService(prisma);
const paymentProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');
const protocolEngine = new ProtocolEngine(prisma, pricingService, paymentProvider);
const discoveryService = new MerchantDiscoveryService(prisma);

export class ProtocolController {
  static async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      const { request, constraints } = req.body;
      const buyerId = (req as any).buyerId;

      const eligibleMerchants = await discoveryService.discoverMerchants(request, constraints);

      if (eligibleMerchants.length === 0) {
        res.json({ message: 'No eligible merchants found for your request.' });
        return;
      }

      const targetMerchant = eligibleMerchants[0];
      const sessionId = 'conv_' + crypto.randomUUID().slice(0, 8);

      await prisma.session.create({
        data: {
          id: sessionId,
          merchantId: targetMerchant.merchantId,
          state: 'ACTIVE'
        }
      });

      const runtime = agentRuntime as AgentRuntime;

      await prisma.message.create({
        data: {
          sessionId,
          sender: 'buyer_agent',
          receiver: 'merchant_agent',
          type: 'text',
          payload: { text: request, constraints }
        }
      });

      const turnResult = await runtime.execute({
        sessionId,
        agentId: targetMerchant.agentId,
        merchantId: targetMerchant.merchantId,
        executionId: crypto.randomUUID()
      }, request);

      const responseText = turnResult.payload?.text || JSON.stringify(turnResult.payload) || 'No response';
      await prisma.message.create({
        data: {
          sessionId,
          sender: 'merchant_agent',
          receiver: 'buyer_agent',
          type: 'text',
          payload: { text: responseText }
        }
      });

      const itemsToOffer = targetMerchant.matchingProducts.map(p => ({
        productId: p.id,
        quantity: 1
      }));

      let offer = null;
      if (itemsToOffer.length > 0) {
        offer = await protocolEngine.createOffer(targetMerchant.merchantId, buyerId, sessionId, itemsToOffer);
      }

      res.json({
        sessionId,
        merchantId: targetMerchant.merchantId,
        agentId: targetMerchant.agentId,
        merchantResponse: responseText,
        offer
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const buyerId = (req as any).buyerId;

      const session = await prisma.session.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' }
          }
        }
      });

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const activeOffer = await prisma.offer.findFirst({
        where: {
          sessionId: id,
          buyerId,
          status: { in: ['OFFERED', 'COUNTERED', 'PAYMENT_PENDING'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        sessionId: session.id,
        merchantId: session.merchantId,
        state: session.state,
        messages: session.messages,
        activeOffer
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async counterOffer(req: Request, res: Response): Promise<void> {
    try {
      const { targetTotalMinor } = req.body;
      const { id } = req.params;
      const buyerId = (req as any).buyerId;

      const offer = await prisma.offer.findUnique({ where: { id } });
      if (!offer || offer.buyerId !== buyerId) {
        res.status(404).json({ error: 'Offer not found or access denied' });
        return;
      }

      const updatedOffer = await protocolEngine.counterOffer(id, offer.merchantId, targetTotalMinor);
      res.json(updatedOffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async acceptOffer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const buyerId = (req as any).buyerId;

      const result = await protocolEngine.acceptOffer(id, buyerId);

      res.json({
        message: 'Offer accepted and finalized',
        orderId: result.orderId,
        paymentUrl: result.paymentUrl,
        offer: result.offer
      });
    } catch (error: any) {
      console.error('[acceptOffer Error]', error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  }

  static async rejectOffer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const buyerId = (req as any).buyerId;
      const result = await protocolEngine.rejectOffer(id, buyerId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
