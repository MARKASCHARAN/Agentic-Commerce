import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ProtocolEngine } from '../../../modules/agent/protocol/protocol-engine.js';
import { PricingService } from '../../../modules/revenue/pricing-service.js';
import { MerchantDiscoveryService } from '../../../modules/agent/discovery/merchant-discovery.js';
import { RazorpayProvider } from '../../../infrastructure/razorpay/razorpay.provider.js';
import { env } from '../../../config/env.js';
// Mock runtime for now
const agentRuntime: any = {};
import { DecisionLogger } from '../../../modules/audit/decision-logger.js';

const prisma = new PrismaClient();
const decisionLogger = new DecisionLogger(prisma);
const pricingService = new PricingService(prisma);
const paymentProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');
const protocolEngine = new ProtocolEngine(prisma, pricingService, paymentProvider, decisionLogger);
const discoveryService = new MerchantDiscoveryService(prisma);

export class ProtocolController {
  static async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      const { request, constraints, message, merchantId: reqMerchantId, sessionId: reqSessionId, cart } = req.body;
      const buyerId = (req as any).buyerId;

      let targetMerchantId = reqMerchantId;
      let targetAgentId = '';
      let sessionId = reqSessionId;
      const incomingMessage = message || request;

      // Legacy discovery logic if merchantId is not provided
      if (!targetMerchantId) {
        const eligibleMerchants = await discoveryService.discoverMerchants(incomingMessage, constraints);
        if (eligibleMerchants.length === 0) {
          res.json({ message: 'No eligible merchants found for your request.' });
          return;
        }
        targetMerchantId = eligibleMerchants[0].merchantId;
        targetAgentId = eligibleMerchants[0].agentId;
        sessionId = 'conv_' + crypto.randomUUID().slice(0, 8);
      } else {
        targetAgentId = targetMerchantId;
        if (!sessionId) sessionId = 'conv_' + crypto.randomUUID().slice(0, 8);
      }

      // Ensure session exists
      const existingSession = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!existingSession) {
        await prisma.session.create({
          data: {
            id: sessionId,
            merchantId: targetMerchantId,
            state: 'ACTIVE'
          }
        });
      }

      // Sync Cart State if provided by Buyer Agent
      if (cart && Array.isArray(cart)) {
        const { getOrCreateCart, updateCartItems } = await import('../../../modules/commerce/cart-state.js');
        await getOrCreateCart(prisma, sessionId);
        await updateCartItems(prisma, sessionId, cart);
      }

      const runtime = agentRuntime as any;

      await prisma.message.create({
        data: {
          sessionId,
          sender: 'buyer_agent',
          receiver: 'merchant_agent',
          type: 'text',
          payload: { text: incomingMessage, constraints }
        }
      });

      const turnResult = await runtime.execute({
        sessionId,
        agentId: targetAgentId,
        merchantId: targetMerchantId,
        executionId: crypto.randomUUID()
      }, incomingMessage);

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

      let offer = await prisma.offer.findFirst({
        where: {
          sessionId,
          status: { in: ['OFFERED', 'COUNTERED', 'PAYMENT_PENDING'] }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      let order = null;
      if (turnResult.payload?.toolName === 'checkout.create' && turnResult.payload?.result) {
        order = turnResult.payload.result;
      }

      let formattedOffer = null;
      if (offer) {
        formattedOffer = {
          offerId: offer.id,
          status: offer.status,
          items: offer.items,
          subtotalMinor: offer.subtotalMinor,
          discountMinor: offer.discountMinor,
          totalMinor: offer.totalMinor,
          currency: offer.currency,
          expiresAt: offer.expiresAt,
          opportunities: []
        };
      }

      res.json({
        sessionId,
        merchantId: targetMerchantId,
        agentId: targetAgentId,
        response: responseText,
        merchantResponse: responseText,
        offer: formattedOffer,
        order
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getSession(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
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

      let formattedOffer = null;
      if (activeOffer) {
        formattedOffer = {
          offerId: activeOffer.id,
          status: activeOffer.status,
          items: activeOffer.items,
          subtotalMinor: activeOffer.subtotalMinor,
          discountMinor: activeOffer.discountMinor,
          totalMinor: activeOffer.totalMinor,
          currency: activeOffer.currency,
          expiresAt: activeOffer.expiresAt,
          opportunities: []
        };
      }

      res.json({
        sessionId: session.id,
        merchantId: session.merchantId,
        state: session.state,
        messages: session.messages,
        activeOffer: formattedOffer
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async counterOffer(req: Request, res: Response): Promise<void> {
    try {
      const { targetTotalMinor } = req.body;
      const id = req.params.id as string;
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
      const id = req.params.id as string;
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
      const id = req.params.id as string;
      const buyerId = (req as any).buyerId;
      const result = await protocolEngine.rejectOffer(id, buyerId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
