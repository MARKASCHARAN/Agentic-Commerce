import { describe, it, expect } from 'vitest';
import { FinancialExecutionPolicy } from '../../src/agent/policy';

describe('FinancialExecutionPolicy', () => {
  const baseContext = {
    executionId: 'exec-1',
    agentId: 'agent-1',
    sessionId: 'session-1'
  };

  it('should allow amounts within configured boundaries', () => {
    const policy = new FinancialExecutionPolicy('policy-1', 'Test Policy', {
      allowedCurrency: 'INR',
      minAmountMinor: 100,
      maxAmountMinor: 10000
    });

    expect(policy.evaluate({ amountMinor: 100, currency: 'INR' }, baseContext).result).toBe('ALLOW');
    expect(policy.evaluate({ amountMinor: 101, currency: 'INR' }, baseContext).result).toBe('ALLOW');
    expect(policy.evaluate({ amountMinor: 5000, currency: 'INR' }, baseContext).result).toBe('ALLOW');
    expect(policy.evaluate({ amountMinor: 9999, currency: 'INR' }, baseContext).result).toBe('ALLOW');
    expect(policy.evaluate({ amountMinor: 10000, currency: 'INR' }, baseContext).result).toBe('ALLOW');
  });

  it('should deny amounts strictly outside boundaries', () => {
    const policy = new FinancialExecutionPolicy('policy-1', 'Test Policy', {
      allowedCurrency: 'INR',
      minAmountMinor: 100,
      maxAmountMinor: 10000
    });

    expect(policy.evaluate({ amountMinor: 99, currency: 'INR' }, baseContext).result).toBe('DENY');
    expect(policy.evaluate({ amountMinor: 10001, currency: 'INR' }, baseContext).result).toBe('DENY');
  });

  it('should deny currency mismatch even if amount is valid', () => {
    const policy = new FinancialExecutionPolicy('policy-1', 'Test Policy', {
      allowedCurrency: 'INR',
      maxAmountMinor: 10000
    });

    expect(policy.evaluate({ amountMinor: 5000, currency: 'USD' }, baseContext).result).toBe('DENY');
    expect(policy.evaluate({ amountMinor: 5000, currency: 'inr' }, baseContext).result).toBe('DENY'); 
  });

  it('should handle approval threshold logic', () => {
    const policy = new FinancialExecutionPolicy('policy-1', 'Test Policy', {
      allowedCurrency: 'INR',
      maxAmountMinor: 10000,
      approvalThresholdMinor: 5000
    });

    expect(policy.evaluate({ amountMinor: 4999, currency: 'INR' }, baseContext).result).toBe('ALLOW');
    expect(policy.evaluate({ amountMinor: 5000, currency: 'INR' }, baseContext).result).toBe('ALLOW');
    
    const decision = policy.evaluate({ amountMinor: 5001, currency: 'INR' }, baseContext);
    expect(decision.result).toBe('REQUIRE_APPROVAL');
    if (decision.result === 'REQUIRE_APPROVAL') {
      expect(decision.requiredApprovals).toContain('manager');
    }

    const highDecision = policy.evaluate({ amountMinor: 9999, currency: 'INR' }, baseContext);
    expect(highDecision.result).toBe('REQUIRE_APPROVAL');

    expect(policy.evaluate({ amountMinor: 10001, currency: 'INR' }, baseContext).result).toBe('DENY');
  });

  it('should allow zero if minimum is zero', () => {
    const policy = new FinancialExecutionPolicy('policy-1', 'Test Policy', {
      allowedCurrency: 'INR',
      minAmountMinor: 0,
      maxAmountMinor: 10000
    });

    expect(policy.evaluate({ amountMinor: 0, currency: 'INR' }, baseContext).result).toBe('ALLOW');
  });

  it('should deny zero if minimum is greater than zero', () => {
    const policy = new FinancialExecutionPolicy('policy-1', 'Test Policy', {
      allowedCurrency: 'INR',
      minAmountMinor: 1,
      maxAmountMinor: 10000
    });

    expect(policy.evaluate({ amountMinor: 0, currency: 'INR' }, baseContext).result).toBe('DENY');
  });

  it('should enforce zod schema rejecting negative and non-integer amounts', async () => {
    const policy = new FinancialExecutionPolicy('policy-1', 'Test Policy', {
      allowedCurrency: 'INR',
      maxAmountMinor: 10000
    });

    await expect(policy.inputSchema.parseAsync({ amountMinor: -1, currency: 'INR' })).rejects.toThrow();
    await expect(policy.inputSchema.parseAsync({ amountMinor: 50.5, currency: 'INR' })).rejects.toThrow();
  });
});
