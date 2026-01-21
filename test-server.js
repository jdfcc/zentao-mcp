#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'test-zentao-mcp-server',
  version: '1.0.0'
});

server.registerTool(
  'test_tool',
  {
    title: 'Test Tool',
    description: 'A simple test tool',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  },
  async (args) => {
    return {
      content: [{
        type: 'text',
        text: `Test received: ${JSON.stringify(args)}`
      }]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test MCP Server started');
}

main().catch(error => {
  console.error('Test server error:', error);
  process.exit(1);
});
