import { describe, it, expect, beforeEach } from 'vitest';
import { NegotiationEngine } from '../../src/agent/intelligence/negotiation/negotiation-engine';
import { NegotiationPolicy, NegotiationProposal } from '../../src/agent/intelligence/negotiation/types';

describe('Phase 23: Deterministic Negotiation Engine', () => {
  let engine: NegotiationEngine;

  beforeEach(() => {
    engine = new NegotiationEngine();
  });

  const defaultPolicy: NegotiationPolicy = {
    enabled: true,
    negotiable: true,
    maxDiscountBps: 1000, // 10%
  };

  const defaultProposal: NegotiationProposal = {
    resourceId: 'prod_123',
    quantity: 1,
    originalPriceMinor: 100000, // ₹1000.00
    proposedPriceMinor: 95000,  // ₹950.00
    currency: 'INR'
  };

  it('1. Valid proposal -> ALLOW', () => {
    const result = engine.evaluate(defaultProposal, defaultPolicy);
    expect(result.allowed).toBe(true);
    expect(result.approvedPriceMinor).toBe(95000);
  });

  it('2. Excessive discount -> DENY', () => {
    const proposal = { ...defaultProposal, proposedPriceMinor: 80000 }; // 20% discount (max allowed 10%)
    const result = engine.evaluate(proposal, defaultPolicy);
    expect(result.allowed).toBe(false);
    expect(result.approvedPriceMinor).toBe(90000); // Floored at 10% discount
    expect(result.reason).toContain('maximum discount');
  });

  it('3. Approved maximum discount -> ALLOW', () => {
    const proposal = { ...defaultProposal, proposedPriceMinor: 90000 };
    const result = engine.evaluate(proposal, defaultPolicy);
    expect(result.allowed).toBe(true);
    expect(result.approvedPriceMinor).toBe(90000);
  });

  it('4. Minimum margin violation -> DENY', () => {
    const policy = { ...defaultPolicy, minimumMarginBps: 2000 }; // 20% margin required
    const proposal = { ...defaultProposal, costMinor: 80000, proposedPriceMinor: 90000 };
    // Cost is 800, margin required is 20% of 800 = 160. Floor = 960 (96000 minor).
    // Proposed 900 (90000) should be DENIED.
    const result = engine.evaluate(proposal, policy);
    expect(result.allowed).toBe(false);
    expect(result.approvedPriceMinor).toBe(96000);
    expect(result.reason).toContain('minimum margin');
  });

  it('5. Quantity tier correctly changes allowed discount', () => {
    const policy = {
      ...defaultPolicy,
      maxDiscountBps: 500, // 5% base
      quantityDiscountTiers: [
        { minQuantity: 10, discountBps: 1500 }, // 15% for 10+
        { minQuantity: 50, discountBps: 2500 }, // 25% for 50+
      ]
    };

    // 1 unit -> falls to base 5% (floor = 95000)
    expect(engine.evaluate({ ...defaultProposal, proposedPriceMinor: 90000, quantity: 1 }, policy).allowed).toBe(false);

    // 10 units -> 15% discount allowed (floor = 85000)
    const result10 = engine.evaluate({ ...defaultProposal, proposedPriceMinor: 85000, quantity: 10 }, policy);
    expect(result10.allowed).toBe(true);
    expect(result10.appliedRule).toContain('quantity discount tier >= 10');

    // 50 units -> 25% discount allowed (floor = 75000)
    const result50 = engine.evaluate({ ...defaultProposal, proposedPriceMinor: 75000, quantity: 50 }, policy);
    expect(result50.allowed).toBe(true);
    expect(result50.appliedRule).toContain('quantity discount tier >= 50');
  });

  it('6. Non-negotiable resource -> DENY', () => {
    const policy = { ...defaultPolicy, negotiable: false };
    const result = engine.evaluate(defaultProposal, policy);
    expect(result.allowed).toBe(false);
    expect(result.approvedPriceMinor).toBe(100000);
  });

  it('8. Conflicting discount and margin constraints -> strictest floor wins', () => {
    const policy = {
      ...defaultPolicy,
      maxDiscountBps: 2000, // Allows up to 20% discount (floor = 800)
      minimumMarginBps: 2500, // Margin requires 25% on cost.
    };
    const proposal = { ...defaultProposal, originalPriceMinor: 100000, costMinor: 70000, proposedPriceMinor: 80000 };
    // Discount floor = 800 (80000)
    // Margin floor = 70000 + 25% = 87500
    // Max of both = 87500. Strictest floor wins.
    const result = engine.evaluate(proposal, policy);
    
    expect(result.allowed).toBe(false);
    expect(result.approvedPriceMinor).toBe(87500);
    expect(result.reason).toContain('minimum margin');
  });

  it('13. Integer minor-unit calculations remain exact', () => {
    // ₹10.55 price = 1055 minor. 13% discount.
    const policy = { ...defaultPolicy, maxDiscountBps: 1300 };
    const proposal = { ...defaultProposal, originalPriceMinor: 1055, proposedPriceMinor: 917 };
    
    // discount = floor(1055 * 0.13) = floor(137.15) = 137
    // floor = 1055 - 137 = 918
    const result = engine.evaluate(proposal, policy);
    expect(result.allowed).toBe(false);
    expect(result.approvedPriceMinor).toBe(918); 
  });

  it('15. Different merchants can have different negotiation policies', () => {
    const merchantAPolicy = { ...defaultPolicy, maxDiscountBps: 500 };
    const merchantBPolicy = { ...defaultPolicy, maxDiscountBps: 1500 };

    const proposal = { ...defaultProposal, proposedPriceMinor: 88000 }; // 12% discount

    expect(engine.evaluate(proposal, merchantAPolicy).allowed).toBe(false);
    expect(engine.evaluate(proposal, merchantBPolicy).allowed).toBe(true);
  });

  it('Safety: Missing cost with margin policy denies negotiation', () => {
    const policy = { ...defaultPolicy, minimumMarginBps: 1000 };
    // Proposal is missing costMinor
    const result = engine.evaluate(defaultProposal, policy);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cost is missing');
  });

  it('Safety: Proposal exceeding original price is denied', () => {
    const proposal = { ...defaultProposal, proposedPriceMinor: 110000 }; // greater than 100000
    const result = engine.evaluate(proposal, defaultPolicy);
    expect(result.allowed).toBe(false);
    expect(result.approvedPriceMinor).toBe(100000);
    expect(result.reason).toContain('exceeds original price');
  });
});
