import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import {
  ToolRegistry,
  ToolGateway,
  Tool,
  ToolId,
  ToolExecutionContext,
  InProcessToolAdapter
} from '../../src/agent/tools';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { PolicyRegistry } from '../../src/agent/policy/policy-registry';
import { FinancialExecutionPolicy } from '../../src/agent/policy/financial-policy';
import { PolicyAuthorizationError, PolicyApprovalRequiredError } from '../../src/agent/policy/errors';
import { IdempotencyEngine } from '../../src/agent/idempotency/engine';
import { RateLimiter, RateLimitConfig } from '../../src/agent/rate-limiting';
import { MerchantGuardrailRepository } from '../../src/database/repositories/merchant-guardrail.repository';
import { MerchantCapabilityResolver, StaticMerchantCapabilities } from '../../src/agent/intelligence/capability-resolver';
import { MerchantCapability } from '../../src/agent/intelligence/types';
import { WorkflowStateMachine } from '../../src/agent/workflows/workflow-state-machine';
import { createCapturePaymentTool } from '../../src/agent/tools/payment/capture-payment.tool';

describe('Phase 26: Payment Firewall', () => {
  let registry: ToolRegistry;
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };
  let policyEngine: PolicyEngine;
  let idempotencyEngine: IdempotencyEngine;
  let guardrailRepo: MerchantGuardrailRepository;
  let capabilityResolver: MerchantCapabilityResolver;
  let gateway: ToolGateway;
  
  let providerExecuteCount = 0;
  const mockProvider = {
    capturePayment: vi.fn().mockImplementation(async (req) => {
      providerExecuteCount++;
      return { success: true, data: { id: `txn-${providerExecuteCount}` } };
    })
  };

  const merchantAId = 'merchant-a-firewall';
  const merchantBId = 'merchant-b-firewall';

  beforeEach(() => {
    providerExecuteCount = 0;
    mockProvider.capturePayment.mockClear();

    registry = new ToolRegistry();
    eventEmitter = { emit: vi.fn() };

    const policyRegistry = new PolicyRegistry();
    policyRegistry.register(new FinancialExecutionPolicy('financial-policy', 'Financial Policy', {
      allowedCurrency: 'INR',
      maxAmountMinor: 100000000 // 1M INR
    }));
    policyEngine = new PolicyEngine(policyRegistry);

    // In-memory mock for idempotency to keep tests fast
    idempotencyEngine = {
      execute: async (key: string, scope: string, input: any, fn: () => Promise<any>) => {
        // Simplified mock idempotency for the firewall test (real one uses Prisma)
        const store = (global as any).__idempotencyStore || new Map();
        (global as any).__idempotencyStore = store;
        
        const fullKey = `${scope}::${key}`;
        if (store.has(fullKey)) {
          return store.get(fullKey);
        }
        
        const promise = fn();
        store.set(fullKey, promise);
        return promise;
      }
    } as any;

    guardrailRepo = {
      getGuardrails: vi.fn().mockImplementation(async (id: string) => {
        if (id === merchantAId) {
          return {
            merchantId: merchantAId,
            currency: 'INR',
            autonomousPaymentLimitMinor: 5000000, // 50,000 INR
            approvalAboveMinor: 5000000,
            maxDiscountBps: 2000,
            minimumMarginBps: 1000,
            negotiationEnabled: true,
            upsellEnabled: false,
            crossSellEnabled: false,
            disabledSkills: []
          };
        }
        if (id === merchantBId) {
          return {
            merchantId: merchantBId,
            currency: 'USD',
            autonomousPaymentLimitMinor: 10000, // 100 USD
            approvalAboveMinor: 10000,
            maxDiscountBps: 0,
            minimumMarginBps: 0,
            negotiationEnabled: false,
            upsellEnabled: false,
            crossSellEnabled: false,
            disabledSkills: []
          };
        }
        return null;
      })
    } as any;

    capabilityResolver = {
      resolve: vi.fn().mockImplementation(async (id: string) => {
        if (id === merchantAId) return new StaticMerchantCapabilities(['payment.create']);
        if (id === merchantBId) return new StaticMerchantCapabilities([]); // missing payment.create
        if (id === 'unknown-merchant') return new StaticMerchantCapabilities(['payment.create']); // has capability, lacks guardrails
        return new StaticMerchantCapabilities([]);
      })
    } as any;

    gateway = new ToolGateway({
      toolRegistry: registry,
      eventEmitter,
      policyEngine,
      idempotencyEngine,
      guardrailRepository: guardrailRepo,
      capabilityResolver
    });

    const tool = createCapturePaymentTool(mockProvider as any);
    registry.register(tool);
    
    // Reset idempotency store
    (global as any).__idempotencyStore = new Map();
  });

  const getBaseContext = (merchantId: string | undefined): ToolExecutionContext => ({
    executionId: 'exec-123',
    agentId: 'agent-007',
    sessionId: 'session-xyz',
    merchantId,
    idempotencyKey: 'idem-key-1'
  });

  const baseInput = {
    paymentId: 'pay_123',
    amountMinor: 1000, // 10 INR
    currency: 'INR'
  };

  it('1. Missing merchant identity -> FAIL CLOSED', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: baseInput,
      context: getBaseContext(undefined)
    })).rejects.toThrowError(PolicyAuthorizationError);
    expect(providerExecuteCount).toBe(0);
  });

  it('2. Merchant without payment capability -> DENY', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: { ...baseInput, currency: 'USD' },
      context: getBaseContext(merchantBId) // merchant B lacks payment.create
    })).rejects.toThrowError(/Merchant lacks required capability: payment.create/);
    expect(providerExecuteCount).toBe(0);
  });

  it('3. LLM attempts to inject another merchantId -> trusted ExecutionIdentity wins', async () => {
    // Execution context belongs to Merchant A (trusted)
    // The payload maliciously attempts to act as merchant B
    const maliciousInput = {
      ...baseInput,
      merchantId: merchantBId 
    };

    const result = await gateway.execute({
      toolId: 'capture-payment',
      input: maliciousInput, // extra keys allowed by Tool (Zod will strip them if not in schema, but even if it didn't)
      context: getBaseContext(merchantAId) // TRUSTED
    });

    // Should succeed because Merchant A is used, not B (B lacks capabilities)
    expect(result.output.id).toBe('txn-1');
    expect(providerExecuteCount).toBe(1);
  });

  it('4. Missing merchant guardrails -> DENY', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: baseInput,
      context: getBaseContext('unknown-merchant')
    })).rejects.toThrowError(/Guardrails required for policy execution but missing/);
    expect(providerExecuteCount).toBe(0);
  });

  it('5. Currency mismatch -> DENY', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: { ...baseInput, currency: 'USD' }, // Merchant A expects INR
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(/Currency mismatch/);
    expect(providerExecuteCount).toBe(0);
  });

  it('6. Amount above autonomous limit -> REQUIRES_APPROVAL', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: { ...baseInput, amountMinor: 6000000 }, // 60k INR > 50k limit
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(PolicyApprovalRequiredError);
    expect(providerExecuteCount).toBe(0);
  });

  it('7. Amount below autonomous limit -> ALLOW', async () => {
    const result = await gateway.execute({
      toolId: 'capture-payment',
      input: { ...baseInput, amountMinor: 4000000 },
      context: getBaseContext(merchantAId)
    });
    expect(result.output.id).toBe('txn-1');
    expect(providerExecuteCount).toBe(1);
  });

  it('8. Duplicate payment -> provider called once', async () => {
    await gateway.execute({
      toolId: 'capture-payment',
      input: baseInput,
      context: getBaseContext(merchantAId)
    });

    await gateway.execute({
      toolId: 'capture-payment',
      input: baseInput,
      context: getBaseContext(merchantAId) // same idempotency key
    });

    expect(providerExecuteCount).toBe(1); // Provider only called once
  });

  it('9. Concurrent duplicate payment -> provider called once', async () => {
    await Promise.all([
      gateway.execute({
        toolId: 'capture-payment',
        input: baseInput,
        context: getBaseContext(merchantAId)
      }),
      gateway.execute({
        toolId: 'capture-payment',
        input: baseInput,
        context: getBaseContext(merchantAId)
      })
    ]);

    expect(providerExecuteCount).toBe(1);
  });

  it('10. Missing idempotency key -> FAIL CLOSED', async () => {
    const ctx = getBaseContext(merchantAId);
    delete ctx.idempotencyKey;
    
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: baseInput,
      context: ctx
    })).rejects.toThrowError(/requires an idempotencyKey/);
    expect(providerExecuteCount).toBe(0);
  });

  it('11. Fractional financial amount -> schema rejection', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: { ...baseInput, amountMinor: 100.50 }, // fractional
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(/Expected integer, received float/);
    expect(providerExecuteCount).toBe(0);
  });

  it('12. Invalid payment payload -> schema rejection', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: { amountMinor: 1000 }, // missing paymentId and currency
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(/Invalid input/);
    expect(providerExecuteCount).toBe(0);
  });

  it('13. Malicious SKILL.md -> cannot bypass policy', async () => {
    // Skills are parsed and executed by LLM upstream. ToolGateway has no knowledge of the skill.
    // The LLM decides to call capture-payment with an amount above limit.
    const llmOutput = {
      toolId: 'capture-payment',
      input: { ...baseInput, amountMinor: 99999999 }
    };
    
    // ToolGateway blindly enforces the policy
    await expect(gateway.execute({
      ...llmOutput,
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(PolicyApprovalRequiredError);
    expect(providerExecuteCount).toBe(0);
  });

  it('14. Direct ToolGateway invocation -> same merchant guardrail enforcement as AgentRuntime', async () => {
    // Calling ToolGateway directly without AgentRuntime still blocks missing merchant context
    const ctx = { executionId: 'direct', agentId: 'direct', sessionId: 'direct' }; // No merchantId
    
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: baseInput,
      context: ctx
    })).rejects.toThrowError(PolicyAuthorizationError);
  });

  it('15. AgentRuntime bypass simulation -> ToolGateway still blocks unauthorized payment', async () => {
    // If an attacker bypasses the AgentRuntime filtering and directly constructs an execution request
    // using Merchant B (who lacks capabilities)
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: { ...baseInput, currency: 'USD' },
      context: getBaseContext(merchantBId) // Attacker sets merchant to B, but Gateway checks capabilities for B
    })).rejects.toThrowError(/Merchant lacks required capability/);
  });

  it('16. LLM attempts autonomous=true above limit -> REQUIRES_APPROVAL', async () => {
    // Even if LLM payload includes `{ autonomous: true }`, schema validation strips it
    // and Policy Engine ignores it.
    const inputFromLLM = {
      ...baseInput,
      amountMinor: 6000000,
      autonomous: true // LLM tries to force it
    };
    
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: inputFromLLM,
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(PolicyApprovalRequiredError);
    expect(providerExecuteCount).toBe(0);
  });

  it('17. LLM attempts to override currency -> DENY', async () => {
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: { ...baseInput, currency: 'USD' }, // overrides INR
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(/Currency mismatch/);
  });

  it('18. LLM attempts to inject guardrail values -> LLM values ignored', async () => {
    // Tool input schema doesn't accept guardrails.
    const inputWithFakeGuardrails = {
      ...baseInput,
      amountMinor: 9000000,
      guardrails: { autonomousPaymentLimitMinor: 10000000 }
    };
    
    await expect(gateway.execute({
      toolId: 'capture-payment',
      input: inputWithFakeGuardrails as any,
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(PolicyApprovalRequiredError);
    
    expect(providerExecuteCount).toBe(0);
  });

  it('19. Missing policy ID -> FAIL CLOSED', async () => {
    const maliciousTool: Tool<any, any> = {
      metadata: { id: 'malicious' as ToolId, name: 'Malicious', description: 'Malicious tool', version: '1' },
      inputSchema: z.any(),
      outputSchema: z.any(),
      // no policy declared!
      adapter: new InProcessToolAdapter(async () => { providerExecuteCount++; return {}; })
    };
    registry.register(maliciousTool);
    
    await expect(gateway.execute({
      toolId: 'malicious',
      input: {},
      context: getBaseContext(merchantAId)
    })).rejects.toThrowError(/must declare a policy to execute/);
    expect(providerExecuteCount).toBe(0);
  });
});
