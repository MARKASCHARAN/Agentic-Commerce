import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { RiskGate, HighVelocityRule, AnomalousVolumeRule, RiskEvaluationError } from '../../src/agent/risk';
import { PolicyAuthorizationError, PolicyApprovalRequiredError } from '../../src/agent/policy/errors';
import { z } from 'zod';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { Tool } from '../../src/agent/tools/types';

describe('Phase 27: Risk Gate Integration', () => {
  let toolGateway: ToolGateway;
  let eventEmitter: EventEmitter;
  let policyEngine: PolicyEngine;
  let riskGate: RiskGate;

  const merchantId = 'merchant-risk-1';
  const baseContext = {
    agentId: 'agent-1',
    sessionId: 'session-1',
    executionId: 'exec-1',
    merchantId,
    idempotencyKey: 'idem-1'
  };

  beforeEach(() => {
    const registry = new ToolRegistry();
    eventEmitter = new EventEmitter();
    
    // Mock Policy Engine - we will override evaluate in specific tests
    policyEngine = { evaluate: vi.fn() } as unknown as PolicyEngine;
    
    // Setup Risk Gate with deterministic rules
    riskGate = new RiskGate([
      new HighVelocityRule(),
      new AnomalousVolumeRule(50000) // 50k minor limit for review
    ]);

    const captureTool: Tool<any, any> = {
      metadata: { id: 'capture-payment' as any, name: 'Capture', description: 'Desc', version: '1' },
      inputSchema: z.object({ amountMinor: z.number(), paymentId: z.string() }),
      outputSchema: z.any(),
      policy: { id: 'financial-policy' },
      adapter: { type: 'in-process', execute: vi.fn().mockResolvedValue({ status: 'success' }) } as any
    };

    registry.register(captureTool);

    toolGateway = new ToolGateway({
      toolRegistry: registry,
      eventEmitter,
      policyEngine,
      riskGate,
      capabilityResolver: { resolve: async () => new Set(['payment.create']) } as any,
      guardrailRepository: { getGuardrails: async () => ({ merchantId }) } as any,
    });
  });

  it('1. Policy DENY short-circuits execution and bypasses Risk Gate', async () => {
    vi.spyOn(policyEngine, 'evaluate').mockResolvedValueOnce({ result: 'DENY', reason: 'Blocked by policy' });
    const riskSpy = vi.spyOn(riskGate, 'evaluate');

    await expect(toolGateway.execute({
      toolId: 'capture-payment',
      input: { amountMinor: 1000, paymentId: 'pay_1' },
      context: baseContext
    })).rejects.toThrowError(PolicyAuthorizationError);

    // Risk Gate MUST NOT be called if Policy Denies
    expect(riskSpy).not.toHaveBeenCalled();
  });

  it('2. Policy REQUIRE_APPROVAL short-circuits execution and bypasses Risk Gate', async () => {
    vi.spyOn(policyEngine, 'evaluate').mockResolvedValueOnce({ result: 'REQUIRE_APPROVAL', requiredApprovals: ['merchant'] });
    const riskSpy = vi.spyOn(riskGate, 'evaluate');

    await expect(toolGateway.execute({
      toolId: 'capture-payment',
      input: { amountMinor: 1000, paymentId: 'pay_1' },
      context: baseContext
    })).rejects.toThrowError(PolicyApprovalRequiredError);

    // Risk Gate MUST NOT be called if Policy Requires Approval
    expect(riskSpy).not.toHaveBeenCalled();
  });

  it('3. Policy ALLOW + Risk ALLOW = Successful Execution', async () => {
    vi.spyOn(policyEngine, 'evaluate').mockResolvedValueOnce({ result: 'ALLOW' });
    const riskSpy = vi.spyOn(riskGate, 'evaluate');

    const result = await toolGateway.execute({
      toolId: 'capture-payment',
      input: { amountMinor: 1000, paymentId: 'pay_1' }, // Under 50k, safe
      context: baseContext
    });

    expect((result.output as any).status).toBe('success');
    expect(riskSpy).toHaveBeenCalledTimes(1);
  });

  it('4. Policy ALLOW + Risk DENY = RiskEvaluationError (Fail Closed)', async () => {
    vi.spyOn(policyEngine, 'evaluate').mockResolvedValueOnce({ result: 'ALLOW' });
    
    // trigger velocity rule
    await expect(toolGateway.execute({
      toolId: 'capture-payment',
      input: { amountMinor: 1000, paymentId: 'risk_velocity_deny' },
      context: baseContext
    })).rejects.toThrowError(RiskEvaluationError);
  });

  it('5. Policy ALLOW + Risk REVIEW = PolicyApprovalRequiredError(risk-team)', async () => {
    vi.spyOn(policyEngine, 'evaluate').mockResolvedValue({ result: 'ALLOW' });
    
    // trigger anomalous volume rule (> 50,000)
    await expect(toolGateway.execute({
      toolId: 'capture-payment',
      input: { amountMinor: 100000, paymentId: 'pay_high_volume' },
      context: baseContext
    })).rejects.toThrowError(PolicyApprovalRequiredError);

    try {
      await toolGateway.execute({
        toolId: 'capture-payment',
        input: { amountMinor: 100000, paymentId: 'pay_high_volume' },
        context: baseContext
      });
    } catch (e: any) {
      expect(e).toBeInstanceOf(PolicyApprovalRequiredError);
      expect(e.policyId).toBe('risk-gate');
      expect(e.requiredApprovals).toContain('risk-team');
      expect(e.reason).toContain('exceeds risk review threshold');
    }
  });
});
