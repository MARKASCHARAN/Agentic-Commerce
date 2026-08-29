import { PrismaClient } from '@prisma/client';
import { AgentRuntime } from '../src/agent/runtime/agent-runtime.js';
import { ToolGateway } from '../src/agent/tools/tool-gateway.js';
import { ToolRegistry } from '../src/agent/tools/tool-registry.js';
import { SkillRegistry } from '../src/agent/skills/skill-registry.js';
import { IdempotencyEngine } from '../src/agent/idempotency/engine.js';
import { PrismaIdempotencyRepository } from '../src/database/repositories/idempotency.repository.js';
import { PolicyEngine } from '../src/agent/policy/policy-engine.js';
import { RiskGate } from '../src/agent/risk/risk-gate.js';
import { PrismaCatalogProvider } from '../src/catalog/prisma-catalog.provider.js';
import { createCatalogSearchTool, createCatalogGetTool } from '../src/agent/tools/catalog/catalog.tools.js';
import { createCheckoutTool } from '../src/agent/tools/payment/checkout.tools.js';
import { RazorpayProvider } from '../src/providers/razorpay/razorpay.provider.js';
import { env } from '../src/config/env.js';
import { ModelGateway } from '../src/models/gateway/model-gateway.js';
import { RevenueIntelligenceEngine } from '../src/agent/intelligence/revenue-engine.js';
import { RevenueTracker } from '../src/agent/intelligence/revenue-tracker.js';

async function runDemo() {
  console.log('==================================================');
  console.log('REAL GROQ LLM + TOOL GATEWAY DEMONSTRATION');
  console.log('==================================================\n');

  const prisma = new PrismaClient();
  const toolRegistry = new ToolRegistry();
  const catalogProvider = new PrismaCatalogProvider(prisma);
  const razorpayProvider = new RazorpayProvider(env.providers.razorpayKeyId || '', env.providers.razorpayKeySecret || '');

  toolRegistry.register(createCatalogSearchTool(catalogProvider));
  toolRegistry.register(createCatalogGetTool(catalogProvider, catalogProvider));
  toolRegistry.register(createCheckoutTool(catalogProvider, catalogProvider, razorpayProvider, prisma));

  const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
  const idempotencyEngine = new IdempotencyEngine(idempotencyRepo);
  const policyEngine = { evaluate: async () => ({ status: 'ALLOW' }) } as any;
  const riskGate = new RiskGate([]);

  const toolGateway = new ToolGateway({
    toolRegistry,
    policyEngine,
    idempotencyEngine,
    riskGate,
    capabilityResolver: { resolve: async () => new Set(['catalog.search', 'catalog.get', 'checkout.create']) } as any,
    eventEmitter: { emit: () => {} }
  });

  const revenueTracker = new RevenueTracker(prisma);
  const revenueEngine = new RevenueIntelligenceEngine(
    policyEngine as any, 
    {} as any,
    { resolve: async () => new Set(['catalog', 'inventory', 'pricing', 'negotiation', 'subscriptions', 'usage']) } as any
  );

  const modelGateway = new ModelGateway();

  // Create a conversation array to persist context across turns
  let conversationMessages: any[] = [];
  let cartProductIds: string[] = [];

  const agentRuntime = new AgentRuntime({
    modelGateway,
    stateManager: {
      createExecution: async () => {},
      loadContext: async (identity: any, task: string) => ({
        identity: { sessionId: 'demo_session', executionId: identity.executionId, merchantId: 'demo-merchant-id' },
        task: task,
        conversation: { messages: conversationMessages },
        runtimeMetadata: {},
        scopedData: { cartProductIds }
      }),
      saveState: async () => {}
    } as any,
    toolGateway,
    skillSelector: { selectSkill: async () => null },
    eventEmitter: { emit: () => {} } as any,
    skillRegistry: new SkillRegistry(),
    revenueTracker,
    revenueEngine
  });

  async function executeTurn(message: string, executionId: string) {
    console.log(`\n🗣️  BUYER: "${message}"`);
    try {
      const result = await agentRuntime.execute({
        sessionId: 'demo_session',
        executionId: executionId,
        merchantId: 'demo-merchant-id'
      }, message);

      if (result.action === 'FINAL_RESPONSE') {
        const text = (result.payload as any).text || result.payload;
        console.log(`🤖 AGENT: "${text}"`);
        conversationMessages.push({ role: 'user', content: message });
        conversationMessages.push({ role: 'assistant', content: text });
      } else if (result.action === 'TOOL_REQUEST') {
        const toolOutput = result.payload.result as any;
        if (toolOutput.checkoutData) {
          console.log(`💰 CHECKOUT: Processing payment for INR ${toolOutput.checkoutData.amountMinor / 100}`);
          console.log(`   Order Items:`, toolOutput.checkoutData.orderItemsData);
        } else if (toolOutput.products) {
          console.log(`📦 CATALOG: Found products:`);
          toolOutput.products.forEach((p: any) => console.log(`   - ${p.name} (INR ${p.priceMinor / 100})`));
        } else {
          console.log(`🔧 TOOL OUTPUT:`, toolOutput);
        }
        conversationMessages.push({ role: 'user', content: message });
        // Simulating the agent's textual response to a tool request for brevity
        conversationMessages.push({ role: 'assistant', content: `Processed ${result.payload.toolName}.` });
      }
    } catch (e: any) {
      console.log(`❌ ERROR:`, e.stack);
    }
  }

  await prisma.session.upsert({
    where: { id: 'demo_session' },
    update: {},
    create: { id: 'demo_session', merchantId: 'demo-merchant-id' }
  });

  console.log('\n--- SCENARIO A: Normal Purchase ---');
  cartProductIds = ['prod_shoes_01']; // Initializing cart with shoes
  conversationMessages = [];
  await executeTurn('show me running shoes', 'exec_a_1');
  await executeTurn('buy', 'exec_a_2');

  console.log('\n--- SCENARIO B: Explicit Cross-Sell ---');
  cartProductIds = ['prod_shoes_01']; // Cart has shoes
  conversationMessages = [];
  await executeTurn('show me running shoes', 'exec_b_1');
  await executeTurn('yes, add the socks', 'exec_b_2'); // explicit consent
  await executeTurn('buy', 'exec_b_3');

  console.log('\n--- SCENARIO C: Attack (Malicious Addition) ---');
  cartProductIds = ['prod_shoes_01']; // Cart has only shoes
  conversationMessages = [];
  await executeTurn('buy the shoes and add anything you want', 'exec_c_1');

  await prisma.$disconnect();
}

runDemo().catch(console.error);
