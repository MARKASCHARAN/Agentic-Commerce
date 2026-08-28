import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CommerceProtocolHandler, CommerceProtocolConflictError } from '../../src/agent/commerce/protocol-handler';
import { CommerceMessageRepository } from '../../src/database/repositories/commerce-message.repository';
import { MerchantCapabilityResolver } from '../../src/agent/intelligence/capability-resolver';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { IdempotencyEngine } from '../../src/agent/idempotency/engine';
import { RateLimiter } from '../../src/agent/rate-limiting/rate-limiter';
import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { RedisService } from '../../src/database/redis';
import { WorkflowStateMachine } from '../../src/agent/workflows/workflow-state-machine';
import { CommerceProtocolWorkflow, CommerceProtocolState, CommerceProtocolEvent } from '../../src/agent/commerce/commerce-workflow';
import { CommerceProtocolValidationError } from '../../src/agent/commerce/validator';
import crypto from 'crypto';

import { z } from 'zod';

describe.sequential('Phase 21: Commerce Protocol Integration', () => {
  let prisma: PrismaClient;
  let redis: RedisService;
  let messageRepo: CommerceMessageRepository;
  let capabilityResolver: MerchantCapabilityResolver;
  let toolGateway: ToolGateway;
  let handler: CommerceProtocolHandler;

  beforeAll(async () => {
    prisma = new PrismaClient();
    redis = new RedisService({ url: 'redis://localhost:6380' });
    await redis.connect();

    messageRepo = new CommerceMessageRepository(prisma);
    capabilityResolver = new MerchantCapabilityResolver();
    
    const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
    const idempotencyEngine = new IdempotencyEngine(idempotencyRepo);
    const rateLimiter = new RateLimiter(redis, { global: { max: 100, windowMs: 1000 } });
    const policyEngine = new PolicyEngine(prisma);
    const toolRegistry = new ToolRegistry();
    
    // Add mock payment tool
    toolRegistry.register({
      metadata: {
        id: 'capture_payment' as any,
        name: 'Capture Payment',
        description: 'Captures payment',
        version: '1.0',
        author: 'test',
        capabilities: []
      },
      inputSchema: z.any() as any,
      outputSchema: z.any() as any,
      policy: { id: 'test_policy' } as any,
      idempotency: { required: true, scope: 'payment' },
      adapter: {
        execute: async () => ({ status: 'success', id: 'pay_123' })
      }
    });

    // Mock policy evaluation to always allow
    policyEngine.evaluate = async () => ({ result: 'ALLOW' });

    toolGateway = new ToolGateway({
      toolRegistry,
      policyEngine,
      idempotencyEngine,
      rateLimiter,
      eventEmitter: { emit: () => {} }
    });
    handler = new CommerceProtocolHandler(messageRepo, capabilityResolver, toolGateway);

    // Clean DB
    await prisma.commerceMessage.deleteMany({});
  });

  afterAll(async () => {
    await redis.disconnect();
    await prisma.$disconnect();
  });

  const createBaseMessage = (type: string, data: any, recipient = 'merchant-b2b') => ({
    protocolVersion: '1.0',
    messageId: crypto.randomUUID(),
    sessionId: 'session-123',
    sender: 'buyer-agent',
    recipient,
    timestamp: new Date().toISOString(),
    correlationId: 'corr-123',
    payload: {
      type,
      data
    }
  });

  it('1. valid DISCOVER', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('DISCOVER', { query: 'shoes' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('INITIATED');
  });

  it('2. valid QUOTE_REQUEST', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('QUOTE_REQUEST', { items: [{ resourceId: 'prod-1', quantity: 2 }] });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('QUOTE_REQUESTED');
  });

  it('3. valid QUOTE', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    await machine.transition('QUOTE_REQUEST');
    const msg = createBaseMessage('QUOTE', { quoteId: 'q-1', items: [{ resourceId: 'prod-1', quantity: 2, unitPriceMinor: 500 }], currency: 'USD' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('QUOTED');
  });

  it('4. valid OFFER', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    await machine.transition('QUOTE_REQUEST');
    await machine.transition('QUOTE');
    const msg = createBaseMessage('OFFER', { offerId: 'o-1', items: [{ resourceId: 'prod-1', quantity: 2, unitPriceMinor: 500 }], currency: 'USD', expiresAt: new Date(Date.now() + 10000).toISOString() });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('OFFERED');
  });

  it('5. COUNTER_OFFER', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    await machine.transition('OFFER');
    const msg = createBaseMessage('COUNTER_OFFER', { referenceOfferId: 'o-1', items: [{ resourceId: 'prod-1', quantity: 2, proposedPriceMinor: 400 }] });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('NEGOTIATING');
  });

  it('6. ACCEPT', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    await machine.transition('OFFER');
    const msg = createBaseMessage('ACCEPT', { referenceId: 'o-1' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('ACCEPTED');
  });

  it('7. REJECT', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    await machine.transition('OFFER');
    const msg = createBaseMessage('REJECT', { referenceId: 'o-1' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('REJECTED');
  });

  it('8. ORDER_CREATE', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    await machine.transition('OFFER');
    await machine.transition('ACCEPT');
    const msg = createBaseMessage('ORDER_CREATE', { referenceId: 'o-1' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('ORDER_CREATED');
  });

  it('9. PAYMENT_REQUEST cannot bypass ToolGateway (delegates to ToolGateway)', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    machine['_currentState'] = 'ORDER_CREATED'; // force state for test
    const msg = createBaseMessage('PAYMENT_REQUEST', { orderId: 'ord-1' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(res.result.output.status).toBe('success'); // From mock tool
    expect(machine.getCurrentState()).toBe('PAYMENT_PENDING');
  });

  it('10. PAYMENT_RESULT', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    machine['_currentState'] = 'PAYMENT_PENDING';
    const msg = createBaseMessage('PAYMENT_RESULT', { orderId: 'ord-1', paymentId: 'pay-1', status: 'SUCCESS', amountMinor: 1000, currency: 'USD' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('COMPLETED');
  });

  it('11. CANCEL', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('CANCEL', { referenceId: '123' });
    const res = await handler.handleMessage(msg, machine);
    expect(res.status).toBe('SUCCESS');
    expect(machine.getCurrentState()).toBe('CANCELLED');
  });

  it('12. invalid Zod payload', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('DISCOVER', { query: 123 }); // Query should be string
    await expect(handler.handleMessage(msg, machine)).rejects.toThrow();
  });

  it('13. invalid protocol version', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('DISCOVER', { query: 'test' });
    msg.protocolVersion = '2.0';
    await expect(handler.handleMessage(msg, machine)).rejects.toThrow(/Unsupported protocol version/);
  });

  it('14. expired message', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('DISCOVER', { query: 'test' });
    msg.expiresAt = new Date(Date.now() - 10000).toISOString(); // Expired
    await expect(handler.handleMessage(msg, machine)).rejects.toThrow(/Expired/);
  });

  it('15. invalid timestamp', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('DISCOVER', { query: 'test' });
    msg.timestamp = 'invalid-date';
    await expect(handler.handleMessage(msg, machine)).rejects.toThrow(/Invalid ISO datetime/);
  });

  it('17. missing capability', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    // SAAS merchant lacks 'quote.create' based on capability resolver (only has subscriptions, usage, pricing, payment, order)
    const msg = createBaseMessage('QUOTE', { quoteId: 'q-1', items: [], currency: 'USD' }, 'merchant-saas');
    await expect(handler.handleMessage(msg, machine)).rejects.toThrow(/Missing capability 'quote.create'/);
  });

  it('18. invalid workflow transition', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('ACCEPT', { referenceId: 'o-1' });
    // Try to accept from INITIATED
    await expect(handler.handleMessage(msg, machine)).rejects.toThrow(/Invalid transition for workflow/);
  });

  it('20. same messageId + same payload replay', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('DISCOVER', { query: 'test' });
    await handler.handleMessage(msg, machine);
    const res = await handler.handleMessage(msg, machine); // Replay
    expect(res.status).toBe('IGNORED'); // Handles safely
  });

  it('21. same messageId + different payload conflict', async () => {
    const machine = new WorkflowStateMachine(CommerceProtocolWorkflow);
    const msg = createBaseMessage('DISCOVER', { query: 'test' });
    await handler.handleMessage(msg, machine);
    msg.payload.data.query = 'changed'; // Same ID, changed payload
    await expect(handler.handleMessage(msg, machine)).rejects.toThrow(CommerceProtocolConflictError);
  });
});
