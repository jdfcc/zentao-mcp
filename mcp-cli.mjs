#!/usr/bin/env node
/**
 * mcp-cli.mjs —— 极简「原生 MCP」stdio 客户端
 *
 * 背景：当宿主（Codex / Claude / 本 Agent）无法注册 MCP server 时，
 *       由本脚本自己充当 MCP Host，直接与 zentao-mcp 交换 JSON-RPC 2.0 报文。
 *       不依赖 @modelcontextprotocol/sdk，报文格式完全手写，便于观察协议细节。
 *
 * 用法：
 *   node mcp-cli.mjs list                              # 列出全部工具
 *   node mcp-cli.mjs describe zentao_list_bugs         # 看某个工具的完整 schema
 *   node mcp-cli.mjs call zentao_list_projects '{}'    # 调用工具
 *   node mcp-cli.mjs ping                              # 探活
 *   node mcp-cli.mjs raw '{"method":"resources/list"}' # 发任意 JSON-RPC
 *
 * 调试：MCP_DEBUG=1 打印握手结果；MCP_TIMEOUT_MS 调整超时（默认 60s）。
 * 注意：需先 npm run build，且项目根目录存在 .env。
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('./dist/index.js', import.meta.url));
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PROTOCOL_VERSION = '2024-11-05';
const TIMEOUT_MS = Number(process.env.MCP_TIMEOUT_MS ?? 60_000);

// ── 1. 以子进程方式拉起 MCP server（stdio 传输：stdin 下发，stdout 回收）──
const child = spawn(process.execPath, [SERVER], {
  cwd: ROOT,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, LOG_LEVEL: process.env.LOG_LEVEL ?? 'error' }
});

let stderrBuf = '';
child.stderr.on('data', chunk => { stderrBuf += chunk.toString(); });
child.on('error', err => {
  console.error('无法启动 MCP server 子进程:', err.message);
  process.exit(1);
});

// ── 2. 解帧：MCP stdio = 每行一个 JSON-RPC 报文（换行分隔，非 LSP 的 Content-Length）──
const pending = new Map();
let nextId = 1;

createInterface({ input: child.stdout }).on('line', line => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try { msg = JSON.parse(text); } catch { return; } // 非 JSON 噪声直接忽略

  if (msg.id != null && pending.has(msg.id)) {
    const entry = pending.get(msg.id);
    clearTimeout(entry.timer);
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
    else entry.resolve(msg.result);
  }
  // server → client 的通知（notifications/*）此处忽略
});

function send(method, params, { notify = false } = {}) {
  const frame = { jsonrpc: '2.0', method };
  if (params !== undefined) frame.params = params;
  if (!notify) frame.id = nextId++;

  child.stdin.write(JSON.stringify(frame) + '\n');
  if (notify) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(frame.id);
      reject(new Error(`超时 ${TIMEOUT_MS}ms: ${method}`));
    }, TIMEOUT_MS);
    pending.set(frame.id, { resolve, reject, timer });
  });
}

// ── 3. 握手：initialize → notifications/initialized ──
async function handshake() {
  const init = await send('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'mcp-cli', version: '1.0.0' }
  });
  await send('notifications/initialized', undefined, { notify: true });
  return init;
}

function textOf(result) {
  return (result?.content ?? [])
    .map(block => (block.type === 'text' ? block.text : JSON.stringify(block)))
    .join('\n');
}

// ── 4. 子命令 ──
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const init = await handshake();

  if (process.env.MCP_DEBUG) {
    console.error('[handshake] ' + JSON.stringify(init, null, 2));
  }

  switch (cmd) {
    case 'ping': {
      console.log(JSON.stringify(await send('ping', undefined), null, 2));
      break;
    }

    case 'list': {
      const { tools } = await send('tools/list', {});
      console.log(`${tools.length} 个工具 | server=${init.serverInfo?.name} v${init.serverInfo?.version} | 协议=${init.protocolVersion}\n`);
      for (const t of tools) {
        const required = t.inputSchema?.required ?? [];
        console.log(`● ${t.name}`);
        console.log(`  ${(t.description ?? '').split('\n')[0]}`);
        console.log(`  必填参数: ${required.length ? required.join(', ') : '(无)'} | 只读: ${t.annotations?.readOnlyHint} | outputSchema: ${t.outputSchema ? '有' : '无'}`);
        console.log('');
      }
      break;
    }

    case 'describe': {
      const { tools } = await send('tools/list', {});
      const tool = tools.find(x => x.name === rest[0]);
      if (!tool) {
        throw new Error(`未找到工具: ${rest[0]}（可用: ${tools.map(t => t.name).join(', ')}）`);
      }
      console.log(JSON.stringify(tool, null, 2));
      break;
    }

    case 'call': {
      // 开关:默认两份都出(向后兼容)；--content-only / --json 只出一份，显著省上下文。
      const flags = new Set(rest.filter(a => a.startsWith('--')));
      const positional = rest.filter(a => !a.startsWith('--'));
      const name = positional[0];
      if (!name) throw new Error(`用法: node mcp-cli.mjs call <toolName> '{"k":"v"}' [--content-only|--json]`);
      const args = positional[1] ? JSON.parse(positional[1]) : {};
      const res = await send('tools/call', { name, arguments: args });
      if (res.isError) console.error('[isError=true]');

      const onlyContent = flags.has('--content-only');
      const onlyJson = flags.has('--json');

      // isError 时错误正文在 content 里；--json 也必须打印，否则失败会静默（只剩 isError=true）
      if (!onlyJson || res.isError) console.log(textOf(res));
      if (!onlyContent) {
        if (res.structuredContent) {
          if (!onlyJson) console.log('\n--- structuredContent ---');
          // --json 用紧凑序列化（无缩进），比 pretty 再省一截
          console.log(JSON.stringify(res.structuredContent, null, onlyJson ? 0 : 2));
        } else if (onlyJson) {
          console.error('(该工具未返回 structuredContent)');
        }
      }
      break;
    }

    case 'raw': {
      const frame = JSON.parse(rest[0]);
      console.log(JSON.stringify(await send(frame.method, frame.params), null, 2));
      break;
    }

    default:
      console.log('用法: node mcp-cli.mjs <list | describe <tool> | call <tool> [jsonArgs] | ping | raw <json>>');
  }
}

main()
  .then(() => { child.kill(); })
  .catch(err => {
    console.error('FAILED: ' + err.message);
    if (stderrBuf.trim()) console.error('--- server stderr ---\n' + stderrBuf.trim());
    child.kill();
    process.exitCode = 1;
  });
