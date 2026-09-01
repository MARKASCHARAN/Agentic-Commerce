import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { SkillRegistry } from '../../src/agent/skills/skill-registry';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { RiskGate } from '../../src/agent/risk/risk-gate';
import { IdempotencyEngine } from '../../src/agent/idempotency/engine';
import { PrismaCatalogProvider } from '../../src/catalog/prisma-catalog.provider';
import { createCatalogSearchTool, createCatalogGetTool } from '../../src/agent/tools/catalog/catalog.tools';
import { createCheckoutTool } from '../../src/agent/tools/payment/checkout.tools';
import { createOpportunityAcceptTool } from '../../src/agent/tools/payment/opportunity-accept.tool';
import { createOpportunityRejectTool } from '../../src/agent/tools/payment/opportunity-reject.tool';
import { RazorpayProvider } from '../../src/providers/razorpay/razorpay.provider';
import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { RevenueTracker } from '../../src/agent/intelligence/revenue-tracker';
import { ModelGateway } from '../../src/models/gateway/model-gateway';
import { getOrCreateCart } from '../../src/agent/cart/cart-state';

describe('Cart and Conversation Continuity Integration Tests', () => {
  let prisma: PrismaClient;
  let runtime: AgentRuntime;
  let revenueEngine: RevenueIntelligenceEngine;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Clear test database tables
    await prisma.message.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.idempotencyRecord.deleteMany({});
    await prisma.revenueOpportunityLog.deleteMany({});
    await prisma.paymentIntent.deleteMany({});
    await prisma.commerceItem.deleteMany({});
    await prisma.commerceOrder.deleteMany({});
    await prisma.session.deleteMany({});
    
    // Seed mock merchant if not present
    await prisma.user.upsert({
      where: { id: 'demo-user-id' },
      update: {},
      create: { id: 'demo-user-id', email: 'demo@example.com', name: 'Demo User' }
    });
    
    await prisma.merchant.upsert({
      where: { id: 'demo-merchant-id' },
      update: {},
      create: { id: 'demo-merchant-id', name: 'Demo Merchant', userId: 'demo-user-id' }
    });

    // Seed mock catalog products if not present
    await prisma.product.upsert({
      where: { id: 'prod_shoes_01' },
      update: {
        description: '<!-- rel: ["prod_socks_01"] -->'
      },
      create: {
        id: 'prod_shoes_01',
        merchantId: 'demo-merchant-id',
        name: 'Running Shoes',
        priceMinor: 500000,
        currency: 'INR',
        description: '<!-- rel: ["prod_socks_01"] -->'
      }
    });

    await prisma.product.upsert({
      where: { id: 'prod_socks_01' },
      update: {},
      create: {
        id: 'prod_socks_01',
        merchantId: 'demo-merchant-id',
        name: 'Running Socks',
        priceMinor: 69900,
        currency: 'INR'
      }
    });

    await prisma.inventory.deleteMany({ where: { merchantId: 'merchant-saas-01' } });
    await prisma.product.deleteMany({ where: { merchantId: 'merchant-saas-01' } });

    await prisma.product.upsert({
      where: { id: 'prod_saas_starter' },
      update: { description: '<!-- rel: ["prod_saas_pro"] -->' },
      create: {
        id: 'prod_saas_starter',
        merchantId: 'merchant-saas-01',
        name: 'Starter Cloud Plan',
        priceMinor: 199900,
        currency: 'INR',
        description: '<!-- rel: ["prod_saas_pro"] -->'
      }
    });

    await prisma.product.upsert({
      where: { id: 'prod_saas_pro' },
      update: {},
      create: {
        id: 'prod_saas_pro',
        merchantId: 'merchant-saas-01',
        name: 'Enterprise Pro Cloud Plan',
        priceMinor: 999900,
        currency: 'INR'
      }
    });

    await prisma.product.upsert({
      where: { id: 'prod_laptop_01' },
      update: {},
      create: {
        id: 'prod_laptop_01',
        merchantId: 'merchant-electronics-01',
        name: 'Developer Pro Laptop',
        priceMinor: 12000000,
        currency: 'INR'
      }
    });

    // Initialize dependencies using real DB but mock modelGateway to simulate inputs/outputs
    const modelGateway = new ModelGateway();
    const catalogProvider = new PrismaCatalogProvider(prisma);
    
    const mockInventoryProvider = {
      check: async () => ({ quantity: 100 })
    } as any;

    const mockPaymentProvider = {
      createOrder: vi.fn().mockResolvedValue({ success: true, data: { providerId: 'rzp_order_123', status: 'created' } }),
      createPaymentLink: vi.fn().mockResolvedValue({ success: true, data: { providerId: 'plink_123', shortUrl: 'https://rzp.io/test', status: 'created' } }),
      capturePayment: vi.fn()
    } as any;

    const toolRegistry = new ToolRegistry();
    toolRegistry.register(createCatalogSearchTool(catalogProvider));
    toolRegistry.register(createCatalogGetTool(catalogProvider));
    toolRegistry.register(createCheckoutTool(catalogProvider, mockInventoryProvider, mockPaymentProvider, prisma));
    toolRegistry.register(createOpportunityAcceptTool(prisma));
    toolRegistry.register(createOpportunityRejectTool(prisma));

    const policyEngine = {
      evaluate: async () => ({ status: 'ALLOW' })
    } as any;

    const riskGate = new RiskGate([]);
    const idempotencyEngine = new IdempotencyEngine(new PrismaIdempotencyRepository(prisma));

    const toolGateway = new ToolGateway({
      toolRegistry,
      eventEmitter: { emit: () => {} } as any,
      policyEngine,
      riskGate,
      idempotencyEngine,
      capabilityResolver: {
        resolve: async () => new Set(['checkout.create'])
      } as any
    });

    const revenueTracker = new RevenueTracker(prisma);
    revenueEngine = new RevenueIntelligenceEngine(
      policyEngine as any,
      modelGateway,
      { resolve: async () => new Set(['catalog', 'inventory', 'pricing', 'negotiation', 'subscriptions', 'usage']) } as any,
      prisma
    );

    runtime = new AgentRuntime({
      modelGateway,
      stateManager: {
        createExecution: async () => {},
        loadContext: async (identity: any, task: string) => {
          const sessionId = identity.sessionId;
          let cart = await prisma.cart.findUnique({ where: { sessionId } });
          if (!cart) {
            cart = await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);
          }
          const cartItems = cart.items as any[];
          const cartProductIds = cartItems.map(i => i.productId);

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

          return {
            identity: { sessionId, executionId: identity.executionId, merchantId: identity.merchantId || 'demo-merchant-id' },
            task,
            conversation: { messages },
            runtimeMetadata: {},
            scopedData: {
              cartId: cart.id,
              cartItems,
              cartProductIds,
              rejectedOpportunities: cart.rejectedOpportunities
            }
          };
        },
        saveState: async () => {}
      } as any,
      toolGateway,
      skillSelector: { selectSkill: async () => null },
      eventEmitter: { emit: () => {} } as any,
      skillRegistry: new SkillRegistry(),
      revenueTracker,
      revenueEngine,
      prisma
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. show product -> buy preserves cart', async () => {
    const sessionId = `session-${crypto.randomUUID()}`;

    // Ensure session exists
    await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

    // Step 1: Initialize the cart in DB
    const cart = await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);
    expect(cart.items).toEqual([{ productId: 'prod_shoes_01', quantity: 1 }]);

    // Step 2: Simulate "buy" checkout call via checkout.create tool directly
    const executionId = crypto.randomUUID();
    const result = await runtime.deps.toolGateway.execute({
      toolId: 'checkout.create',
      input: {
        items: [{ productId: 'prod_shoes_01', quantity: 1 }]
      },
      context: {
        sessionId,
        executionId,
        idempotencyKey: `idem_${executionId}`,
        merchantId: 'demo-merchant-id',
        cartProductIds: ['prod_shoes_01']
      }
    });

    expect(result.output.status).toBe('success');
    expect(result.output.checkoutData.amountMinor).toBe(500000); // 5000 * 100 = 500000 (INR 5000)
  });

  it('2. show -> buy -> no -> buy preserves cart and does not re-propose rejected opportunity', async () => {
    const sessionId = `session-${crypto.randomUUID()}`;
    await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

    // Initialize cart in DB
    await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

    // Propose opportunity
    await prisma.revenueOpportunityLog.create({
      data: {
        id: crypto.randomUUID(),
        merchantId: 'demo-merchant-id',
        sessionId,
        opportunityType: 'CROSS_SELL',
        expectedImpactMinor: 69900, 
        status: 'PROPOSED'
      }
    });

    // Simulate negative reply turn: User says "no"
    await runtime.execute({
      sessionId,
      executionId: crypto.randomUUID(),
      merchantId: 'demo-merchant-id'
    }, 'no');

    // Verify opportunity is now REJECTED and added to Cart rejected list
    const cart = await prisma.cart.findUnique({ where: { sessionId } });
    expect(cart!.rejectedOpportunities).toContain('prod_socks_01');

    // Run analyzer again, it should NOT return the socks opportunity
    const opp = await runtime.deps.revenueEngine!.analyze('demo-merchant-id', {
      sessionId,
      cartProductIds: ['prod_shoes_01']
    });
    expect(opp).toBeNull();
  }, 45000);

  it('3. show -> buy -> yes add -> checkout produces ₹5699', async () => {
    const sessionId = `session-${crypto.randomUUID()}`;
    const executionIdVal = crypto.randomUUID();
    await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

    // Initialize cart in DB
    await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

    // Propose opportunity
    const oppId = crypto.randomUUID();
    await prisma.revenueOpportunityLog.create({
      data: {
        id: oppId,
        merchantId: 'demo-merchant-id',
        sessionId,
        opportunityType: 'CROSS_SELL',
        expectedImpactMinor: 69900, 
        status: 'PROPOSED'
      }
    });

    // Simulate accepting the opportunity
    await runtime.deps.toolGateway.execute({
      toolId: 'opportunity.accept',
      input: { opportunityId: oppId },
      context: {
        sessionId,
        executionId: executionIdVal,
        idempotencyKey: `idem_accept_${executionIdVal}`,
        merchantId: 'demo-merchant-id'
      }
    });

    // Simulate checkout with BOTH shoes and socks
    const result = await runtime.deps.toolGateway.execute({
      toolId: 'checkout.create',
      input: {
        items: [
          { productId: 'prod_shoes_01', quantity: 1 },
          { productId: 'prod_socks_01', quantity: 1 }
        ]
      },
      context: {
        sessionId,
        executionId: executionIdVal,
        idempotencyKey: `idem_${executionIdVal}`,
        merchantId: 'demo-merchant-id',
        cartProductIds: ['prod_shoes_01', 'prod_socks_01']
      }
    });

    expect(result.output.status).toBe('success');
    expect(result.output.checkoutData.amountMinor).toBe(569900); // 5000 + 699 = 569900 (INR 5699)
    // Opportunity should be converted/accepted
    const updatedOpp = await prisma.revenueOpportunityLog.findUnique({ where: { id: oppId } });
    expect(updatedOpp!.status).toBe('ACCEPTED');
  });

  it('4. Two independent sessions have independent carts', async () => {
    const session1 = `session-${crypto.randomUUID()}`;
    const session2 = `session-${crypto.randomUUID()}`;

    // Create session records to prevent foreign key errors
    await prisma.session.create({ data: { id: session1, merchantId: 'demo-merchant-id' } });
    await prisma.session.create({ data: { id: session2, merchantId: 'demo-merchant-id' } });

    await getOrCreateCart(prisma, session1, [{ productId: 'prod_shoes_01', quantity: 1 }]);
    await getOrCreateCart(prisma, session2, [{ productId: 'prod_socks_01', quantity: 1 }]);

    const cart1 = await prisma.cart.findUnique({ where: { sessionId: session1 } });
    const cart2 = await prisma.cart.findUnique({ where: { sessionId: session2 } });

    expect(cart1!.items).toEqual([{ productId: 'prod_shoes_01', quantity: 1 }]);
    expect(cart2!.items).toEqual([{ productId: 'prod_socks_01', quantity: 1 }]);
  });

  it('5. Repeated checkout remains idempotent', async () => {
    const sessionId = `session-${crypto.randomUUID()}`;
    await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

    await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

    const executionId = crypto.randomUUID();
    const context = {
      sessionId,
      executionId,
      idempotencyKey: `idem_key_${crypto.randomUUID()}`,
      merchantId: 'demo-merchant-id',
      cartProductIds: ['prod_shoes_01']
    };

    const firstRun = await runtime.deps.toolGateway.execute({
      toolId: 'checkout.create',
      input: {
        items: [{ productId: 'prod_shoes_01', quantity: 1 }]
      },
      context
    });

    const secondRun = await runtime.deps.toolGateway.execute({
      toolId: 'checkout.create',
      input: {
        items: [{ productId: 'prod_shoes_01', quantity: 1 }]
      },
      context
    });



    expect(firstRun.output.checkoutData.orderId).toBe(secondRun.output.checkoutData.orderId);
    expect(firstRun.output.checkoutData.razorpayOrderId).toBe(secondRun.output.checkoutData.razorpayOrderId);

    // Verify exactly one order exists in DB
    const ordersCount = await prisma.commerceOrder.count({ where: { sessionId } });
    expect(ordersCount).toBe(1);
  });

  it('6. Cart, pending opportunities, and rejected opportunities are serialized in promptMsg', async () => {
    const sessionId = `session-${crypto.randomUUID()}`;
    await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

    // Initialize cart in DB
    await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

    // Add a rejected opportunity to cart
    await prisma.cart.update({
      where: { sessionId },
      data: { rejectedOpportunities: ['prod_socks_01'] }
    });

    // Propose an active opportunity
    const activeOppId = crypto.randomUUID();
    await prisma.revenueOpportunityLog.create({
      data: {
        id: activeOppId,
        merchantId: 'demo-merchant-id',
        sessionId,
        opportunityType: 'CROSS_SELL',
        expectedImpactMinor: 699,
        status: 'PROPOSED'
      }
    });

    // We spy on chat to capture arguments
    const spyChat = vi.fn().mockResolvedValue({
      text: 'Proceeding to checkout',
      usage: { totalTokens: 10, promptTokens: 5, completionTokens: 5 }
    });
    
    const originalChat = runtime.deps.modelGateway.chat;
    runtime.deps.modelGateway.chat = spyChat;

    try {
      await runtime.execute({
        sessionId,
        executionId: crypto.randomUUID(),
        merchantId: 'demo-merchant-id'
      }, 'buy');

      expect(spyChat).toHaveBeenCalled();
      const callArgs = spyChat.mock.calls[0][0];
      
      expect(callArgs.system).toContain('AUTHORITATIVE CART');

      const userContent = callArgs.messages[0].content;
      expect(userContent).toContain('AUTHORITATIVE CART');
      expect(userContent).toContain('prod_shoes_01');
      expect(userContent).toContain('REJECTED OPPORTUNITIES');
      expect(userContent).toContain('prod_socks_01');
      expect(userContent).toContain('ACTIVE OPPORTUNITY');
    } finally {
      runtime.deps.modelGateway.chat = originalChat;
    }
  });

  describe('Security & Session Isolation Verification', () => {
    it('A. Cart quantity = 1, LLM checkout quantity = 2 -> checkout MUST fail', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });
      await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

      await expect(runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [{ productId: 'prod_shoes_01', quantity: 2 }]
        },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01']
        }
      })).rejects.toThrow('Security Exception: Requested quantity (2) does not match authoritative cart quantity (1).');
    });

    it('B. Cart quantity = 1, LLM checkout quantity = 999 -> checkout MUST fail', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });
      await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

      await expect(runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [{ productId: 'prod_shoes_01', quantity: 999 }]
        },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01']
        }
      })).rejects.toThrow('Security Exception: Requested quantity (999) does not match authoritative cart quantity (1).');
    });

    it('C. Cart quantity = 2, LLM checkout quantity = 1 -> checkout MUST fail', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });
      await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 2 }]);

      await expect(runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [{ productId: 'prod_shoes_01', quantity: 1 }]
        },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01']
        }
      })).rejects.toThrow('Security Exception: Requested quantity (1) does not match authoritative cart quantity (2).');
    });

    it('D. Cart quantity = 1, LLM checkout quantity = 1 -> checkout succeeds', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });
      await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

      const result = await runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [{ productId: 'prod_shoes_01', quantity: 1 }]
        },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01']
        }
      });

      expect(result.output.status).toBe('success');
      expect(result.output.checkoutData.amountMinor).toBe(500000);
    });

    it('E. Accepted cross-sell (shoes x 1 + socks x 1) succeeds for ₹5,699', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });
      await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

      const oppId = crypto.randomUUID();
      // Proposed opportunity
      await prisma.revenueOpportunityLog.create({
        data: {
          id: oppId,
          merchantId: 'demo-merchant-id',
          sessionId,
          opportunityType: 'CROSS_SELL',
          expectedImpactMinor: 69900, 
          status: 'PROPOSED'
        }
      });

      // Simulate accepting the opportunity
      await runtime.deps.toolGateway.execute({
        toolId: 'opportunity.accept',
        input: { opportunityId: oppId },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_accept_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id'
        }
      });

      const result = await runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [
            { productId: 'prod_shoes_01', quantity: 1 },
            { productId: 'prod_socks_01', quantity: 1 }
          ]
        },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01', 'prod_socks_01']
        }
      });

      expect(result.output.status).toBe('success');
      expect(result.output.checkoutData.amountMinor).toBe(569900);
    });

    it('F. Accepted cross-sell with socks x 999 -> MUST fail', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });
      await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

      const oppId = crypto.randomUUID();
      await prisma.revenueOpportunityLog.create({
        data: {
          id: oppId,
          merchantId: 'demo-merchant-id',
          sessionId,
          opportunityType: 'CROSS_SELL',
          expectedImpactMinor: 69900, 
          status: 'PROPOSED'
        }
      });

      await runtime.deps.toolGateway.execute({
        toolId: 'opportunity.accept',
        input: { opportunityId: oppId },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_accept_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id'
        }
      });

      await expect(runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [
            { productId: 'prod_shoes_01', quantity: 1 },
            { productId: 'prod_socks_01', quantity: 999 }
          ]
        },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01']
        }
      })).rejects.toThrow('Security Exception: Requested quantity (999) does not match authoritative cart quantity (1).');
    });

    it('G. Product not in cart and not an accepted opportunity -> MUST fail', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });
      await getOrCreateCart(prisma, sessionId, [{ productId: 'prod_shoes_01', quantity: 1 }]);

      await expect(runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [
            { productId: 'prod_shoes_01', quantity: 1 },
            { productId: 'prod_socks_01', quantity: 1 } // not proposed
          ]
        },
        context: {
          sessionId,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01']
        }
      })).rejects.toThrow('Security Exception: Unauthorized item injection. Product "prod_socks_01" is not in the authorized cart.');
    });

    it('H. Route-level session isolation: session A vs session B', async () => {
      const sessionA = `session-${crypto.randomUUID()}`;
      const sessionB = `session-${crypto.randomUUID()}`;

      await prisma.session.create({ data: { id: sessionA, merchantId: 'demo-merchant-id' } });
      await prisma.session.create({ data: { id: sessionB, merchantId: 'demo-merchant-id' } });

      // Initialize different carts
      await getOrCreateCart(prisma, sessionA, [{ productId: 'prod_shoes_01', quantity: 1 }]);
      await getOrCreateCart(prisma, sessionB, [{ productId: 'prod_socks_01', quantity: 1 }]);

      // Verify checkout A fails to use cart B
      await expect(runtime.deps.toolGateway.execute({
        toolId: 'checkout.create',
        input: {
          items: [{ productId: 'prod_socks_01', quantity: 1 }]
        },
        context: {
          sessionId: sessionA,
          executionId: crypto.randomUUID(),
          idempotencyKey: `idem_${crypto.randomUUID()}`,
          merchantId: 'demo-merchant-id',
          cartProductIds: ['prod_shoes_01']
        }
      })).rejects.toThrow('Security Exception: Unauthorized item injection. Product "prod_socks_01" is not in the authorized cart.');
    });

    it('I. Dynamic relationship discovery: changing tags changes recommendations', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

      // Create base product, product B, product C
      const prodA = `prod-A-${crypto.randomUUID()}`;
      const prodB = `prod-B-${crypto.randomUUID()}`;
      const prodC = `prod-C-${crypto.randomUUID()}`;

      await prisma.product.createMany({
        data: [
          { id: prodA, merchantId: 'demo-merchant-id', name: 'Shoes A', priceMinor: 50000, description: `<!-- rel: ["${prodB}"] -->` },
          { id: prodB, merchantId: 'demo-merchant-id', name: 'Socks B', priceMinor: 699, description: 'Socks B description' },
          { id: prodC, merchantId: 'demo-merchant-id', name: 'Bottle C', priceMinor: 899, description: 'Bottle C description' }
        ]
      });

      await getOrCreateCart(prisma, sessionId, [{ productId: prodA, quantity: 1 }]);

      // Running detector should suggest product B
      const resultB = await revenueEngine.analyze('demo-merchant-id', { sessionId, cartProductIds: [prodA] });
      expect(resultB).not.toBeNull();
      expect(resultB!.proposedAction.resourceId).toBe(prodB);

      // Now change metadata relationship in DB to point to C
      await prisma.product.update({
        where: { id: prodA },
        data: { description: `<!-- rel: ["${prodC}"] -->` }
      });

      // Running detector should now suggest product C
      const resultC = await revenueEngine.analyze('demo-merchant-id', { sessionId, cartProductIds: [prodA] });
      expect(resultC).not.toBeNull();
      expect(resultC!.proposedAction.resourceId).toBe(prodC);
    });

    it('J. Dynamic pricing: changing price of B in DB affects expectedImpactMinor', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

      const prodA = `prod-A-${crypto.randomUUID()}`;
      const prodB = `prod-B-${crypto.randomUUID()}`;

      await prisma.product.createMany({
        data: [
          { id: prodA, merchantId: 'demo-merchant-id', name: 'Shoes A', priceMinor: 50000, description: `<!-- rel: ["${prodB}"] -->` },
          { id: prodB, merchantId: 'demo-merchant-id', name: 'Socks B', priceMinor: 699, description: 'Socks B description' }
        ]
      });

      await getOrCreateCart(prisma, sessionId, [{ productId: prodA, quantity: 1 }]);

      const resultB1 = await revenueEngine.analyze('demo-merchant-id', { sessionId, cartProductIds: [prodA] });
      expect(resultB1!.expectedImpactValue).toBe(699);

      // Update product B price in DB
      await prisma.product.update({
        where: { id: prodB },
        data: { priceMinor: 1200 }
      });

      const resultB2 = await revenueEngine.analyze('demo-merchant-id', { sessionId, cartProductIds: [prodA] });
      expect(resultB2!.expectedImpactValue).toBe(1200);
      expect(resultB2!.proposedAction.priceMinor).toBe(1200);
    });

    it('K. No hardcoded fallback error: missing resourceId fails safely', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'demo-merchant-id' } });

      const prodA = `prod-A-${crypto.randomUUID()}`;
      await prisma.product.create({
        data: {
          id: prodA,
          merchantId: 'demo-merchant-id',
          name: 'Shoes A',
          priceMinor: 50000,
          description: null
        }
      });

      await getOrCreateCart(prisma, sessionId, [{ productId: prodA, quantity: 1 }]);

      // Create an opportunity log with status PROPOSED but proposedAction missing resourceId
      const oppId = crypto.randomUUID();
      await prisma.revenueOpportunityLog.create({
        data: {
          id: oppId,
          merchantId: 'demo-merchant-id',
          sessionId,
          opportunityType: 'CROSS_SELL',
          expectedImpactMinor: 699,
          status: 'PROPOSED'
        }
      });

      // Rejecting opportunity or checkout should reject/fail safely and not default to prod_socks_01
      await expect(runtime.execute({
        sessionId,
        executionId: crypto.randomUUID(),
        merchantId: 'demo-merchant-id'
      }, 'no')).rejects.toThrow('Security Exception: Opportunity does not contain an authoritative complement product ID.');
    });
  });

  describe('Natural Language Purchase Intent & Resolution', () => {
    it('1. "buy Pro plan" should resolve to prod_saas_pro and populate cart seamlessly', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-saas-01' } });
      await getOrCreateCart(prisma, sessionId, []);

      await runtime.execute({
        sessionId,
        executionId: crypto.randomUUID(),
        merchantId: 'merchant-saas-01'
      }, 'buy Pro plan');

      const cart = await prisma.cart.findUnique({ where: { sessionId } });
      expect(cart).toBeDefined();
      const cartItems = cart!.items as any[];
      expect(cartItems.length).toBe(1);
      expect(cartItems[0].productId).toBe('prod_saas_pro');
      expect(cartItems[0].quantity).toBe(1);
    }, 45000);

    it('2. "buy the developer laptop" should resolve to prod_laptop_01 and populate cart seamlessly', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-electronics-01' } });
      await getOrCreateCart(prisma, sessionId, []);

      await runtime.execute({
        sessionId,
        executionId: crypto.randomUUID(),
        merchantId: 'merchant-electronics-01'
      }, 'buy the developer laptop');

      const cart = await prisma.cart.findUnique({ where: { sessionId } });
      expect(cart).toBeDefined();
      const cartItems = cart!.items as any[];
      expect(cartItems.length).toBe(1);
      expect(cartItems[0].productId).toBe('prod_laptop_01');
      expect(cartItems[0].quantity).toBe(1);
    }, 45000);

    it('3. "buy Starter plan" populates cart and triggers Pro plan cross-sell opportunity', async () => {
      const sessionId = `session-${crypto.randomUUID()}`;
      await prisma.session.create({ data: { id: sessionId, merchantId: 'merchant-saas-01' } });
      await getOrCreateCart(prisma, sessionId, []);
      
      await prisma.merchantCapability.upsert({
        where: { merchantId_capability: { merchantId: 'merchant-saas-01', capability: 'catalog' } },
        update: {},
        create: { merchantId: 'merchant-saas-01', capability: 'catalog' }
      });
      await prisma.merchantCapability.upsert({
        where: { merchantId_capability: { merchantId: 'merchant-saas-01', capability: 'inventory' } },
        update: {},
        create: { merchantId: 'merchant-saas-01', capability: 'inventory' }
      });
      await prisma.merchantGuardrail.upsert({
        where: { merchantId: 'merchant-saas-01' },
        update: { crossSellEnabled: true },
        create: { merchantId: 'merchant-saas-01', minimumMarginBps: 1000, maxDiscountBps: 2000, autonomousPaymentLimitMinor: 10000000, currency: 'INR', negotiationEnabled: true, crossSellEnabled: true, revenueGoal: 'INCREASE_AOV' }
      });

      await runtime.execute({
        sessionId,
        executionId: crypto.randomUUID(),
        merchantId: 'merchant-saas-01'
      }, 'buy Starter plan');

      const cart = await prisma.cart.findUnique({ where: { sessionId } });
      expect(cart).toBeDefined();
      const cartItems = cart!.items as any[];
      expect(cartItems.length).toBe(1);
      expect(cartItems[0].productId).toBe('prod_saas_starter');

      const opps = await prisma.revenueOpportunityLog.findMany({
        where: { sessionId }
      });

      const opp = opps.find(o => o.opportunityType === 'CROSS_SELL' && (o.status === 'PROPOSED' || o.status === 'REJECTED'));
      
      expect(opp).not.toBeUndefined();
      if (opp) {
        expect(opp.opportunityType).toBe('CROSS_SELL');
      }
    }, 45000);
  });
});
