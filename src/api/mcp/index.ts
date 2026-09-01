import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Request, Response } from 'express';
import { searchProductsTool } from './tools/merchant-search-products.tool.js';
import { createRequestTool } from './tools/merchant-create-request.tool.js';
import { getOfferTool } from './tools/merchant-get-offer.tool.js';
import { counterOfferTool } from './tools/merchant-counter-offer.tool.js';
import { acceptOfferTool } from './tools/merchant-accept-offer.tool.js';
import { rejectOfferTool } from './tools/merchant-reject-offer.tool.js';
import { getOrderTool } from './tools/merchant-get-order.tool.js';
import { checkOpportunitiesTool } from './tools/merchant-check-opportunities.tool.js';
import { getMcpContext } from './context.js';

// Define a session map for isolated MCP server instances
const activeSessions = new Map<string, { transport: StreamableHTTPServerTransport, server: McpServer }>();
const sseTransports = new Map<string, SSEServerTransport>();

function createAndConfigureServer(): McpServer {
  const mcpServer = new McpServer({
    name: 'Agentic Commerce - Merchant Control Plane',
    version: '1.0.0'
  });

// Register all tools
mcpServer.tool(
  searchProductsTool.name,
  searchProductsTool.description,
  searchProductsTool.schema,
  searchProductsTool.handler as any
);

mcpServer.tool(
  createRequestTool.name,
  createRequestTool.description,
  createRequestTool.schema,
  createRequestTool.handler as any
);

mcpServer.tool(
  getOfferTool.name,
  getOfferTool.description,
  getOfferTool.schema,
  getOfferTool.handler as any
);

mcpServer.tool(
  counterOfferTool.name,
  counterOfferTool.description,
  counterOfferTool.schema,
  counterOfferTool.handler as any
);

mcpServer.tool(
  acceptOfferTool.name,
  acceptOfferTool.description,
  acceptOfferTool.schema,
  acceptOfferTool.handler as any
);

mcpServer.tool(
  rejectOfferTool.name,
  rejectOfferTool.description,
  rejectOfferTool.schema,
  rejectOfferTool.handler as any
);

  mcpServer.tool(
    getOrderTool.name,
    getOrderTool.description,
    getOrderTool.schema as any,
    getOrderTool.handler as any
  );

  mcpServer.tool(
    checkOpportunitiesTool.name,
    checkOpportunitiesTool.description,
    checkOpportunitiesTool.schema,
    checkOpportunitiesTool.handler as any
  );

  return mcpServer;
}

export async function handleMcpRequest(req: Request, res: Response) {
  try {
    const ctx = getMcpContext();
    const sessionId = ctx.sessionId;

    let session = activeSessions.get(sessionId);
    if (!session) {
      console.log(`[MCP] Initializing new session: ${sessionId}`);
      const server = createAndConfigureServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId
      });
      
      server.connect(transport).catch(console.error);
      session = { server, transport };
      activeSessions.set(sessionId, session);
    }

    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP Error' });
    }
  }
}

export async function handleMcpSse(req: Request, res: Response) {
  try {
    const ctx = getMcpContext();
    const sessionId = ctx.sessionId;
    
    console.log(`[MCP SSE] Initializing new SSE session: ${sessionId}`);
    const server = createAndConfigureServer();
    const transport = new SSEServerTransport('/mcp/message?sessionId=' + sessionId, res);
    
    sseTransports.set(sessionId, transport);
    await server.connect(transport);
    
    // Express handles the response stream closing
    req.on('close', () => {
      sseTransports.delete(sessionId);
    });
  } catch (error) {
    console.error('Error in MCP SSE:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Error' });
  }
}

export async function handleMcpMessage(req: Request, res: Response) {
  try {
    const sessionId = req.query.sessionId as string;
    const transport = sseTransports.get(sessionId);
    
    if (!transport) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await transport.handlePostMessage(req, res);
  } catch (error) {
    console.error('Error in MCP Message:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Error' });
  }
}
