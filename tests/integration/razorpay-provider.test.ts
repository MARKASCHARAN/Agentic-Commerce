import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { RazorpayProvider } from '../../src/providers/razorpay/razorpay.provider';
import { createCapturePaymentTool } from '../../src/agent/tools/payment/capture-payment.tool';
import { createRefundPaymentTool } from '../../src/agent/tools/refund/refund-payment.tool';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { PolicyRegistry } from '../../src/agent/policy/policy-registry';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { IdempotencyEngine } from '../../src/agent/idempotency/engine';
import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { RateLimiter } from '../../src/agent/rate-limiting/rate-limiter';
import { RedisService } from '../../src/database/redis/redis-client';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { IdempotencyUnknownError } from '../../src/agent/idempotency/errors';

const prisma = new PrismaClient();

describe('Phase 14: Payment Domain Contract & Provider Boundary', () => {
  let provider: RazorpayProvider;
  let toolGateway: ToolGateway;
  let redisService: RedisService;
  
  const hasCredentials = !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

  beforeEach(async () => {

    redisService = new RedisService({ host: 'localhost', port: 6380 });
    const rateLimiter = new RateLimiter(redisService, {
      agentConfig: { capacity: 100, refillRatePerSecond: 100 },
      sessionConfig: { capacity: 100, refillRatePerSecond: 100 },
      globalConfig: { capacity: 1000, refillRatePerSecond: 1000 }
    });

    const policyRegistry = new PolicyRegistry();
    policyRegistry.register({
      metadata: { id: 'financial-policy', name: 'financial', description: 'financial policy', version: '1.0.0' },
      inputSchema: z.any(),
      evaluate: async () => ({ status: 'ALLOW' })
    });
    const policyEngine = new PolicyEngine(policyRegistry);

    const idempotencyRepository = new PrismaIdempotencyRepository(prisma);
    const idempotencyEngine = new IdempotencyEngine(idempotencyRepository);

    provider = new RazorpayProvider(
      process.env.RAZORPAY_KEY_ID || 'test_key',
      process.env.RAZORPAY_KEY_SECRET || 'test_secret'
    );

    vi.spyOn((provider as any).razorpay.payments, 'capture').mockImplementation(async (id, amount, currency) => {
      return { id, amount, currency, status: 'captured' };
    });
    vi.spyOn((provider as any).razorpay.payments, 'refund').mockImplementation(async (id, params) => {
      return { id: 'rfnd_123', payment_id: id, amount: params.amount, status: 'processed' };
    });
    vi.spyOn((provider as any).razorpay.payments, 'fetch').mockImplementation(async (id) => {
      return { id, amount: 1000, currency: 'INR', status: 'refunded' };
    });

    const captureTool = createCapturePaymentTool(provider);
    const refundTool = createRefundPaymentTool(provider);

    const toolRegistry = new ToolRegistry();
    toolRegistry.register(captureTool);
    toolRegistry.register(refundTool);

    toolGateway = new ToolGateway({
      toolRegistry,
      policyEngine,
      idempotencyEngine,
      rateLimiter,
      rateLimitConfigMap: new Map([
        ['capture-payment', { capacity: 10, refillRatePerSecond: 10 }],
        ['refund-payment', { capacity: 10, refillRatePerSecond: 10 }]
      ]),
      capabilityResolver: {
        resolve: async () => new Set(['payment.create', 'payment.refund'])
      } as any,
      eventEmitter: new EventEmitter()
    });
  });

  afterEach(async () => {
    await redisService.disconnect();
    vi.restoreAllMocks();
  });

  it('1. Should execute complete boundary chain successfully', async () => {
    const result = await toolGateway.execute({
      toolId: 'capture-payment',
      input: {
        paymentId: 'pay_123',
        amountMinor: 1000,
        currency: 'INR'
      },
      context: {
        sessionId: 'sess_1',
        executionId: 'exec_1',
        merchantId: 'merchant-1',
        idempotencyKey: `capture_idem_key_1_${crypto.randomUUID()}`
      }
    });

    expect(result.output.providerId).toBe('pay_123');
    expect(result.output.status).toBe('captured');
  });

  it('2. Should prevent duplicate provider calls for the same operation (Idempotency)', async () => {
    const context = { sessionId: 'sess_2', executionId: 'exec_2', merchantId: 'merchant-1', idempotencyKey: `idem_key_2_${crypto.randomUUID()}` };
    
    const result1 = await toolGateway.execute({ toolId: 'capture-payment', input: { paymentId: 'pay_abc', amountMinor: 500, currency: 'INR' }, context });
    const result2 = await toolGateway.execute({ toolId: 'capture-payment', input: { paymentId: 'pay_abc', amountMinor: 500, currency: 'INR' }, context });

    expect(result1.output.providerId).toBe('pay_abc');
    expect(result2.output.providerId).toBe('pay_abc');

    if (!hasCredentials) {
      expect((provider as any).razorpay.payments.capture).toHaveBeenCalledTimes(1);
    }
  });

  it('3. Should trigger UNKNOWN state on network timeout and refuse blind retries', async () => {
    
    vi.spyOn((provider as any).razorpay.payments, 'capture').mockRejectedValueOnce({
      code: 'ETIMEDOUT'
    });

    const context = { sessionId: 'sess_3', executionId: 'exec_3', merchantId: 'merchant-1', idempotencyKey: `idem_key_timeout_${crypto.randomUUID()}` };
    const input = { paymentId: 'pay_timeout', amountMinor: 1000, currency: 'INR' };

    await expect(toolGateway.execute({ toolId: 'capture-payment', input, context })).rejects.toThrowError(/time/i);

    await expect(toolGateway.execute({ toolId: 'capture-payment', input, context })).rejects.toThrowError(/UNKNOWN/i);

    expect((provider as any).razorpay.payments.capture).toHaveBeenCalledTimes(1);
  });
});
