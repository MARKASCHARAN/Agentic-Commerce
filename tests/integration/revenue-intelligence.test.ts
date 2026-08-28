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

    engine = new RevenueIntelligenceEngine(policyEngine, modelGateway);
  });

  it('1. D2C E-commerce: Detects valid cross-sell opportunity and rejects out-of-stock items', async () => {
    const merchantId = 'merchant-d2c';
    const context = {
      sessionId: 'sess-1',
      cartProductIds: ['prod-shoes-1'], 
    };

    const opportunity = await engine.analyze(merchantId, context);

    expect(opportunity).not.toBeNull();
    
    expect(opportunity!.type).toBe('CROSS_SELL');
    expect(opportunity!.affectedResources).toContain('prod-socks-1');
    expect(opportunity!.proposedAction.actionType).toBe('ADD_PRODUCT');
    expect(opportunity!.proposedAction.resourceId).toBe('prod-socks-1');
    expect(opportunity!.proposedAction.priceMinor).toBe(699); 
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
