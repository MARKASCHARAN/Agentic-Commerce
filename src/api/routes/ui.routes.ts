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
import { createCatalogSearchTool, createCatalogGetTool } from '../../agent/tools/catalog/catalog.tools.js';
import { createCheckoutTool } from '../../agent/tools/payment/checkout.tools.js';
import { RazorpayProvider } from '../../providers/razorpay/razorpay.provider.js';
import { PrismaIdempotencyRepository } from '../../database/repositories/idempotency.repository.js';
import { env } from '../../config/env.js';
import crypto from 'crypto';
import { ModelGateway } from '../../models/gateway/model-gateway.js';
import { AgentEventEmitter } from '../../agent/runtime/types.js';

const router = Router();
const prisma = new PrismaClient();

// Initialize the primary path components
const toolRegistry = new ToolRegistry();
const catalogProvider = new PrismaCatalogProvider(prisma);
const razorpayProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');

toolRegistry.register(createCatalogSearchTool(catalogProvider));
toolRegistry.register(createCatalogGetTool(catalogProvider, catalogProvider));
toolRegistry.register(createCheckoutTool(catalogProvider, catalogProvider, razorpayProvider, prisma));

const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
const idempotencyEngine = new IdempotencyEngine(idempotencyRepo);
const policyEngine = {
  evaluate: async () => ({ status: 'ALLOW' }),
} as any;
const riskGate = new RiskGate([]);

const toolGateway = new ToolGateway({
  toolRegistry,
  policyEngine,
  idempotencyEngine,
  riskGate,
  capabilityResolver: {
    resolve: async () => new Set(['catalog.search', 'catalog.get', 'checkout.create'])
  } as any,
  eventEmitter: { emit: () => {} }
});

// Mock ModelGateway for deterministic E2E testing
const mockModelGateway = {
  structured: async (params: any) => {
    const prompt = params.prompt.toLowerCase();
    if (prompt.includes('shoes')) {
      return {
        object: { type: 'TOOL_REQUEST', payload: { toolName: 'catalog.search', input: { query: 'shoes' } } },
        usage: { totalTokens: 10 }
      };
    } else if (prompt.includes('checkout') || prompt.includes('buy')) {
      return {
        object: { type: 'TOOL_REQUEST', payload: { toolName: 'checkout.create', input: { productId: 'prod_shoes_01', quantity: 1 } } },
        usage: { totalTokens: 10 }
      };
    }
    return {
      object: { type: 'FINAL_RESPONSE', payload: { text: 'I am your Agentic Commerce Assistant.' } },
      usage: { totalTokens: 10 }
    };
  }
} as unknown as ModelGateway;

const agentRuntime = new AgentRuntime({
  modelGateway: mockModelGateway,
  stateManager: {
    createExecution: async () => {},
    loadContext: async (identity: any, task: string) => ({
      identity: { sessionId: 'sess_1', executionId: 'exec_1', merchantId: 'demo-merchant' },
      task: task,
      conversation: { messages: [] },
      runtimeMetadata: {},
      scopedData: {}
    }),
    saveState: async () => {}
  } as any,
  toolGateway,
  skillSelector: { selectSkill: async () => null },
  eventEmitter: { emit: () => {} } as AgentEventEmitter,
  skillRegistry: new SkillRegistry()
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    // Ensure the mock session exists for DB foreign keys (like CommerceOrder)
    await prisma.session.upsert({
      where: { id: 'test_session_id' },
      update: {},
      create: { id: 'test_session_id', merchantId: 'demo-merchant-id' }
    });
    
    // Generate a stable execution ID based on the message so repeated "buy" clicks are idempotent,
    // but we add a version or prefix so it breaks cache from previous runs.
    const executionId = crypto.createHash('sha256').update(`v2-test_session_id-${message.toLowerCase().trim()}`).digest('hex');

    // We invoke the REAL AgentRuntime which triggers the REAL ToolGateway -> REAL Providers
    const result = await agentRuntime.execute({
      sessionId: 'test_session_id',
      executionId: executionId,
      merchantId: 'demo-merchant-id'
    }, message);

    if (result.action === 'FINAL_RESPONSE') {
      res.json({ response: result.payload });
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

        res.json({ 
          response: 'I have created a checkout for you.',
          checkoutData
        });
      } else if (toolOutput.products) {
        const productList = toolOutput.products.map((p: any) => `${p.name} - INR ${p.priceMinor / 100}`).join('\n');
        res.json({ response: `I found these products:\n${productList}\n\nSay 'buy' to proceed to checkout.` });
      } else {
        res.json({ response: 'Tool executed.', data: toolOutput });
      }
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const orders = await prisma.commerceOrder.findMany({ where: { merchantId: 'demo-merchant-id' } });
    const payments = await prisma.paymentIntent.findMany();
    res.json({
      totalOrders: orders.length,
      orders,
      payments
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
