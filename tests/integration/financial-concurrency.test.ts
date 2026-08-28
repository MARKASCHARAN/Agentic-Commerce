import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { IdempotencyEngine, IdempotencyConflictError, IdempotencyInProgressError, IdempotencyUnknownError } from '../../src/agent/idempotency';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { PolicyRegistry } from '../../src/agent/policy/policy-registry';
import { WorkflowStateMachine, createWorkflowDefinition, WorkflowId } from '../../src/agent/workflows';
import { PrismaWorkflowRepository } from '../../src/database/repositories/workflow.repository';
import { RateLimiter } from '../../src/agent/rate-limiting/rate-limiter';
import { RedisService } from '../../src/database/redis/redis-client';
import { z } from 'zod';
import { EventEmitter } from 'events';

describe('Phase 13: Financial Concurrency & Durable Execution', () => {
  let prisma: PrismaClient;
  let idempotencyRepo: PrismaIdempotencyRepository;
  let idempotencyEngine: IdempotencyEngine;
  let toolRegistry: ToolRegistry;
  let policyRegistry: PolicyRegistry;
  let policyEngine: PolicyEngine;
  let rateLimiter: RateLimiter;
  let redisService: RedisService;
  let toolGateway: ToolGateway;
  let workflowRepo: PrismaWorkflowRepository;

  // Track mock execution counts
  let captureAdapterExecutionCount = 0;
  let refundAdapterExecutionCount = 0;

  beforeEach(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    
    // Clean up - Removed to prevent cross-test isolation bugs
    // We now rely on unique keys generated for each test.

    // Initialize dependencies
    idempotencyRepo = new PrismaIdempotencyRepository(prisma);
    idempotencyEngine = new IdempotencyEngine(idempotencyRepo);
    
    toolRegistry = new ToolRegistry();
    policyRegistry = new PolicyRegistry();
    policyEngine = new PolicyEngine(policyRegistry);
    
    redisService = new RedisService({ host: 'localhost', port: 6380 }); // Port from docker-compose
    rateLimiter = new RateLimiter(redisService, {
      agentConfig: { capacity: 1000, refillRatePerSecond: 1000 },
      sessionConfig: { capacity: 1000, refillRatePerSecond: 1000, failClosed: true },
      globalConfig: { capacity: 10000, refillRatePerSecond: 10000 }
    });

    toolGateway = new ToolGateway({
      toolRegistry,
      policyEngine,
      idempotencyEngine,
      rateLimiter,
      rateLimitConfigMap: new Map([
        ['mock-capture-payment', { capacity: 1000, refillRatePerSecond: 1000 }],
        ['mock-refund-payment', { capacity: 1000, refillRatePerSecond: 1000 }],
        ['mock-crash-tool', { capacity: 1000, refillRatePerSecond: 1000 }]
      ]),
      eventEmitter: new EventEmitter()
    });

    workflowRepo = new PrismaWorkflowRepository();

    // Register a mock policy that always allows execution
    policyRegistry.register({
      metadata: {
        id: 'mock-allow-policy' as any,
        name: 'Mock Allow Policy',
        description: 'Always allows execution for tests',
        version: '1.0'
      },
      inputSchema: z.object({}),
      evaluate: async () => ({ decision: 'ALLOW' as any })
    } as any);

    // Reset counters
    captureAdapterExecutionCount = 0;
    refundAdapterExecutionCount = 0;

    // Register Mock Capture Tool
    toolRegistry.register({
      metadata: {
        id: 'mock-capture-payment' as any,
        name: 'Capture Payment',
        description: 'Captures a payment',
        version: '1.0'
      },
      idempotency: { required: true, scope: 'capture' },
      policy: { id: 'mock-allow-policy' },
      inputSchema: z.object({ paymentId: z.string() }),
      outputSchema: z.object({ success: z.boolean() }),
      adapter: {
        execute: async (input: { paymentId: string }) => {
          captureAdapterExecutionCount++;
          // Simulate network delay to allow concurrency to stack up
          await new Promise(resolve => setTimeout(resolve, 30));
          return { success: true };
        }
      }
    } as any);

    // Register Mock Refund Tool
    toolRegistry.register({
      metadata: {
        id: 'mock-refund-payment' as any,
        name: 'Refund Payment',
        description: 'Refunds a payment',
        version: '1.0'
      },
      idempotency: { required: true, scope: 'refund' },
      policy: { id: 'mock-allow-policy' },
      inputSchema: z.object({ paymentId: z.string(), amount: z.number() }),
      outputSchema: z.object({ success: z.boolean() }),
      adapter: {
        execute: async (input: { paymentId: string, amount: number }) => {
          refundAdapterExecutionCount++;
          await new Promise(resolve => setTimeout(resolve, 30));
          return { success: true };
        }
      }
    } as any);
  });

  afterEach(async () => {
    await redisService.disconnect();
    await prisma.$disconnect();
    vi.restoreAllMocks();
  });

  const baseContext = {
    agentId: 'agent-1',
    sessionId: 'session-1',
    executionId: 'exec-1'
  };

  it('1. Concurrent Same Operation: 100 requests exactly 1 execution', async () => {
    const paymentId = `payment_${randomUUID()}`;
    const idempotencyKey = `capture_${randomUUID()}`;

    const reqs = Array.from({ length: 100 }).map(() => 
      toolGateway.execute({
        toolId: 'mock-capture-payment',
        input: { paymentId },
        context: { ...baseContext, idempotencyKey }
      })
    );

    const results = await Promise.allSettled(reqs);

    // Exactly 1 adapter execution must have happened
    expect(captureAdapterExecutionCount).toBe(1);

    // Some might succeed from cache if they were queued late enough, some fail with IN_PROGRESS
    const successes = results.filter(r => r.status === 'fulfilled');
    const inProgressFailures = results.filter(
      r => r.status === 'rejected' && r.reason?.cause instanceof IdempotencyInProgressError
    );
    
    // Everything should either be a success or an in-progress failure
    expect(successes.length + inProgressFailures.length).toBe(100);
    expect(successes.length).toBeGreaterThanOrEqual(1); // At least the first one succeeds
  });

  it('2. Concurrent Independent Operations: 100 independent executions', async () => {
    const batchId = randomUUID();
    const reqs = Array.from({ length: 100 }).map((_, i) => 
      toolGateway.execute({
        toolId: 'mock-capture-payment',
        input: { paymentId: `payment_${batchId}_${i}` },
        context: { ...baseContext, idempotencyKey: `capture_${batchId}_${i}` }
      })
    );

    const results = await Promise.allSettled(reqs);

    // All 100 should execute independently because they have different idempotency keys
    expect(captureAdapterExecutionCount).toBe(100);
    
    const successes = results.filter(r => r.status === 'fulfilled');
    if (successes.length !== 100) {
      console.error('Failed independent operations reasons:', results.filter(r => r.status === 'rejected').map((r: any) => r.reason));
    }
    expect(successes.length).toBe(100);
  });

  it('3. Double Capture / Double Refund Semantic Equivalence', async () => {
    const paymentId = `payment_${randomUUID()}`;
    const captureKey = `capture_${randomUUID()}`;
    const refundKey = `refund_${randomUUID()}`;

    // First Capture
    await toolGateway.execute({
      toolId: 'mock-capture-payment',
      input: { paymentId },
      context: { ...baseContext, idempotencyKey: captureKey }
    });
    expect(captureAdapterExecutionCount).toBe(1);

    // Second Capture with same key
    const result2 = await toolGateway.execute({
      toolId: 'mock-capture-payment',
      input: { paymentId },
      context: { ...baseContext, idempotencyKey: captureKey }
    });
    // Execution count remains 1, returns cached result
    expect(captureAdapterExecutionCount).toBe(1);
    expect(result2.output).toEqual({ success: true });

    // First Refund
    await toolGateway.execute({
      toolId: 'mock-refund-payment',
      input: { paymentId, amount: 500 },
      context: { ...baseContext, idempotencyKey: refundKey }
    });
    expect(refundAdapterExecutionCount).toBe(1);

    // Second Refund with same key
    const refundResult2 = await toolGateway.execute({
      toolId: 'mock-refund-payment',
      input: { paymentId, amount: 500 },
      context: { ...baseContext, idempotencyKey: refundKey }
    });
    // Execution count remains 1, returns cached result
    expect(refundAdapterExecutionCount).toBe(1);
    expect(refundResult2.output).toEqual({ success: true });
  });

  it('4. Fingerprint Conflict', async () => {
    const paymentId = `payment_${randomUUID()}`;
    const refundKey = `refund_conflict_${randomUUID()}`;

    // Refund 500
    await toolGateway.execute({
      toolId: 'mock-refund-payment',
      input: { paymentId, amount: 500 },
      context: { ...baseContext, idempotencyKey: refundKey }
    });
    expect(refundAdapterExecutionCount).toBe(1);

    // Refund 700 with SAME key
    await expect(toolGateway.execute({
      toolId: 'mock-refund-payment',
      input: { paymentId, amount: 700 }, // Changed amount!
      context: { ...baseContext, idempotencyKey: refundKey }
    })).rejects.toThrowError(new RegExp(`Idempotency key ${refundKey} was reused`));

    // Still only 1 execution
    expect(refundAdapterExecutionCount).toBe(1);
  });

  it('5. Workflow Concurrency', async () => {
    const wfDef = createWorkflowDefinition({
      id: 'wf-financial' as WorkflowId,
      name: 'Financial Workflow',
      version: '1.0',
      inputSchema: z.object({}),
      initialState: 'START',
      states: ['START', 'COMPLETED'],
      events: ['PROCESS'],
      transitions: [{ from: 'START', event: 'PROCESS', to: 'COMPLETED' }]
    });

    const instanceId = randomUUID();
    const data = await workflowRepo.create({
      id: instanceId,
      workflowId: wfDef.id,
      currentState: wfDef.initialState,
      status: 'ACTIVE'
    });

    const machine1 = new WorkflowStateMachine(wfDef, workflowRepo, { ...data });
    const machine2 = new WorkflowStateMachine(wfDef, workflowRepo, { ...data });

    // Worker 1 transitions
    await machine1.transition('PROCESS');
    
    // Worker 2 attempts same transition from stale memory state
    await expect(machine2.transition('PROCESS')).rejects.toThrow(/Optimistic concurrency conflict/);
  });

  it('6. Crash Recovery (UNKNOWN state)', async () => {
    // We can simulate a crash by overriding the adapter to throw a generic Network error
    toolRegistry.register({
      metadata: {
        id: 'mock-crash-tool' as any,
        name: 'Crash Tool',
        description: 'Simulates a crash',
        version: '1.0'
      },
      idempotency: { required: true, scope: 'crash' },
      policy: { id: 'mock-allow-policy' },
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      adapter: {
        execute: async () => {
          captureAdapterExecutionCount++;
          throw new Error('Connection Reset (Lost Response)'); // Unretryable UNKNOWN error
        }
      }
    } as any);

    const idempotencyKey = `crash_key_${randomUUID()}`;
    
    // 1. Initial attempt executes but crashes
    await expect(toolGateway.execute({
      toolId: 'mock-crash-tool',
      input: {},
      context: { ...baseContext, idempotencyKey }
    })).rejects.toThrow('Connection Reset');

    expect(captureAdapterExecutionCount).toBe(1);

    // 2. The retry must explicitly block with UNKNOWN error, and NEVER invoke adapter again
    await expect(toolGateway.execute({
      toolId: 'mock-crash-tool',
      input: {},
      context: { ...baseContext, idempotencyKey }
    })).rejects.toThrowError(/UNKNOWN state/);

    // Adapter execution count MUST remain exactly 1!
    expect(captureAdapterExecutionCount).toBe(1);
  });

  it('7. Database Failure', async () => {
    // If Prisma is unavailable, it fails safely, no tool execution occurs
    vi.spyOn(prisma.idempotencyRecord, 'create').mockRejectedValueOnce(new Error('DB Connection Refused'));

    await expect(toolGateway.execute({
      toolId: 'mock-capture-payment',
      input: { paymentId: 'payment_123' },
      context: { ...baseContext, idempotencyKey: `db_fail_key_${randomUUID()}` }
    })).rejects.toThrow('DB Connection Refused');

    // Adapter MUST NOT execute if lock isn't acquired
    expect(captureAdapterExecutionCount).toBe(0);
  });

  it('8. Redis Failure', async () => {
    // To make sure Redis fails immediately without buffering, we can mock it
    vi.spyOn(rateLimiter, 'consume').mockRejectedValueOnce(new Error('Redis Connection Error'));

    // The Rate Limiter is configured with sessionConfig.failClosed: true
    // This should throw RateLimitInfrastructureError and NEVER hit the adapter
    await expect(toolGateway.execute({
      toolId: 'mock-capture-payment',
      input: { paymentId: 'payment_123' },
      context: { ...baseContext, idempotencyKey: `redis_fail_key_${randomUUID()}` }
    })).rejects.toThrowError(/Redis/);

    expect(captureAdapterExecutionCount).toBe(0);
  });
});
