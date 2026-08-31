import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime';
import { ToolGateway } from '../../src/agent/tools/tool-gateway';
import { ToolRegistry } from '../../src/agent/tools/tool-registry';
import { ApprovalRepository } from '../../src/database/repositories/approval.repository';
import { ApprovalEngine } from '../../src/agent/approval/approval-engine';
import { PolicyEngine } from '../../src/agent/policy/policy-engine';
import { PolicyRegistry } from '../../src/agent/policy/policy-registry';
import { FinancialExecutionPolicy } from '../../src/agent/policy/financial-policy';
import { IdempotencyEngine } from '../../src/agent/idempotency/engine';
import { PrismaIdempotencyRepository } from '../../src/database/repositories/idempotency.repository';
import { MerchantGuardrailRepository } from '../../src/database/repositories/merchant-guardrail.repository';
import { z } from 'zod';
import { ExecutionIdentity } from '../../src/agent/runtime/types';
import uiRouter, { uiToolRegistry } from '../../src/api/internal/routes/ui.routes.js';

describe('Phase 5: Human-in-the-loop Approval', () => {
  let prisma: PrismaClient;
  let approvalRepo: ApprovalRepository;
  let approvalEngine: ApprovalEngine;
  let toolGateway: ToolGateway;
  let agentRuntime: AgentRuntime;

  const merchantId = 'merchant-approval-test';
  const userId = 'user-approval-test';
  const sessionId = 'session-approval-test';

  beforeAll(async () => {
    prisma = new PrismaClient();
    
    // Clean up
    await prisma.approval.deleteMany({ where: { entity_type: 'TOOL_EXECUTION' } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    await prisma.user.create({ data: { id: userId, email: 'appr@test.com' } });
    await prisma.merchant.create({ data: { id: merchantId, userId, name: 'Approval Merchant' } });
    await prisma.session.create({ data: { id: sessionId, merchantId } });

    // Guardrail requires approval > 50000
    await prisma.merchantGuardrail.create({
      data: {
        merchantId,
        currency: 'INR',
        autonomousPaymentLimitMinor: 100000,
        approvalAboveMinor: 50000,
      }
    });

    await prisma.merchantCapability.create({
      data: {
        merchantId,
        capability: 'checkout.create.test'
      }
    });

    approvalRepo = new ApprovalRepository(prisma);
    approvalEngine = new ApprovalEngine(approvalRepo);
    const guardrailRepo = new MerchantGuardrailRepository(prisma);
    
    const policyRegistry = new PolicyRegistry();
    policyRegistry.register(new FinancialExecutionPolicy('fin-policy', 'Financial', {
      allowedCurrency: 'INR',
      maxAmountMinor: 1000000
    }));
    
    const policyEngine = new PolicyEngine(policyRegistry);
    const toolRegistry = new ToolRegistry();
    
    // Fake checkout tool
    const fakeTool = {
      metadata: { id: 'checkout.create.test' as any, name: 'Checkout Test', description: 'desc', version: '1.0' },
      inputSchema: z.object({ amountMinor: z.number(), currency: z.string() }),
      outputSchema: z.any(),
      policy: { id: 'fin-policy' },
      adapter: {
        execute: async (input: any) => ({ success: true, amount: input.amountMinor })
      }
    };
    toolRegistry.register(fakeTool);
    uiToolRegistry.register(fakeTool);

    const idempotencyRepo = new PrismaIdempotencyRepository(prisma);
    const idempotencyEngine = new IdempotencyEngine(idempotencyRepo);

    toolGateway = new ToolGateway({
      toolRegistry,
      policyEngine,
      idempotencyEngine,
      guardrailRepository: guardrailRepo,
      approvalRepository: approvalRepo,
      eventEmitter: { emit: () => {} }
    });

    // We don't need full AgentRuntime for this, we can just test ToolGateway directly
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { sessionId } });
    await prisma.approval.deleteMany({ where: { entity_type: 'TOOL_EXECUTION' } });
    await prisma.merchantGuardrail.deleteMany({ where: { merchantId } });
    await prisma.merchantCapability.deleteMany({ where: { merchantId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('1. Rejects execution if amount exceeds approval threshold and no approval exists', async () => {
    const executionId = 'exec-high-value';
    const idempotencyKey = `${executionId}_tc1`;

    await expect(toolGateway.execute({
      toolId: 'checkout.create.test',
      input: { amountMinor: 85000, currency: 'INR' },
      context: { merchantId, executionId, sessionId, agentId: 'agent', idempotencyKey }
    })).rejects.toThrow('Amount exceeds merchant approval threshold of 50000');
  });

  it('2. API route /approvals/:token/approve executes tool call directly', async () => {
    const executionId = 'exec-high-value-2';
    const idempotencyKey = `${executionId}_tc1`;

    // AgentRuntime catches the error and creates this (simulated here)
    const payload = {
      toolName: 'checkout.create.test',
      input: { amountMinor: 85000, currency: 'INR' },
      context: { merchantId, executionId, sessionId, agentId: 'agent', idempotencyKey }
    };
    const approval = await approvalEngine.requireApproval(merchantId, 'TOOL_EXECUTION', idempotencyKey, payload);
    
    // Test the API route directly
    const req = {
      params: { token: approval.token },
      body: {}
    } as any;

    let resData: any = null;
    const res = {
      status: (code: number) => ({
        json: (data: any) => { resData = { code, data }; }
      }),
      json: (data: any) => { resData = { code: 200, data }; }
    } as any;

    const approveRoute = uiRouter.stack.find((l: any) => l.route && l.route.path === '/approvals/:token/approve');
    expect(approveRoute).toBeDefined();

    await approveRoute!.route.stack[0].handle(req, res);

    if (resData.code !== 200) {
      console.error(resData);
    }

    expect(resData).not.toBeNull();
    expect(resData.code).toBe(200);
    expect(resData.data.success).toBe(true);
    expect(resData.data.output.success).toBe(true);
    expect(resData.data.output.amount).toBe(85000);

    // Verify DB updated
    const updatedApproval = await approvalRepo.getById(approval.id);
    expect(updatedApproval?.status).toBe('APPROVED');
  });

  it('3. Rejects approval if Cart state has changed since creation', async () => {
    const executionId = 'exec-high-value-3';
    const idempotencyKey = `${executionId}_tc1`;

    const payload = {
      toolName: 'checkout.create.test',
      input: { amountMinor: 85000, currency: 'INR' },
      cartStateHash: 'fake-hash-123', // Doesn't match actual empty cart
      context: { merchantId, executionId, sessionId, agentId: 'agent', idempotencyKey }
    };
    const approval = await approvalEngine.requireApproval(merchantId, 'TOOL_EXECUTION', idempotencyKey, payload);

    const req = {
      params: { token: approval.token },
      body: {}
    } as any;

    let resData: any = null;
    const res = {
      status: (code: number) => ({
        json: (data: any) => { resData = { code, data }; }
      }),
      json: (data: any) => { resData = { code: 200, data }; }
    } as any;

    const approveRoute = uiRouter.stack.find((l: any) => l.route && l.route.path === '/approvals/:token/approve');
    await approveRoute!.route.stack[0].handle(req, res);

    expect(resData).not.toBeNull();
    expect(resData.code).toBe(409);
    expect(resData.data.error).toContain('State Mismatch');

    // DB should remain PENDING
    const updatedApproval = await approvalRepo.getById(approval.id);
    expect(updatedApproval?.status).toBe('PENDING');
  });
});
