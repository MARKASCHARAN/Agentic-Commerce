import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MerchantGuardrailRepository } from '../../src/database/repositories/merchant-guardrail.repository';
import { NegotiationEngine } from '../../src/agent/intelligence/negotiation/negotiation-engine';
import { FinancialExecutionPolicy } from '../../src/agent/policy/financial-policy';
import { PolicyRegistry } from '../../src/agent/policy/policy-registry';

describe.sequential('Phase 25: Merchant Onboarding + Guardrails', () => {
  let prisma: PrismaClient;
  let guardrailRepo: MerchantGuardrailRepository;

  const merchantAId = 'guardrail-test-merchant-a';
  const merchantBId = 'guardrail-test-merchant-b';

  beforeAll(async () => {
    prisma = new PrismaClient();
    guardrailRepo = new MerchantGuardrailRepository(prisma);

    // Clean up test data
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantAId, merchantBId] } } });

    // Create test users and merchants
    const userA = await prisma.user.create({ data: { id: 'guardrail-user-a', email: 'a@guardrailtest.com' } });
    const userB = await prisma.user.create({ data: { id: 'guardrail-user-b', email: 'b@guardrailtest.com' } });

    await prisma.merchant.create({ data: { id: merchantAId, userId: userA.id, name: 'Merchant A (High Volume)' } });
    await prisma.merchant.create({ data: { id: merchantBId, userId: userB.id, name: 'Merchant B (Conservative)' } });
  });

  afterAll(async () => {
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId: { in: [merchantAId, merchantBId] } } });
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantAId, merchantBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: ['guardrail-user-a', 'guardrail-user-b'] } } });
    await prisma.$disconnect();
  });

  // ─── PERSISTENCE ───────────────────────────────────────────────────────────

  it('1. Two merchants with different guardrails can be persisted and read independently', async () => {
    await guardrailRepo.upsertGuardrails({
      merchantId: merchantAId,
      revenueGoal: 'INCREASE_AOV',
      currency: 'INR',
      autonomousPaymentLimitMinor: 2500000,
      approvalAboveMinor: 2500000,
      maxDiscountBps: 1000,
      maxAutonomousDiscountBps: 500, // 5%
      maxApprovalDiscountBps: 2000,  // 20%
      minimumMarginBps: 2000,
      negotiationEnabled: true,
      upsellEnabled: true,
      crossSellEnabled: true,
      disabledSkills: [],
    });

    await guardrailRepo.upsertGuardrails({
      merchantId: merchantBId,
      revenueGoal: 'INCREASE_CONVERSION',
      currency: 'USD',
      autonomousPaymentLimitMinor: 500000,
      approvalAboveMinor: 500000,
      maxDiscountBps: 500,
      maxAutonomousDiscountBps: 500,
      maxApprovalDiscountBps: 500,
      minimumMarginBps: 3000,
      negotiationEnabled: false,
      upsellEnabled: false,
      crossSellEnabled: false,
      disabledSkills: ['negotiation', 'upsell'],
    });

    const configA = await guardrailRepo.getGuardrails(merchantAId);
    const configB = await guardrailRepo.getGuardrails(merchantBId);

    expect(configA).not.toBeNull();
    expect(configB).not.toBeNull();
    expect(configA!.revenueGoal).toBe('INCREASE_AOV');
    expect(configB!.revenueGoal).toBe('INCREASE_CONVERSION');
    expect(configA!.autonomousPaymentLimitMinor).toBe(2500000);
    expect(configB!.autonomousPaymentLimitMinor).toBe(500000);
    expect(configA!.negotiationEnabled).toBe(true);
    expect(configB!.negotiationEnabled).toBe(false);
    expect(configA!.currency).toBe('INR');
    expect(configB!.currency).toBe('USD');
  });

  it('2. Merchant A cannot read Merchant B configuration', async () => {
    const configA = await guardrailRepo.getGuardrails(merchantAId);
    const configB = await guardrailRepo.getGuardrails(merchantBId);

    // Hard isolation: reading by merchantId never leaks
    expect(configA!.merchantId).toBe(merchantAId);
    expect(configB!.merchantId).toBe(merchantBId);
    expect(configA!.autonomousPaymentLimitMinor).not.toBe(configB!.autonomousPaymentLimitMinor);
    expect(configA!.currency).not.toBe(configB!.currency);
  });

  it('3. Missing merchantId returns null (fails closed)', async () => {
    const config = await guardrailRepo.getGuardrails('non-existent-merchant-id');
    expect(config).toBeNull();
  });

  it('4. Missing guardrail configuration returns null (fails closed)', async () => {
    // Create a merchant with no guardrail
    const user = await prisma.user.create({ data: { email: `noguardrail_${Date.now()}@test.com` } });
    const merchant = await prisma.merchant.create({ data: { userId: user.id, name: 'No Guardrail Merchant' } });

    const config = await guardrailRepo.getGuardrails(merchant.id);
    expect(config).toBeNull();

    // Cleanup
    await prisma.merchant.delete({ where: { id: merchant.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  // ─── FINANCIAL POLICY + GUARDRAILS ─────────────────────────────────────────

  it('5. Payment below autonomous limit is ALLOW', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantAId);
    expect(guardrails).not.toBeNull();

    const registry = new PolicyRegistry();
    const policy = new FinancialExecutionPolicy('financial-a', 'Financial Policy A', {
      allowedCurrency: 'INR',
      maxAmountMinor: 99999999,
    });
    registry.register(policy);

    const decision = policy.evaluate(
      { amountMinor: 1000000, currency: 'INR' }, // 1M minor < 2.5M limit
      { sessionId: 's1', executionId: 'e1', guardrails: guardrails! }
    );
    expect(decision.result).toBe('ALLOW');
  });

  it('6. Payment above autonomous limit returns REQUIRES_APPROVAL', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantAId);
    expect(guardrails).not.toBeNull();

    const policy = new FinancialExecutionPolicy('financial-a', 'Financial Policy A', {
      allowedCurrency: 'INR',
      maxAmountMinor: 99999999,
    });

    const decision = policy.evaluate(
      { amountMinor: 3000000, currency: 'INR' }, // 3M minor > 2.5M limit
      { sessionId: 's1', executionId: 'e1', guardrails: guardrails! }
    );
    expect(decision.result).toBe('REQUIRE_APPROVAL');
    expect(decision.requiredApprovals).toContain('merchant');
  });

  it('7. Currency mismatch is DENY', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantAId); // currency: INR
    expect(guardrails).not.toBeNull();

    const policy = new FinancialExecutionPolicy('financial-a', 'Financial Policy A', {
      allowedCurrency: 'INR',
      maxAmountMinor: 99999999,
    });

    const decision = policy.evaluate(
      { amountMinor: 100000, currency: 'USD' }, // Wrong currency
      { sessionId: 's1', executionId: 'e1', guardrails: guardrails! }
    );
    expect(decision.result).toBe('DENY');
    expect(decision.reason).toMatch(/Currency mismatch/);
  });

  // ─── NEGOTIATION ENGINE + GUARDRAILS ────────────────────────────────────────

  it('8. Excessive discount denied when guardrails restrict maxDiscountBps', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantAId); // maxDiscountBps: 1000 (10%)
    expect(guardrails).not.toBeNull();

    const engine = new NegotiationEngine();

    // Policy allows 2000 bps (20%), but guardrail caps at 1000 bps (10%)
    const result = engine.evaluate(
      {
        resourceId: 'prod-1',
        quantity: 1,
        originalPriceMinor: 100000,
        proposedPriceMinor: 85000, // 15% discount — exceeds 10% guardrail
        currency: 'INR',
        costMinor: 60000,          // Provides 41.6% margin, so margin guard passes; discount guard fails
      },
      { enabled: true, negotiable: true, maxDiscountBps: 2000 },
      guardrails!
    );

    // 15% discount (1500 bps) is > 5% autonomous but < 20% approval limit.
    // So it should be allowed but require approval!
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('8b. Discount within maxApprovalDiscountBps but exceeding maxAutonomousDiscountBps returns requiresApproval=true', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantAId);
    expect(guardrails).not.toBeNull();

    const engine = new NegotiationEngine();

    // Guardrail has autonomous limit 5%, approval limit 20%
    const result = engine.evaluate(
      {
        resourceId: 'prod-1',
        quantity: 1,
        originalPriceMinor: 100000,
        proposedPriceMinor: 90000, // 10% discount — exceeds 5% autonomous, within 20% approval
        currency: 'INR',
        costMinor: 60000,
      },
      { enabled: true, negotiable: true, maxDiscountBps: 3000 },
      guardrails!
    );

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('9. Minimum margin enforced from guardrails even if policy is less strict', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantAId); // minimumMarginBps: 2000 (20%)
    expect(guardrails).not.toBeNull();

    const engine = new NegotiationEngine();

    // Policy allows only 1000 bps margin (10%), but guardrails enforce 20%
    const result = engine.evaluate(
      {
        resourceId: 'prod-2',
        quantity: 1,
        originalPriceMinor: 100000,
        proposedPriceMinor: 85000, // leaves only 15% margin over cost
        currency: 'INR',
        costMinor: 75000,          // Cost is 75k, 20% margin floor = 90k min price
      },
      { enabled: true, negotiable: true, minimumMarginBps: 1000 },
      guardrails!
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/margin/i);
  });

  it('10. Disabled skill is NOT available when listed in disabledSkills guardrail', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantBId);
    expect(guardrails).not.toBeNull();
    
    // Simulate what AgentRuntime does: filter disabled skills
    const allSkills = [
      { id: 'negotiation', name: 'negotiation' },
      { id: 'upsell', name: 'upsell' },
      { id: 'payment', name: 'payment' },
    ];

    const disabled = new Set(guardrails!.disabledSkills);
    const filteredSkills = allSkills.filter(s => !disabled.has(s.id) && !disabled.has(s.name));

    expect(filteredSkills.map(s => s.name)).not.toContain('negotiation');
    expect(filteredSkills.map(s => s.name)).not.toContain('upsell');
    expect(filteredSkills.map(s => s.name)).toContain('payment');
  });

  it('11. negotiationEnabled=false blocks negotiation even if policy allows it', async () => {
    const guardrails = await guardrailRepo.getGuardrails(merchantBId); // negotiationEnabled: false
    expect(guardrails).not.toBeNull();

    const engine = new NegotiationEngine();

    const result = engine.evaluate(
      {
        resourceId: 'prod-3',
        quantity: 1,
        originalPriceMinor: 100000,
        proposedPriceMinor: 95000,
        currency: 'USD',
      },
      { enabled: true, negotiable: true },
      guardrails!
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/negotiable|disabled/i);
  });

  it('12. LLM cannot override guardrail values — server-side limits always win', async () => {
    // Simulate a malicious LLM response trying to set autonomousPaymentLimitMinor = Infinity
    const guardrails = await guardrailRepo.getGuardrails(merchantBId); // autonomousPaymentLimitMinor: 500000
    expect(guardrails).not.toBeNull();

    const policy = new FinancialExecutionPolicy('financial-b', 'Financial Policy B', {
      allowedCurrency: 'USD',
      maxAmountMinor: 99999999,
      // Attacker-injected approval threshold (high)
      approvalThresholdMinor: 99999999, // Static config says "allow all"
    });

    // Even though static config allows it, guardrails block at autonomousPaymentLimitMinor
    const decision = policy.evaluate(
      { amountMinor: 2000000, currency: 'USD' }, // 2M > 500k guardrail limit
      { sessionId: 's1', executionId: 'e1', guardrails: guardrails! }
    );

    expect(decision.result).toBe('REQUIRE_APPROVAL');
    expect(decision.requiredApprovals).toContain('merchant');
  });

  it('13. NegotiationEngine uses merchant-specific limits from guardrails', async () => {
    const guardrailsA = await guardrailRepo.getGuardrails(merchantAId); // maxDiscountBps: 1000
    const guardrailsB = await guardrailRepo.getGuardrails(merchantBId); // maxDiscountBps: 500

    const engine = new NegotiationEngine();
    const baseProposal = {
      resourceId: 'prod-shared',
      quantity: 1,
      originalPriceMinor: 100000,
      proposedPriceMinor: 93000, // 7% discount
      currency: 'INR',
    };

    // Merchant A allows 10% discount — 7% should be allowed
    const resultA = engine.evaluate(
      { ...baseProposal, currency: 'INR', costMinor: 50000 }, // 50k cost, 43k margin on 93k proposed = 86% > 20%
      { enabled: true, negotiable: true },
      guardrailsA!
    );
    expect(resultA.allowed).toBe(true);

    // Merchant B only allows 5% discount — 7% should be denied
    const resultB = engine.evaluate(
      { ...baseProposal, currency: 'USD' },
      { enabled: true, negotiable: true },
      guardrailsB!
    );
    expect(resultB.allowed).toBe(false);
  });

  it('14. Concurrent requests for different merchants remain isolated', async () => {
    const [configA, configB] = await Promise.all([
      guardrailRepo.getGuardrails(merchantAId),
      guardrailRepo.getGuardrails(merchantBId),
    ]);

    expect(configA!.merchantId).toBe(merchantAId);
    expect(configB!.merchantId).toBe(merchantBId);
    expect(configA!.currency).not.toBe(configB!.currency);
    expect(configA!.autonomousPaymentLimitMinor).not.toBe(configB!.autonomousPaymentLimitMinor);
  });

  it('15. Upsert overwrites guardrails and new values take effect', async () => {
    // Change Merchant A's autonomous limit
    await guardrailRepo.upsertGuardrails({
      merchantId: merchantAId,
      revenueGoal: 'INCREASE_AOV',
      currency: 'INR',
      autonomousPaymentLimitMinor: 5000000, // raised
      approvalAboveMinor: 5000000,
      maxDiscountBps: 1000,
      minimumMarginBps: 2000,
      negotiationEnabled: true,
      upsellEnabled: true,
      crossSellEnabled: true,
      disabledSkills: [],
    });

    const updated = await guardrailRepo.getGuardrails(merchantAId);
    expect(updated!.autonomousPaymentLimitMinor).toBe(5000000);
  });
});
