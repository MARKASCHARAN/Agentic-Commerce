import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AgentRuntime } from '../../agent/runtime/agent-runtime.js';
import { ToolGateway } from '../../agent/tools/tool-gateway.js';
import { ToolRegistry } from '../../agent/tools/tool-registry.js';
import { SkillRegistry } from '../../agent/skills/skill-registry.js';
import { IdempotencyEngine } from '../../agent/idempotency/engine.js';
import { PolicyEngine } from '../../agent/policy/policy-engine.js';
import { RiskGate } from '../../agent/risk/risk-gate.js';
import { PrismaCatalogProvider } from '../../catalog/prisma-catalog.provider.js';
import { createCatalogSearchTool, createCatalogGetTool, createInventoryCheckTool, createInventoryReserveTool } from '../../agent/tools/catalog/catalog.tools.js';
import { createCheckoutTool } from '../../agent/tools/payment/checkout.tools.js';
import { createNegotiationTool } from '../../agent/tools/payment/negotiation.tools.js';
import { RazorpayProvider } from '../../providers/razorpay/razorpay.provider.js';
import { PrismaIdempotencyRepository } from '../../database/repositories/idempotency.repository.js';
import { env } from '../../config/env.js';
import crypto from 'crypto';
import { ModelGateway } from '../../models/gateway/model-gateway.js';
import { AgentEventEmitter } from '../../agent/runtime/types.js';
import { RevenueIntelligenceEngine } from '../../agent/intelligence/revenue-engine.js';
import { RevenueTracker } from '../../agent/intelligence/revenue-tracker.js';
import { MerchantCapabilityResolver } from '../../agent/intelligence/capability-resolver.js';
import { MerchantCapabilityRepository } from '../../database/repositories/merchant-capability.repository.js';
import { MerchantGuardrailRepository } from '../../database/repositories/merchant-guardrail.repository.js';
import { getOrCreateCart } from '../../agent/cart/cart-state.js';
import { getSessionExperimentGroup } from '../../agent/intelligence/experiment.js';
import { GenUIBuilder } from '../../agent/genui/genui.builder.js';
import { BackgroundCommerceScanner } from '../../agent/scheduler/background-scanner.js';

const router = Router();
const prisma = new PrismaClient();

// Initialize the primary path components
const guardrailRepository = new MerchantGuardrailRepository(prisma);
const toolRegistry = new ToolRegistry();
const catalogProvider = new PrismaCatalogProvider(prisma);
const razorpayProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');

toolRegistry.register(createCatalogSearchTool(catalogProvider));
toolRegistry.register(createCatalogGetTool(catalogProvider, catalogProvider));
toolRegistry.register(createInventoryCheckTool(catalogProvider));
toolRegistry.register(createInventoryReserveTool(prisma));
toolRegistry.register(createCheckoutTool(catalogProvider, catalogProvider, razorpayProvider, prisma));
toolRegistry.register(createNegotiationTool(catalogProvider, guardrailRepository, prisma));

const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
const idempotencyEngine = new IdempotencyEngine(idempotencyRepo);
const policyEngine = {
  evaluate: async () => ({ status: 'ALLOW' }),
} as any;
const riskGate = new RiskGate([]);

// --- DB-backed capability resolver (shared across all merchants) ---
const capabilityRepository = new MerchantCapabilityRepository();
const capabilityResolver = new MerchantCapabilityResolver(capabilityRepository);

// ToolGateway uses DB-backed capabilities per-merchant
const toolGateway = new ToolGateway({
  toolRegistry,
  policyEngine,
  idempotencyEngine,
  riskGate,
  capabilityResolver: capabilityResolver as any,
  eventEmitter: { emit: () => {} }
});

const revenueTracker = new RevenueTracker(prisma);
// RevenueEngine uses DB-backed capability resolver and prisma for dynamic catalog
const revenueEngine = new RevenueIntelligenceEngine(
  policyEngine as any,
  {} as any,
  capabilityResolver,
  prisma
);

const modelGateway = new ModelGateway();

const agentRuntime = new AgentRuntime({
  modelGateway: modelGateway,
  stateManager: {
    createExecution: async () => {},
    loadContext: async (identity: any, task: string) => {
      const sessionId = identity.sessionId;
      const merchantId = identity.merchantId;

      // Load or create cart in DB — empty by default (buyer discovers via catalog)
      const cart = await getOrCreateCart(prisma, sessionId);
      const cartItems = cart.items as any[];
      const cartProductIds = cartItems.map(i => i.productId);

      // Load conversation history from DB
      const dbMessages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' }
      });
      const messages = dbMessages.map(m => {
        const payload = m.payload as any;
        return {
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: payload.text || payload.content || String(payload)
        };
      });

      // Fetch proposed/rejected opportunities for E2E diagnostic logging
      const proposedOpps = await prisma.revenueOpportunityLog.findMany({
        where: { sessionId, status: 'PROPOSED' }
      });

      // Fetch merchant name for domain-neutral system prompt
      const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
      const merchantName = merchant?.name ?? merchantId;

      // Context Hydration for Revenue Intelligence
      const allOrders = await prisma.commerceOrder.findMany({
        where: { sessionId, merchantId },
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      });

      const lastOrder = allOrders[0];
      const completedOrders = allOrders.filter(o => ['completed', 'paid', 'captured'].includes(o.status));

      let paymentFailed = false;
      let checkoutAbandoned = false;
      let replenishmentDue = false;
      let currentPlanId: string | undefined = undefined;

      if (lastOrder) {
        if (lastOrder.status === 'failed') {
          paymentFailed = true;
        } else if (lastOrder.status === 'pending' || lastOrder.status === 'created') {
          checkoutAbandoned = true;
        }
      }

      if (completedOrders.length > 0) {
        currentPlanId = completedOrders[0].items[0]?.productId;

        for (const order of completedOrders) {
          for (const item of order.items) {
            const product = await prisma.product.findUnique({ where: { id: item.productId } });
            if (product && product.description) {
              const repMatch = product.description.match(/<!--\s*replenishmentDays:\s*(\d+)\s*-->/);
              if (repMatch) {
                const days = parseInt(repMatch[1], 10);
                const orderDate = new Date(order.createdAt);
                const daysSinceOrder = (new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceOrder >= days) {
                  replenishmentDue = true;
                }
              }
            }
          }
        }
      }

      const buyerRequestedReorder = /reorder|buy again|replenish|order again/i.test(task);
      const upgradeMatch = task.match(/(?:upgrade|add)(?:\s+to)?\s+(\d+)\s+seats?/i);
      const requestedSeats = upgradeMatch ? parseInt(upgradeMatch[1], 10) : undefined;
      const wantsUpgrade = /upgrade/i.test(task) || requestedSeats !== undefined;

      console.log(`[E2E State Diagnostics]
- sessionId: ${sessionId}
- executionId: ${identity.executionId}
- merchantId: ${merchantId}
- merchantName: ${merchantName}
- cartId: ${sessionId}
- cartItems: ${JSON.stringify(cartItems)}
- pendingOpportunities: ${JSON.stringify(proposedOpps.map(o => o.id))}
- rejectedOpportunities: ${JSON.stringify(cart.rejectedOpportunities)}
`);

      return {
        identity: { sessionId, executionId: identity.executionId, merchantId },
        task: task,
        conversation: { messages },
        runtimeMetadata: {},
        scopedData: {
          cartItems,
          cartProductIds,
          rejectedOpportunities: cart.rejectedOpportunities,
          merchantName,
          paymentFailed,
          checkoutAbandoned,
          replenishmentDue,
          currentPlanId,
          buyerRequestedReorder,
          requestedSeats,
          wantsUpgrade
        }
      };
    },
    saveState: async () => {}
  } as any,
  toolGateway,
  skillSelector: { selectSkill: async () => null },
  eventEmitter: { emit: () => {} } as AgentEventEmitter,
  skillRegistry: new SkillRegistry(),
  revenueTracker,
  revenueEngine,
  capabilityResolver,
  guardrailRepository,
  prisma
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId: bodySessionId, merchantId: bodyMerchantId } = req.body;

    // Resolve merchantId from request body or header — fail clearly if absent
    const merchantId = bodyMerchantId || (req.headers['x-merchant-id'] as string | undefined);
    if (!merchantId || typeof merchantId !== 'string' || merchantId.trim() === '') {
      res.status(400).json({ error: 'merchantId is required. Provide it in the request body or as the X-Merchant-Id header.' });
      return;
    }

    // Require a valid sessionId — do NOT fall back to a shared session
    const sessionId = bodySessionId;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      res.status(400).json({ error: 'sessionId is required.' });
      return;
    }

    // Ensure session exists in DB (FK required by CommerceOrder and other models)
    await prisma.session.upsert({
      where: { id: sessionId },
      update: {},
      create: { id: sessionId, merchantId }
    });

    // Save user's incoming message to DB
    await prisma.message.create({
      data: {
        sessionId,
        sender: 'user',
        receiver: 'agent',
        type: 'text',
        payload: { text: message }
      }
    });
    
    // Generate a stable execution ID based on the message so repeated "buy" clicks are idempotent,
    // but we add a version or prefix so it breaks cache from previous runs.
    const executionId = crypto.createHash('sha256').update(`v9-${sessionId}-${message.toLowerCase().trim()}`).digest('hex');

    const executionStartTime = new Date();
    // We invoke the REAL AgentRuntime which triggers the REAL ToolGateway -> REAL Providers
    const result = await agentRuntime.execute({
      sessionId,
      executionId,
      merchantId
    }, message);

    // After execution, check if a NEW opportunity was proposed
    const latestOpp = await prisma.revenueOpportunityLog.findFirst({
      where: { sessionId, merchantId, status: 'PROPOSED', createdAt: { gte: executionStartTime } },
      orderBy: { createdAt: 'desc' }
    });

    let genuiCard: any = undefined;
    if (latestOpp) {
      if (latestOpp.opportunityType === 'RECOVERY') {
        genuiCard = GenUIBuilder.renderRecovery(latestOpp.id, 'Special offer to complete your order', 1000, []);
      } else {
        genuiCard = GenUIBuilder.renderOffer({
          id: latestOpp.id,
          type: latestOpp.opportunityType,
          expectedImpactValue: latestOpp.expectedImpactMinor,
          confidence: 0.95,
          evidence: 'Recommended based on your current selection.',
          proposedAction: { priceMinor: latestOpp.expectedImpactMinor }
        });
      }
    }

    if (result.action === 'FINAL_RESPONSE') {
      const responseText = (result.payload as any).text || result.payload;
      
      // Save agent response to DB
      await prisma.message.create({
        data: {
          sessionId,
          sender: 'assistant',
          receiver: 'user',
          type: 'text',
          payload: { text: responseText }
        }
      });

      res.json({ response: responseText, genuiCard });
    } else if (result.action === 'TOOL_REQUEST') {
      const toolOutput = result.payload.result as any;
      if (toolOutput.checkoutData) {
        const checkoutData = {
          ...toolOutput.checkoutData,
          razorpayKeyId: env.providers.razorpayKeyId
        };
        
        console.log('Server-side Diagnostics for Checkout:', {
          keyPresent: Boolean(checkoutData.razorpayKeyId),
          keyPrefix: checkoutData.razorpayKeyId ? checkoutData.razorpayKeyId.slice(0, 9) : null,
          orderId: checkoutData.razorpayOrderId,
          amount: checkoutData.amountMinor,
          currency: checkoutData.currency
        });

        const responseText = 'I have created a checkout for you.';
        // Save agent response to DB
        await prisma.message.create({
          data: {
            sessionId,
            sender: 'assistant',
            receiver: 'user',
            type: 'text',
            payload: { text: responseText }
          }
        });

        res.json({ 
          response: responseText,
          checkoutData,
          genuiCard
        });
      } else if (toolOutput.products) {
        const productList = toolOutput.products.map((p: any) => `${p.name} - ${p.currency || 'INR'} ${p.priceMinor / 100}`).join('\n');
        const responseText = `I found these products:\n${productList}\n\nSay 'buy' to proceed to checkout.`;
        
        // Save agent response to DB
        await prisma.message.create({
          data: {
            sessionId,
            sender: 'assistant',
            receiver: 'user',
            type: 'text',
            payload: { text: responseText }
          }
        });

        res.json({ response: responseText, genuiCard });
      } else {
        const responseText = 'Tool executed.';
        // Save agent response to DB
        await prisma.message.create({
          data: {
            sessionId,
            sender: 'assistant',
            receiver: 'user',
            type: 'text',
            payload: { text: responseText }
          }
        });

        res.json({ response: responseText, data: toolOutput, genuiCard });
      }
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

export async function getDashboardMetrics(prisma: PrismaClient, merchantId: string) {
  const scanner = new BackgroundCommerceScanner(prisma);
  await scanner.scanAll(merchantId);

  const orders = await prisma.commerceOrder.findMany({ where: { merchantId } });
  
  // We only include payments related to these orders to scope to the merchant
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

  // Partition sessions & orders by A/B experiment group
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

  // Measured Opportunity Performance Rates
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
    // Cohort details
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
    // Resolve merchantId from query param or header — fail clearly if absent
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

    // Record auditable message
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

export default router;
