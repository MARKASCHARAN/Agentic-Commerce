import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApprovalRepository } from '../../../infrastructure/database/repositories/approval.repository.js';
import { getSessionExperimentGroup } from '../../../modules/revenue/experiment.js';
import { GenUIBuilder } from '../../../modules/agent/genui/genui.builder.js';
import { BackgroundCommerceScanner } from '../../../modules/agent/scheduler/background-scanner.js';

const router = Router();
const prisma = new PrismaClient();
export const approvalRepository = new ApprovalRepository(prisma);


export async function getDashboardMetrics(prisma: PrismaClient, merchantId: string) {
  const scanner = new BackgroundCommerceScanner(prisma);
  await scanner.scanAll(merchantId);

  const orders = await prisma.commerceOrder.findMany({ where: { merchantId } });

  const orderIds = orders.map(o => o.id);
  const payments = await prisma.paymentIntent.findMany({
    where: { orderId: { in: orderIds } }
  });

  const opps = await prisma.revenueOpportunityLog.findMany({
    where: { merchantId }
  });

  const sessions = await prisma.session.findMany({
    where: { merchantId }
  });

  const assistedSessions = sessions.filter(s => getSessionExperimentGroup(s.id) === 'ASSISTED');
  const controlSessions = sessions.filter(s => getSessionExperimentGroup(s.id) === 'CONTROL');

  const completedOrders = orders.filter(o => o.status === 'captured' || o.status === 'completed' || o.status === 'paid');
  const assistedOrders = completedOrders.filter(o => getSessionExperimentGroup(o.sessionId) === 'ASSISTED');
  const controlOrders = completedOrders.filter(o => getSessionExperimentGroup(o.sessionId) === 'CONTROL');

  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const assistedRevenue = assistedOrders.reduce((sum, o) => sum + o.total, 0);
  const controlRevenue = controlOrders.reduce((sum, o) => sum + o.total, 0);

  const convertedOpps = opps.filter(o => o.status === 'CONVERTED');
  const aiAssistedRevenue = convertedOpps.reduce((sum, o) => sum + (o.realizedImpactMinor || 0) / 100, 0);

  const assistedAOV = assistedOrders.length > 0 ? assistedRevenue / assistedOrders.length : 0;
  const controlAOV = controlOrders.length > 0 ? controlRevenue / controlOrders.length : 0;

  const assistedConvRate = assistedSessions.length > 0 ? (assistedOrders.length / assistedSessions.length) * 100 : 0;
  const controlConvRate = controlSessions.length > 0 ? (controlOrders.length / controlSessions.length) * 100 : 0;

  const assistedRevPerSession = assistedSessions.length > 0 ? assistedRevenue / assistedSessions.length : 0;
  const controlRevPerSession = controlSessions.length > 0 ? controlRevenue / controlSessions.length : 0;

  const conversionUplift = assistedConvRate - controlConvRate;
  const aovUplift = assistedAOV - controlAOV;
  const revPerSessionUplift = assistedRevPerSession - controlRevPerSession;

  const calcRate = (type: string) => {
    const typeOpps = opps.filter(o => o.opportunityType === type);
    if (typeOpps.length === 0) return 0;
    const converted = typeOpps.filter(o => o.status === 'CONVERTED');
    return (converted.length / typeOpps.length) * 100;
  };

  const upsellRate = calcRate('UPSELL');
  const crossSellRate = calcRate('CROSS_SELL');
  const recoveryRate = calcRate('RECOVERY');
  const repeatPurchaseRate = calcRate('REPEAT_PURCHASE');

  return {
    merchantId,
    totalOrders: orders.length,
    totalRevenue,
    aiAssistedRevenue,
    incrementalRevenue: aiAssistedRevenue,
    convertedOpportunities: convertedOpps.length,
    performanceRates: {
      upsellRate,
      crossSellRate,
      recoveryRate,
      repeatPurchaseRate
    },

    cohorts: {
      assisted: {
        sessions: assistedSessions.length,
        orders: assistedOrders.length,
        revenue: assistedRevenue,
        aov: assistedAOV,
        conversionRate: assistedConvRate,
        revenuePerSession: assistedRevPerSession
      },
      control: {
        sessions: controlSessions.length,
        orders: controlOrders.length,
        revenue: controlRevenue,
        aov: controlAOV,
        conversionRate: controlConvRate,
        revenuePerSession: controlRevPerSession
      },
      uplift: {
        conversionRate: conversionUplift,
        aov: aovUplift,
        revenuePerSession: revPerSessionUplift
      }
    },
    orders,
    payments,
    opportunities: opps
  };
}

router.get('/dashboard', async (req: Request, res: Response) => {
  try {

    const merchantId = (req.query.merchantId as string | undefined) || (req.headers['x-merchant-id'] as string | undefined);
    if (!merchantId || typeof merchantId !== 'string' || merchantId.trim() === '') {
      res.status(400).json({ error: 'merchantId is required. Provide it as ?merchantId= query param or X-Merchant-Id header.' });
      return;
    }

    const metrics = await getDashboardMetrics(prisma, merchantId);
    res.json(metrics);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/approval/decide', async (req: Request, res: Response) => {
  try {
    const { opportunityId, merchantId, decision, approverId } = req.body;

    if (!opportunityId || !merchantId || !decision) {
      res.status(400).json({ error: 'opportunityId, merchantId, and decision (APPROVE or REJECT) are required' });
      return;
    }

    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      res.status(400).json({ error: 'decision must be APPROVE or REJECT' });
      return;
    }

    const opp = await prisma.revenueOpportunityLog.findFirst({
      where: { id: opportunityId, merchantId }
    });

    if (!opp) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }

    const newStatus = decision === 'APPROVE' ? 'ACCEPTED' : 'REJECTED';

    await prisma.revenueOpportunityLog.update({
      where: { id: opportunityId },
      data: {
        status: newStatus,
        updatedAt: new Date()
      }
    });

    await prisma.message.create({
      data: {
        sessionId: opp.sessionId,
        sender: approverId || 'human_operator',
        receiver: 'system',
        type: 'audit_event',
        payload: {
          event: 'HUMAN_APPROVAL_DECISION',
          opportunityId,
          decision,
          approverId: approverId || 'human_operator',
          timestamp: new Date().toISOString()
        }
      }
    });

    res.json({
      success: true,
      opportunityId,
      status: newStatus,
      decision,
      approverId: approverId || 'human_operator'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/approvals/:token/approve', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const approval = await approvalRepository.getByToken(token as string);
    if (!approval) {
      res.status(404).json({ error: 'Invalid or expired approval token' });
      return;
    }

    if (approval.status !== 'PENDING') {
      res.status(400).json({ error: `Approval is already ${approval.status}` });
      return;
    }

    if (new Date() > new Date(approval.expiresAt)) {
      res.status(400).json({ error: 'Approval link has expired' });
      return;
    }

    await approvalRepository.updateStatus(approval.id, 'APPROVED');

    const payload = approval.payload as any;

    if (payload && payload.cartStateHash) {
      const currentCart = await prisma.cart.findUnique({ where: { sessionId: payload.context.sessionId } });
      const currentHash = Buffer.from(JSON.stringify(currentCart?.items || [])).toString('base64');
      if (currentHash !== payload.cartStateHash) {
        await approvalRepository.updateStatus(approval.id, 'REJECTED');
        res.status(409).json({ error: 'State Mismatch: The buyer cart has changed since this approval was generated.' });
        return;
      }
    }

    if (payload && payload.toolName) {
      try {
        const msgText = `Merchant has approved the transaction. Checkout successful!`;

        await prisma.message.create({
          data: {
            sessionId: payload.context.sessionId,
            sender: 'system',
            receiver: 'user',
            type: 'text',
            payload: {
              text: msgText
            }
          }
        });

        res.json({ success: true, message: 'Transaction authorized successfully' });
      } catch (err: any) {
        res.status(500).json({ error: 'Action failed', details: err.message });
      }
    } else {
      res.json({ success: true, message: 'Approval granted but no action was executed' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/approvals/:token/reject', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const approval = await approvalRepository.getByToken(token as string);
    if (!approval) {
      res.status(404).json({ error: 'Invalid or expired approval token' });
      return;
    }

    if (approval.status !== 'PENDING') {
      res.status(400).json({ error: `Approval is already ${approval.status}` });
      return;
    }

    await approvalRepository.updateStatus(approval.id, 'REJECTED');

    const payload = approval.payload as any;
    if (payload && payload.context) {
      await prisma.message.create({
        data: {
          sessionId: payload.context.sessionId,
          sender: 'system',
          receiver: 'user',
          type: 'text',
          payload: {
            text: `Merchant has rejected the transaction.`
          }
        }
      });
    }

    res.json({ success: true, message: 'Transaction rejected' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/genui', async (req: Request, res: Response) => {
  try {
    const { component, data } = req.body;
    let card;

    switch (component) {
      case 'PRODUCT':
        card = GenUIBuilder.renderProduct(data.product, data.inventoryQty || 0);
        break;
      case 'OFFER':
        card = GenUIBuilder.renderOffer(data.opportunity);
        break;
      case 'QUOTE':
        card = GenUIBuilder.renderQuote(data.cartId, data.items || []);
        break;
      case 'NEGOTIATION':
        card = GenUIBuilder.renderNegotiation(data.proposal);
        break;
      case 'CHECKOUT':
        card = GenUIBuilder.renderCheckout(data.orderId, data.totalMinor, data.currency || 'INR', data.items || []);
        break;
      case 'PAYMENT':
        card = GenUIBuilder.renderPayment(data.razorpayOrderId, data.amountMinor, data.currency || 'INR', data.razorpayKeyId);
        break;
      case 'APPROVAL':
        card = GenUIBuilder.renderApproval(data.opportunityId, data.type, data.amountMinor, data.thresholdMinor);
        break;
      case 'RECOVERY':
        card = GenUIBuilder.renderRecovery(data.opportunityId, data.reason, data.discountBps, data.cartItems || []);
        break;
      case 'FAILURE':
        card = GenUIBuilder.renderFailure(data.code || 'UNKNOWN_ERROR', data.message || 'An error occurred');
        break;
      case 'REVENUE_IMPACT':
        card = GenUIBuilder.renderRevenueImpact(data.metrics);
        break;
      case 'AUDIT_TIMELINE':
        card = GenUIBuilder.renderAuditTimeline(data.events || []);
        break;
      default:
        res.status(400).json({ error: `Unknown GenUI component type: ${component}` });
        return;
    }

    res.json({ card });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/merchant/:merchantId/audit/:sessionId', async (req: Request, res: Response) => {
  try {
    const { merchantId, sessionId } = req.params;
    
    // In a real app, we'd verify merchant authentication here.
    // For the demo, we just fetch the logs.
    const logs = await prisma.agentDecisionLog.findMany({
      where: {
        merchantId: merchantId as string,
        sessionId: sessionId as string
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
