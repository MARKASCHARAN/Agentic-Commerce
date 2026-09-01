import { AsyncLocalStorage } from 'async_hooks';

export interface MCPContext {
  merchantId: string;
  buyerId: string;
  sessionId: string;
  requestId: string;
}

export const mcpContextStorage = new AsyncLocalStorage<MCPContext>();

export function getMcpContext(): MCPContext {
  const context = mcpContextStorage.getStore();
  if (!context) {
    throw new Error('MCP Context is not initialized. Ensure request is wrapped in mcpContextStorage.');
  }
  return context;
}
