import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  ToolGateway,
  ToolRegistry,
  RESTToolAdapter,
  MCPToolAdapter
} from '../../src/agent/tools';
import {
  PolicyEngine,
  PolicyRegistry,
  FinancialExecutionPolicy,
  PolicyAuthorizationError
} from '../../src/agent/policy';

describe('Financial Protection Gateway Tests', () => {
  let policyRegistry: PolicyRegistry;
  let policyEngine: PolicyEngine;
  let toolRegistry: ToolRegistry;
  let gateway: ToolGateway;
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };

  const baseContext = {
    executionId: 'exec-1',
    agentId: 'agent-1',
    sessionId: 'session-1'
  };

  beforeEach(() => {
    policyRegistry = new PolicyRegistry();
    policyEngine = new PolicyEngine(policyRegistry);
    toolRegistry = new ToolRegistry();
    eventEmitter = { emit: vi.fn() };
    gateway = new ToolGateway({
      toolRegistry,
      eventEmitter,
      policyEngine
    });

    const financialPolicy = new FinancialExecutionPolicy('sys.finance', 'Financial limits', {
      allowedCurrency: 'INR',
      maxAmountMinor: 10000
    });
    policyRegistry.register(financialPolicy);
  });

  it('should block REST execution and make 0 network calls when policy denies', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' })
    });
    global.fetch = fetchSpy;

    const restAdapter = new RESTToolAdapter(
      {
        baseUrl: 'https://api.example.com',
        path: '/pay',
        method: 'POST'
      },
      { validateUrl: true }
    );

    toolRegistry.register({
      metadata: { id: 'payment.rest' as any, name: 'Pay', description: 'Pay', version: '1.0' },
      inputSchema: z.object({ amountMinor: z.number(), currency: z.string() }),
      outputSchema: z.any(),
      adapter: restAdapter,
      policy: { id: 'sys.finance' }
    });

    await expect(gateway.execute({
      toolId: 'payment.rest',
      input: { amountMinor: 10001, currency: 'INR' },
      context: baseContext
    })).rejects.toThrowError(PolicyAuthorizationError);

    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('should block MCP execution and make 0 invocations when policy denies', async () => {
    const mockMcpClient = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"status":"success"}' }]
      })
    };

    const mcpAdapter = new MCPToolAdapter(mockMcpClient as any, 'mcp_pay_tool');

    toolRegistry.register({
      metadata: { id: 'payment.mcp' as any, name: 'Pay', description: 'Pay', version: '1.0' },
      inputSchema: z.object({ amountMinor: z.number(), currency: z.string() }),
      outputSchema: z.any(),
      adapter: mcpAdapter,
      policy: { id: 'sys.finance' }
    });

    await expect(gateway.execute({
      toolId: 'payment.mcp',
      input: { amountMinor: 5000, currency: 'USD' },
      context: baseContext
    })).rejects.toThrowError(PolicyAuthorizationError);

    expect(mockMcpClient.callTool).toHaveBeenCalledTimes(0);
  });
});
