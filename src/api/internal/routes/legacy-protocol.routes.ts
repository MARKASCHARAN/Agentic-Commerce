import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AgentRuntime } from '../../../agent/runtime/agent-runtime.js';
import { agentRuntime } from './ui.routes.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/interact', async (req, res) => {
  try {
    const { buyerId, sessionId, merchantId, intent } = req.body;

    if (!sessionId || !merchantId || !intent) {
       res.status(400).json({ error: 'Missing required fields: sessionId, merchantId, intent' });
       return;
    }

    if (!agentRuntime) {
      res.status(500).json({ error: 'Agent Runtime not initialized' });
      return;
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { agent: true }
    });

    if (!merchant || !merchant.agent) {
       res.status(404).json({ error: 'Merchant or Agent not found' });
       return;
    }

    let session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      session = await prisma.session.create({
        data: {
          id: sessionId,
          userId: buyerId,
          merchantId: merchantId,
          state: 'ACTIVE'
        }
      });
    }

    await prisma.message.create({
      data: {
        sessionId,
        sender: 'buyer_agent',
        receiver: 'merchant_agent',
        type: 'intent',
        payload: { text: intent }
      }
    });

    const turnResult = await agentRuntime.execute({
      sessionId,
      agentId: merchant.agent.id,
      merchantId: merchant.id,
      executionId: crypto.randomUUID()
    }, intent);

    const responseText = turnResult.message || 'No response';
    await prisma.message.create({
      data: {
        sessionId,
        sender: 'merchant_agent',
        receiver: 'buyer_agent',
        type: 'response',
        payload: { text: responseText, tools: turnResult.executedTools }
      }
    });

    let paymentLinkUrl = null;
    let paymentOrderId = null;

    if (turnResult.executedTools) {
      for (const tool of turnResult.executedTools) {
        if (tool.tool === 'checkout.create' && tool.result?.status === 'success') {
          paymentLinkUrl = tool.result.checkoutData?.paymentLinkUrl;
          paymentOrderId = tool.result.checkoutData?.orderId;
        }
      }
    }

    res.json({
      sessionId,
      merchantId,
      response: responseText,
      paymentLinkUrl,
      paymentOrderId,
      tools: turnResult.executedTools,
      status: turnResult.status
    });

  } catch (error: any) {
    console.error('[Protocol] Error interacting with merchant agent:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
