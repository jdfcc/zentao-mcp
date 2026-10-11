#!/usr/bin/env node
/**
 * test-e2e.mjs —— 全量端到端测试：对**已安装的 skill** 跑一遍所有禅道工具。
 *
 * 与 test-live-zentao.mjs 的分工：
 *   - test-live-zentao.mjs 直接 import ZentaoClient，验证「代码逻辑」
 *   - 本脚本通过 mcp-cli.mjs 以**原生 MCP 协议**调用，验证「用户实际走的那条路径」：
 *     stdio 握手 → schema 校验 → 真实 HTTP 请求 → markdown/JSON 渲染
 *     并且从与安装目录无关的 cwd 启动，同时验证「装在哪都能用」。
 *
 * 用法：
 *   node test-e2e.mjs                                    # 默认测用户级已安装 skill
 *   ZENTAO_CLI=D:\some\mcp-cli.mjs node test-e2e.mjs      # 指定其它安装位置
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = process.env.ZENTAO_CLI
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'zentao', 'mcp-cli.mjs');

// 故意用一个与安装目录、与仓库都无关的 cwd，验证解耦
const WORK_DIR = tmpdir();

if (!existsSync(CLI)) {
  console.error(`找不到 mcp-cli.mjs: ${CLI}\n请先安装，或用 ZENTAO_CLI 指定路径。`);
  process.exit(1);
}

// ───────────────────────── 调用封装 ─────────────────────────
function invoke(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: WORK_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

/** 调工具并解析结构化输出 */
async function call(tool, params = {}) {
  const r = await invoke(['call', tool, JSON.stringify(params), '--json']);
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* 出错时 stdout 是文本 */ }
  const failed = r.code !== 0 || /isError=true/.test(r.stderr) || /^Error:/m.test(r.stdout) || json === null;
  return { ...r, json, failed };
}

// ───────────────────────── 断言与用例 ─────────────────────────
class AssertionError extends Error {}
const fail = m => { throw new AssertionError(m); };
const ok = (cond, m) => { if (!cond) fail(m); };

const results = [];
async function test(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '', ms: Date.now() - started });
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}\n`);
  } catch (e) {
    const msg = e instanceof AssertionError ? e.message : `${e.constructor.name}: ${e.message}`;
    results.push({ name, ok: false, detail: msg, ms: Date.now() - started });
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}\n      \x1b[31m${msg}\x1b[0m\n`);
  }
}

const section = t => process.stdout.write(`\n\x1b[1m${t}\x1b[0m\n`);

console.log(`\n\x1b[1m禅道 MCP 全量端到端测试\x1b[0m`);
console.log(`  CLI      : ${CLI}`);
console.log(`  工作目录 : ${WORK_DIR}  \x1b[90m(与安装目录无关)\x1b[0m`);

// ═══════════════ A. 握手与工具清单 ═══════════════
section('A. MCP 握手与工具清单');

let TOOLS = [];
await test('initialize 握手 + tools/list 返回全部 8 个工具', async () => {
  const r = await invoke(['list']);
  ok(r.code === 0, `退出码 ${r.code}`);
  const list = [...new Set((r.stdout.match(/zentao_[a-z_]+/g) || []))].sort();
  TOOLS = list;
  const expected = [
    'zentao_get_bug_details', 'zentao_list_bugs', 'zentao_list_my_bugs',
    'zentao_list_my_stories', 'zentao_list_my_tasks', 'zentao_list_projects',
    'zentao_list_stories', 'zentao_list_tasks'
  ];
  ok(JSON.stringify(list) === JSON.stringify(expected),
    `期望 ${expected.length} 个工具，实际 ${list.length} 个: ${list.join(', ')}`);
  return `${list.length} 个`;
});

// ═══════════════ B. 项目 ═══════════════
section('B. zentao_list_projects');

await test('默认查询返回项目列表且字段完整', async () => {
  const r = await call('zentao_list_projects', { limit: 20 });
  ok(!r.failed, `调用失败: ${r.stdout.slice(0, 160)}`);
  const d = r.json;
  ok(Array.isArray(d.projects) && d.projects.length > 0, 'projects 为空');
  for (const p of d.projects) {
    ok(p.id !== undefined && p.id !== '', `项目缺 id: ${JSON.stringify(p)}`);
    ok(typeof p.name === 'string' && p.name.length > 0, `项目 ${p.id} 缺 name`);
  }
  return `${d.projects.length} 个项目`;
});

await test('limit 生效（分页元数据自洽）', async () => {
  const r = await call('zentao_list_projects', { limit: 2 });
  ok(!r.failed, '调用失败');
  ok(r.json.projects.length <= 2, `limit=2 却返回 ${r.json.projects.length} 条`);
  ok(r.json.count === r.json.projects.length, 'count 与数组长度不一致');
  return `count=${r.json.count}`;
});

await test('status=closed 过滤生效', async () => {
  const r = await call('zentao_list_projects', { status: 'closed', limit: 20 });
  ok(!r.failed, '调用失败');
  const bad = r.json.projects.filter(p => p.status !== 'closed');
  ok(bad.length === 0, `返回了非 closed 项目: ${bad.map(p => `${p.id}/${p.status}`).join(', ')}`);
  return `${r.json.projects.length} 个 closed`;
});

// ═══════════════ C. Bug ═══════════════
section('C. zentao_list_bugs / zentao_get_bug_details');

await test('按项目查 Bug', async () => {
  const r = await call('zentao_list_bugs', { projectId: 534, limit: 10 });
  ok(!r.failed, `调用失败: ${r.stdout.slice(0, 160)}`);
  ok(Array.isArray(r.json.bugs), 'bugs 不是数组');
  for (const b of r.json.bugs) {
    ok(typeof b.severity === 'number', `severity 应是 number，实际 ${typeof b.severity}`);
    ok(typeof b.priority === 'number', `priority 应是 number，实际 ${typeof b.priority}`);
  }
  return `${r.json.bugs.length} 条（total=${r.json.total}）`;
});

await test('severity 字符串枚举过滤生效', async () => {
  const r = await call('zentao_list_bugs', { projectId: 534, severity: '1', limit: 100 });
  ok(!r.failed, '调用失败');
  const bad = r.json.bugs.filter(b => b.severity !== 1);
  ok(bad.length === 0, `返回了非 severity=1 的 Bug: ${bad.map(b => `${b.id}/sev${b.severity}`).join(', ')}`);
  return `${r.json.bugs.length} 条 severity=1`;
});

await test('Bug 详情：多个编号都能返回（含关联对象为 null 的样本）', async () => {
  const list = await call('zentao_list_bugs', { projectId: 534, limit: 100 });
  ok(!list.failed && list.json.bugs.length > 0, '534 无 Bug 可取样本');
  const ids = list.json.bugs.slice(0, 5).map(b => Number(b.id));
  // 77809 是已知「plan/story/task 关联名称为 null」的样本：曾经导致整个工具在
  // MCP 输出校验阶段失败（-32602），所以固定纳入回归集。
  if (!ids.includes(77809)) ids.push(77809);

  for (const id of ids) {
    const r = await call('zentao_get_bug_details', { bugId: id });
    ok(!r.failed, `Bug #${id} 详情失败: ${r.stdout.slice(0, 160)}`);
    ok(r.json.bug, `Bug #${id} 结构化输出缺少 bug 字段，实际键: ${Object.keys(r.json).join(',')}`);
    ok(String(r.json.bug.id) === String(id), `Bug #${id} id 不一致: ${r.json.bug.id}`);
    ok(typeof r.json.bug.title === 'string' && r.json.bug.title.length > 0, `Bug #${id} title 缺失`);
    ok(Array.isArray(r.json.bug.files), `Bug #${id} files 不是数组`);
  }
  return `${ids.length} 个编号全部通过`;
});

// ═══════════════ D. 任务 ═══════════════
section('D. zentao_list_tasks');

await test('530 任务数与禅道自报一致（子任务补全修复的回归锚点）', async () => {
  const r = await call('zentao_list_tasks', { projectId: 530, limit: 100 });
  ok(!r.failed, `调用失败: ${r.stdout.slice(0, 160)}`);
  ok(!r.json.truncated, `出现缺口告警: ${r.json.truncation_message || ''}`);
  ok(r.json.total > 210, `总数 ${r.json.total} 未超过修复前的 210，子任务补全可能失效`);
  return `total=${r.json.total}`;
});

await test('534 任务数与禅道自报一致', async () => {
  const r = await call('zentao_list_tasks', { projectId: 534, limit: 100 });
  ok(!r.failed, '调用失败');
  ok(!r.json.truncated, `出现缺口告警: ${r.json.truncation_message || ''}`);
  ok(r.json.total > 271, `总数 ${r.json.total} 未超过修复前的 271`);
  return `total=${r.json.total}`;
});

await test('按 id 倒序（服务端忽略 orderBy，由客户端补）', async () => {
  const r = await call('zentao_list_tasks', { projectId: 530, limit: 100 });
  const ids = r.json.tasks.map(t => Number(t.id));
  const sorted = [...ids].sort((a, b) => b - a);
  ok(JSON.stringify(ids) === JSON.stringify(sorted), `未按 id 倒序，前 5 个: ${ids.slice(0, 5).join(', ')}`);
  return `${ids[0]} … ${ids[ids.length - 1]}`;
});

await test('status=doing 过滤生效', async () => {
  const r = await call('zentao_list_tasks', { projectId: 530, status: 'doing', limit: 100 });
  ok(!r.failed, '调用失败');
  const bad = r.json.tasks.filter(t => t.status !== 'doing');
  ok(bad.length === 0, `返回了非 doing 任务: ${bad.map(t => `${t.id}/${t.status}`).join(', ')}`);
  return `${r.json.tasks.length} 条 doing`;
});

await test('offset 翻页返回不相交的两批', async () => {
  const a = await call('zentao_list_tasks', { projectId: 530, limit: 20, offset: 0 });
  const b = await call('zentao_list_tasks', { projectId: 530, limit: 20, offset: 20 });
  ok(!a.failed && !b.failed, '调用失败');
  const idsA = new Set(a.json.tasks.map(t => t.id));
  const overlap = b.json.tasks.filter(t => idsA.has(t.id));
  ok(overlap.length === 0, `两页有 ${overlap.length} 条重复`);
  ok(b.json.offset === 20, `offset 未回显: ${b.json.offset}`);
  return `第1页 ${a.json.tasks.length} 条 / 第2页 ${b.json.tasks.length} 条，无重叠`;
});

// ═══════════════ E. 需求 ═══════════════
section('E. zentao_list_stories');

await test('按项目查需求（覆盖嵌套响应展平）', async () => {
  const r = await call('zentao_list_stories', { projectId: 530, limit: 10 });
  ok(!r.failed, `调用失败: ${r.stdout.slice(0, 160)}`);
  ok(Array.isArray(r.json.stories), 'stories 不是数组');
  for (const s of r.json.stories) {
    ok(s.id !== undefined && s.id !== '', '需求缺 id');
    ok(typeof s.title === 'string' && s.title.length > 0, `需求 ${s.id} 缺 title`);
    ok(typeof s.priority === 'number', `priority 应是 number`);
  }
  return `total=${r.json.total}`;
});

await test('需求 id 唯一（展平后未重复）', async () => {
  const r = await call('zentao_list_stories', { projectId: 530, limit: 100 });
  const ids = r.json.stories.map(s => s.id);
  ok(new Set(ids).size === ids.length, `展平后有重复 id（${ids.length} 条 / ${new Set(ids).size} 唯一）`);
  return `${ids.length} 条全部唯一`;
});

await test('status=closed 过滤生效', async () => {
  const r = await call('zentao_list_stories', { projectId: 530, status: 'closed', limit: 100 });
  ok(!r.failed, '调用失败');
  const bad = r.json.stories.filter(s => s.status !== 'closed');
  ok(bad.length === 0, `返回了非 closed 需求: ${bad.map(s => `${s.id}/${s.status}`).join(', ')}`);
  return `${r.json.stories.length} 条 closed`;
});

await test('keyword 过滤生效', async () => {
  const all = await call('zentao_list_stories', { projectId: 530, limit: 100 });
  const sample = all.json.stories.find(s => s.title.length > 4);
  ok(sample, '取不到样本需求');
  const kw = sample.title.slice(0, 4);
  const r = await call('zentao_list_stories', { projectId: 530, keyword: kw, limit: 100 });
  ok(!r.failed, '调用失败');
  ok(r.json.stories.length > 0, `关键词 "${kw}" 无结果，但样本标题含它`);
  const bad = r.json.stories.filter(s => !s.title.toLowerCase().includes(kw.toLowerCase()));
  ok(bad.length === 0, `关键词过滤不严: ${bad.map(s => s.title).join(' | ')}`);
  return `"${kw}" → ${r.json.stories.length} 条`;
});

// ═══════════════ F. 我的地盘 ═══════════════
section('F. zentao_list_my_*（跨项目）');

await test('我的任务：返回且带 projectName（跨项目标志）', async () => {
  const r = await call('zentao_list_my_tasks', { limit: 20 });
  ok(!r.failed, `调用失败: ${r.stdout.slice(0, 160)}`);
  ok(Array.isArray(r.json.tasks), 'tasks 不是数组');
  for (const t of r.json.tasks) {
    ok(t.projectName, `任务 ${t.id} 缺 projectName，跨项目展示会退化`);
  }
  ok(r.json.tasks.length <= 20, `超过接口 20 条上限: ${r.json.tasks.length}`);
  return `${r.json.total} 条`;
});

await test('我的任务：status 过滤生效', async () => {
  const all = await call('zentao_list_my_tasks', { limit: 20 });
  const statuses = [...new Set(all.json.tasks.map(t => t.status))];
  ok(statuses.length > 0, '无样本');
  const pick = statuses[0];
  const r = await call('zentao_list_my_tasks', { status: pick, limit: 20 });
  ok(!r.failed, '调用失败');
  const bad = r.json.tasks.filter(t => t.status !== pick);
  ok(bad.length === 0, `返回了非 ${pick} 任务`);
  return `status=${pick} → ${r.json.tasks.length} 条`;
});

await test('我的 Bug：可正常返回（0 条也算通过）', async () => {
  const r = await call('zentao_list_my_bugs', { limit: 20 });
  ok(!r.failed, `调用失败: ${r.stdout.slice(0, 160)}`);
  ok(Array.isArray(r.json.bugs), 'bugs 不是数组');
  return `${r.json.total} 条`;
});

await test('我的需求：可正常返回（0 条也算通过）', async () => {
  const r = await call('zentao_list_my_stories', { limit: 20 });
  ok(!r.failed, `调用失败: ${r.stdout.slice(0, 160)}`);
  ok(Array.isArray(r.json.stories), 'stories 不是数组');
  return `${r.json.total} 条`;
});

// ═══════════════ G. 错误路径 ═══════════════
section('G. 错误路径（必须被拦下，而不是静默返回错数据）');

await test('severity 传数字应被 schema 拒绝', async () => {
  const r = await call('zentao_list_bugs', { projectId: 534, severity: 1 });
  ok(r.failed, '传数字 severity 竟然成功了（应为字符串枚举）');
  return '已拒绝';
});

await test('未知字段应被 .strict() 拒绝', async () => {
  const r = await call('zentao_list_bugs', { projectId: 534, bogusField: 'x' });
  ok(r.failed, '未知字段竟然通过了 .strict() 校验');
  return '已拒绝';
});

await test('limit 超过 100 应被拒绝', async () => {
  const r = await call('zentao_list_tasks', { projectId: 530, limit: 1000 });
  ok(r.failed, 'limit=1000 竟然通过了 .max(100)');
  return '已拒绝';
});

await test('不存在的 Bug 编号应报错而非返回空对象', async () => {
  const r = await call('zentao_get_bug_details', { bugId: 999999999 });
  ok(r.failed, '查询不存在的 Bug 竟然成功了');
  return '已拒绝';
});

// ═══════════════ 汇总 ═══════════════
const passed = results.filter(r => r.ok).length;
const failedList = results.filter(r => !r.ok);
const totalMs = results.reduce((s, r) => s + r.ms, 0);

console.log(`\n${'─'.repeat(64)}`);
console.log(`\x1b[1m结果: ${passed}/${results.length} 通过\x1b[0m  \x1b[90m(耗时 ${(totalMs / 1000).toFixed(1)}s)\x1b[0m`);
if (failedList.length) {
  console.log(`\n\x1b[31m失败用例:\x1b[0m`);
  for (const f of failedList) console.log(`  ✗ ${f.name}\n      ${f.detail}`);
}
console.log('');
process.exit(failedList.length ? 1 : 0);
