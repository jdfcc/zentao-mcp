/**
 * test-mcp-launch.mjs —— 验证「MCP 宿主（Codex / Claude Desktop 等）直接拉起 dist/index.js」这条路。
 *
 * 与其它测试的分工：
 *   - test:codex   从仓库根目录启动，验证工具契约
 *   - test:e2e     通过 mcp-cli.mjs 调，验证装好之后的 skill 路径
 *   - 本脚本       从**任意 cwd** 直接拉起 dist/index.js，验证配置解析不依赖工作目录
 *
 * 为什么单独测这个：codex 的 config.toml 只声明 `command` + `args`，不设 cwd——
 * 进程会继承宿主的当前目录。而 .env 是靠 `dist/../.env` 这条相对路径找到的，
 * 一旦这段逻辑被改坏，表现是「在仓库里能用、一进别的项目就报缺环境变量」，
 * 极难定位。这里从几个互不相关的目录各跑一遍，把这个失败模式钉死。
 *
 * 用法：node test-mcp-launch.mjs [cwd...]
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ENTRY = join(dirname(fileURLToPath(import.meta.url)), 'dist', 'index.js');
if (!existsSync(ENTRY)) {
  console.error(`找不到 ${ENTRY}，请先 npm run build`);
  process.exit(1);
}

const CWD_LIST = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [process.env.TEMP || '/tmp', process.env.USERPROFILE || '/', dirname(ENTRY)];

let failures = 0;
for (const CWD of CWD_LIST) {
  if (!(await probe(CWD))) failures++;
}

if (failures) {
  console.error(`\n${failures}/${CWD_LIST.length} 个目录失败`);
  process.exit(1);
}
console.log(`\n全部 ${CWD_LIST.length} 个目录通过`);
process.exit(0);

function probe(CWD) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [ENTRY], { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '', err = '';
    child.stdout.on('data', d => { buf += d; });
    child.stderr.on('data', d => { err += d; });

    const send = o => child.stdin.write(JSON.stringify(o) + '\n');
    const timers = [
      setTimeout(() => send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'launch-test', version: '1' } } }), 300),
      setTimeout(() => send({ jsonrpc: '2.0', method: 'notifications/initialized' }), 900),
      setTimeout(() => send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }), 1400),
      setTimeout(() => send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'zentao_list_projects', arguments: { limit: 1 } } }), 3000)
    ];

    setTimeout(() => {
      timers.forEach(clearTimeout);
      let toolCount = 0, callLine = null, callError = null;
      for (const l of buf.split('\n')) {
        let j; try { j = JSON.parse(l); } catch { continue; }
        if (j.id === 2) toolCount = j.result?.tools?.length || 0;
        if (j.id === 3) {
          if (j.result?.isError) callError = (j.result.content?.[0]?.text || '').slice(0, 160);
          else callLine = (j.result?.content?.[0]?.text || '').split('\n').filter(Boolean)[0];
        }
      }
      const ok = toolCount > 0 && callLine !== null;
      console.log(`\n${ok ? '  ✓' : '  ✗'} cwd = ${CWD}`);
      console.log(`      tools/list -> ${toolCount} 个工具`);
      if (callLine) console.log(`      tools/call -> ${callLine}`);
      if (callError) console.log(`      tools/call 失败: ${callError}`);
      if (!ok && err.trim()) console.log('      server stderr:\n        ' + err.trim().split('\n').slice(0, 6).join('\n        '));
      child.kill();
      resolve(ok);
    }, 15000);
  });
}
