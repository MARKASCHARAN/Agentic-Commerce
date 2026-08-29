import { describe, it, expect, beforeAll } from 'vitest';
import { RevenueIntelligenceEngine } from '../../src/agent/intelligence/revenue-engine';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { ModelGateway } from '../../src/models/gateway/model-gateway';

describe.sequential('Phase 19: Merchant Revenue Intelligence Layer', () => {
  let engine: RevenueIntelligenceEngine;
  let policyEngine: PolicyEngine;
  let modelGateway: ModelGateway;

  beforeAll(() => {

    policyEngine = {} as PolicyEngine;
    modelGateway = {} as ModelGateway;

    const mockResolver = {
      resolve: async (merchantId: string) => {
        if (merchantId === 'merchant-d2c') {
          return { has: (c: string) => ['catalog', 'inventory', 'pricing', 'order.create', 'payment.create', 'checkout.create', 'refund.create', 'upsell.create', 'cross_sell.create'].includes(c), getAll: () => [] };
        }
        if (merchantId === 'merchant-saas') {
          return { has: (c: string) => ['subscriptions', 'usage', 'pricing', 'payment.create', 'order.create'].includes(c), getAll: () => [] };
        }
        if (merchantId === 'merchant-b2b') {
          return { has: (c: string) => ['catalog', 'inventory', 'pricing', 'negotiation', 'quote.create', 'offer.create', 'negotiation.create', 'order.create', 'payment.create'].includes(c), getAll: () => [] };
        }
        return { has: () => false, getAll: () => [] };
      }
    } as any;

    const mockPrisma = {
      product: {
        findUnique: async ({ where: { id } }: any) => {
          if (id === 'prod_shoes_01') {
            return {
              id: 'prod_shoes_01',
              name: 'Running Shoes',
              priceMinor: 500000,
              currency: 'INR',
              active: true,
              description: '<!-- rel: ["prod_socks_01"] --> Premium Running Shoes',
              merchantId: 'merchant-d2c'
            };
          }
          if (id === 'prod_socks_01') {
            return {
              id: 'prod_socks_01',
              name: 'Running Socks',
              priceMinor: 69900,
              currency: 'INR',
              active: true,
              description: 'Running Socks description',
              merchantId: 'merchant-d2c'
            };
          }
          if (id === 'plan-starter') {
            return {
              id: 'plan-starter',
              name: 'Starter Plan',
              priceMinor: 49900,
              currency: 'USD',
              active: true,
              description: '<!-- seatLimit: 5 --> Starter Plan description',
              merchantId: 'merchant-saas'
            };
          }
          if (id === 'plan-growth') {
            return {
              id: 'plan-growth',
              name: 'Growth Plan',
              priceMinor: 99900,
              currency: 'USD',
              active: true,
              description: '<!-- seatLimit: 15 --> Growth Plan description',
              merchantId: 'merchant-saas'
            };
          }
          if (id === 'prod-chairs-1') {
            return {
              id: 'prod-chairs-1',
              name: 'Office Chairs',
              priceMinor: 500000,
              currency: 'USD',
              active: true,
              description: '<!-- bulk: { "threshold": 100, "discountMinor": 50000 } --> Office Chairs',
              merchantId: 'merchant-b2b'
            };
          }
          return null;
        },
        findMany: async ({ where }: any) => {
          const merchantId = where?.merchantId;
          const id = where?.id;
          const active = where?.active;
          
          if (merchantId === 'merchant-saas' && active) {
            return [
              {
                id: 'plan-starter',
                name: 'Starter Plan',
                priceMinor: 49900,
                currency: 'USD',
                active: true,
                description: '<!-- seatLimit: 5 --> Starter Plan description',
                merchantId: 'merchant-saas'
              },
              {
                id: 'plan-growth',
                name: 'Growth Plan',
                priceMinor: 99900,
                currency: 'USD',
                active: true,
                description: '<!-- seatLimit: 15 --> Growth Plan description',
                merchantId: 'merchant-saas'
              }
            ];
          }

          const ids = id?.in || [];
          const list = [];
          if (ids.includes('prod_socks_01') && merchantId === 'merchant-d2c' && active) {
            list.push({
              id: 'prod_socks_01',
              name: 'Running Socks',
              priceMinor: 69900,
              currency: 'INR',
              active: true,
              description: 'Running Socks description',
              merchantId: 'merchant-d2c'
            });
          }
          return list;
        }
      },
      revenueOpportunityLog: {
        findFirst: async () => null,
      },
      cart: {
        findUnique: async () => null,
      }
    } as any;

    engine = new RevenueIntelligenceEngine(policyEngine, modelGateway, mockResolver, mockPrisma);
  });

  it('1. D2C E-commerce: Detects valid cross-sell opportunity and rejects out-of-stock items', async () => {
    const merchantId = 'merchant-d2c';
    const context = {
      sessionId: 'sess-1',
      cartProductIds: ['prod_shoes_01'], 
    };

    const opportunity = await engine.analyze(merchantId, context);

    expect(opportunity).not.toBeNull();
    
    expect(opportunity!.type).toBe('CROSS_SELL');
    expect(opportunity!.affectedResources).toContain('prod_socks_01');
    expect(opportunity!.proposedAction.actionType).toBe('ADD_PRODUCT');
    expect(opportunity!.proposedAction.resourceId).toBe('prod_socks_01');
    expect(opportunity!.proposedAction.priceMinor).toBe(69900); 
    expect(opportunity!.policyDecision).toBe('ALLOWED');
    expect(opportunity!.evidence).toContain('AI selected:'); 
  });

  it('2. SaaS: Detects upgrade opportunity when seat request exceeds current plan limits', async () => {
    const merchantId = 'merchant-saas';
    const context = {
      sessionId: 'sess-2',
      currentPlanId: 'plan-starter', 
      requestedSeats: 12,            
    };

    const opportunity = await engine.analyze(merchantId, context);

    expect(opportunity).not.toBeNull();
    expect(opportunity!.type).toBe('UPGRADE');
    expect(opportunity!.affectedResources).toContain('plan-growth');
    expect(opportunity!.proposedAction.actionType).toBe('UPGRADE_PLAN');
    expect(opportunity!.proposedAction.resourceId).toBe('plan-growth');
    expect(opportunity!.proposedAction.priceMinor).toBe(99900);
    expect(opportunity!.policyDecision).toBe('ALLOWED');
  });

  it('3. Marketplace: Detects bulk quote negotiation opportunity for large quantity', async () => {
    const merchantId = 'merchant-b2b';
    const context = {
      sessionId: 'sess-3',
      requestedProductId: 'prod-chairs-1',
      requestedQuantity: 500, 
    };

    const opportunity = await engine.analyze(merchantId, context);

    expect(opportunity).not.toBeNull();
    expect(opportunity!.type).toBe('BULK_QUOTE');
    expect(opportunity!.proposedAction.actionType).toBe('APPLY_DISCOUNT');
    expect(opportunity!.proposedAction.discountMinor).toBe(50000); 
    expect(opportunity!.policyDecision).toBe('ALLOWED');
  });

  it('4. Capabilities isolate merchants properly (SaaS cannot trigger E-commerce rules)', async () => {
    const merchantId = 'merchant-saas';
    const context = {
      sessionId: 'sess-4',
      cartProductIds: ['prod-shoes-1'], 
    };

    const opportunity = await engine.analyze(merchantId, context);
    
    expect(opportunity).toBeNull();
  });
});
