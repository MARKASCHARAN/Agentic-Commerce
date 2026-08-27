import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface MCPToolAdapterOptions {
  client: Client;
  toolName: string;
}
