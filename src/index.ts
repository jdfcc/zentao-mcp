#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import ZentaoClient from './services/zentao-client.js';
import { registerProjectTools } from './tools/projects.js';
import { registerBugTools } from './tools/bugs.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerStoryTools } from './tools/stories.js';
import { registerMyTools } from './tools/my.js';
import { ZentaoConfig } from './types.js';
import { DEFAULT_TTL_SECONDS, DEFAULT_LIMIT } from './constants.js';

// Support both npm usage (the caller's working directory) and a local Codex
// registration that starts dist/index.js from an unrelated project directory.
loadEnv();
loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env'),
  override: false
});

const REQUIRED_ENV_VARS = ['ZENTAO_URL', 'ZENTAO_USERNAME', 'ZENTAO_PASSWORD'];

function validateConfig(): ZentaoConfig {
  const missing: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('');
    console.error('Please set the following environment variables:');
    for (const envVar of REQUIRED_ENV_VARS) {
      console.error(`  ${envVar}`);
    }
    console.error('');
    console.error('Example .env file:');
    console.error('ZENTAO_URL=https://your-zentao-domain.com');
    console.error('ZENTAO_USERNAME=your-username');
    console.error('ZENTAO_PASSWORD=your-password');
    console.error('ZENTAO_DEFAULT_PROJECT=1');
    console.error('TTL_SECONDS=3600');
    console.error('LOG_LEVEL=info');
    process.exit(1);
  }

  const zentaoUrl = process.env.ZENTAO_URL!.trim();
  const username = process.env.ZENTAO_USERNAME!.trim();
  const password = process.env.ZENTAO_PASSWORD!.trim();
  const defaultProject = process.env.ZENTAO_DEFAULT_PROJECT;
  const ttlSeconds = process.env.TTL_SECONDS ? parseInt(process.env.TTL_SECONDS) : DEFAULT_TTL_SECONDS;
  const logLevel = process.env.LOG_LEVEL || 'info';
  const apiMode = process.env.ZENTAO_API_MODE || 'auto';

  if (!['auto', 'rest', 'legacy'].includes(apiMode)) {
    console.error('ERROR: ZENTAO_API_MODE must be one of: auto, rest, legacy');
    process.exit(1);
  }

  if (!zentaoUrl) {
    console.error('ERROR: ZENTAO_URL cannot be empty');
    process.exit(1);
  }

  if (!username) {
    console.error('ERROR: ZENTAO_USERNAME cannot be empty');
    process.exit(1);
  }

  if (!password) {
    console.error('ERROR: ZENTAO_PASSWORD cannot be empty');
    process.exit(1);
  }

  return {
    zentaoUrl,
    username,
    password,
    defaultProject,
    ttlSeconds,
    logLevel,
    apiMode: apiMode as ZentaoConfig['apiMode']
  };
}

async function main() {
  const config = validateConfig();
  const zentaoClient = new ZentaoClient(config);

  const server = new McpServer(
    {
      name: 'zentao-mcp-server',
      version: '1.2.0'
    },
    {
      instructions: 'Use zentao_list_projects to discover project IDs before querying bugs when no project is known. All tools are read-only. Prefer markdown for user-facing answers and json when another tool or program will process the result.'
    }
  );

  registerProjectTools(server, zentaoClient);
  registerBugTools(server, zentaoClient, config.defaultProject);
  registerTaskTools(server, zentaoClient, config.defaultProject);
  registerStoryTools(server, zentaoClient, config.defaultProject);
  registerMyTools(server, zentaoClient);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[INFO] Zentao MCP Server started successfully`);
  console.error(`[INFO] Connected to: ${config.zentaoUrl}`);
  console.error(`[INFO] Using username: ${config.username}`);
  if (config.defaultProject) {
    console.error(`[INFO] Default project ID: ${config.defaultProject}`);
  }
  console.error(`[INFO] Token TTL: ${config.ttlSeconds} seconds`);
  console.error(`[INFO] Log level: ${config.logLevel}`);
  console.error(`[INFO] API mode: ${config.apiMode}`);
}

main().catch(error => {
  console.error(`[ERROR] Server failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
