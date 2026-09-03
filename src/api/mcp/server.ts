import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAndConfigureServer } from "./index.js";

export async function runMcpServer() {
  const server = createAndConfigureServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Agentic Commerce MCP Server running on Stdio");
}
