import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { 
  MCPToolAdapter, 
  MCPToolAdapterError, 
  MCPConnectionError, 
  MCPInvocationError, 
  MCPProtocolError 
} from '../../src/agent/tools/adapters/mcp';

describe('MCPToolAdapter', () => {
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;
  let client: Client;
  let server: Server;

  beforeEach(async () => {
    // 1. Create linked transports
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // 2. Setup Server
    server = new Server({
      name: 'test-server',
      version: '1.0.0'
    }, {
      capabilities: { tools: {} }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [{
          name: 'test.echo',
          description: 'Echoes the message',
          inputSchema: {
            type: 'object',
            properties: { message: { type: 'string' } },
            required: ['message']
          }
        }]
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'test.echo') {
        const msg = (request.params.arguments as any).message;
        return {
          content: [
            { type: 'text', text: JSON.stringify({ message: msg + ' from MCP' }) }
          ]
        };
      }
      
      if (request.params.name === 'test.error') {
        throw new Error('Internal MCP Tool Failure');
      }

      if (request.params.name === 'test.bad-format') {
        return {
          content: [
            { type: 'text', text: 'Not JSON at all' }
          ]
        };
      }

      throw new Error(`Tool not found: ${request.params.name}`);
    });

    await server.connect(serverTransport);

    // 3. Setup Client
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: { tools: {} }
    });

    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  const baseContext = {
    executionId: 'exec-1',
    agentId: 'agent-1',
    sessionId: 'session-1'
  };

  it('should execute successfully and translate output', async () => {
    const adapter = new MCPToolAdapter<{ message: string }, { message: string }>({
      client,
      toolName: 'test.echo'
    });

    const result = await adapter.execute({ message: 'hello' }, baseContext);
    
    expect(result).toEqual({ message: 'hello from MCP' });
  });

  it('should propagate abort correctly before execution', async () => {
    const adapter = new MCPToolAdapter({ client, toolName: 'test.echo' });
    
    const controller = new AbortController();
    controller.abort(new Error('Pre-aborted'));

    await expect(adapter.execute({ message: 'x' }, { ...baseContext, abortSignal: controller.signal }))
      .rejects.toThrowError('Pre-aborted');
  });

  it('should wrap MCP tool internal failures as MCPInvocationError', async () => {
    const adapter = new MCPToolAdapter({ client, toolName: 'test.error' });

    try {
      await adapter.execute({}, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(MCPInvocationError);
      expect(e.message).toContain('[mcp adapter] MCP Tool Invocation Error for test.error: MCP error -32603: Internal MCP Tool Failure');
    }
  });

  it('should throw MCPProtocolError if response JSON parsing fails', async () => {
    const adapter = new MCPToolAdapter({ client, toolName: 'test.bad-format' });

    try {
      await adapter.execute({}, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(MCPProtocolError);
      expect(e.message).toContain('Failed to parse MCP tool output as JSON');
    }
  });

  it('should allow custom response transformers', async () => {
    const adapter = new MCPToolAdapter<{ message: string }, { customResult: boolean }>({
      client,
      toolName: 'test.echo',
      responseTransformer: (result) => {
        // We know test.echo returns a stringified JSON string in text format
        const text = (result.content[0] as any).text;
        const parsed = JSON.parse(text);
        return { customResult: parsed.message.includes('hello') };
      }
    });

    const result = await adapter.execute({ message: 'hello world' }, baseContext);
    expect(result).toEqual({ customResult: true });
  });

  it('should handle broken connections gracefully', async () => {
    const adapter = new MCPToolAdapter({ client, toolName: 'test.echo' });
    
    // Break the connection
    await clientTransport.close();

    try {
      await adapter.execute({ message: 'hello' }, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      // The SDK might throw different errors depending on implementation details 
      // but our adapter should catch it and wrap it in an invocation or connection error
      expect(e).toBeInstanceOf(MCPToolAdapterError);
    }
  });
});
