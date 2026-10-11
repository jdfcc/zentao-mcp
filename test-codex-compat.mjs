#!/usr/bin/env node

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverEntry = fileURLToPath(new URL('./dist/index.js', import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  env: {
    ...process.env,
    ZENTAO_URL: 'https://zentao.invalid',
    ZENTAO_USERNAME: 'codex-smoke-test',
    ZENTAO_PASSWORD: 'not-a-real-password',
    LOG_LEVEL: 'error'
  },
  stderr: 'pipe'
});

const client = new Client({ name: 'codex-compat-smoke-test', version: '1.0.0' });

try {
  await client.connect(transport);

  assert.match(client.getInstructions() ?? '', /read-only/i);

  const { tools } = await client.listTools();
  const expectedTools = [
    'zentao_get_bug_details',
    'zentao_list_bugs',
    'zentao_list_my_bugs',
    'zentao_list_my_stories',
    'zentao_list_my_tasks',
    'zentao_list_projects',
    'zentao_list_stories',
    'zentao_list_tasks'
  ];

  assert.deepEqual(tools.map(tool => tool.name).sort(), expectedTools);

  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object', `${tool.name} must expose an object input schema`);
    assert.equal(tool.outputSchema?.type, 'object', `${tool.name} must expose an object output schema`);
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be marked read-only`);
    assert.equal(tool.annotations?.destructiveHint, false, `${tool.name} must be marked non-destructive`);
  }

  const listProjects = tools.find(tool => tool.name === 'zentao_list_projects');
  assert.ok(listProjects?.inputSchema.properties?.response_format);

  const missingProject = await client.callTool({
    name: 'zentao_list_bugs',
    arguments: {}
  });
  assert.equal('isError' in missingProject && missingProject.isError, true);

  console.log(`Codex compatibility smoke test passed (${tools.length} tools discovered).`);
} finally {
  await client.close();
}
