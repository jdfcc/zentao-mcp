#!/usr/bin/env node

import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import ZentaoClient from './dist/services/zentao-client.js';

const calls = [];
const json = (response, value) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
};
const legacyEnvelope = data => ({ status: 'success', data: JSON.stringify(data) });

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  calls.push(`${request.method} ${url.pathname}`);

  if (request.method === 'POST' && url.pathname === '/api.php/v1/tokens') {
    json(response, { errcode: 401, errmsg: '缺少code参数' });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api-getsessionid.json') {
    json(response, legacyEnvelope({ sessionName: 'zentaosid', sessionID: 'legacy-session-id', rand: 5374 }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/user-login.json') {
    assert.equal(url.searchParams.get('zentaosid'), 'legacy-session-id');
    assert.match(request.headers.cookie ?? '', /zentaosid=legacy-session-id/);
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const form = new URLSearchParams(body);
      const md5 = value => createHash('md5').update(value, 'utf8').digest('hex');
      assert.equal(form.get('password'), md5(`${md5('legacy-password')}5374`));
      json(response, { result: 'success', locate: '/my/' });
    });
    return;
  }
  if (url.pathname.startsWith('/project-all-')) {
    json(response, legacyEnvelope({
      projectStats: {
        1: { id: 1, name: '旧版项目', status: 'doing', begin: '2026-01-01', end: '2026-12-31' }
      }
    }));
    return;
  }
  if (url.pathname.startsWith('/project-bug-')) {
    json(response, legacyEnvelope({
      bugs: {
        7: { id: 7, project: 1, product: 2, title: '旧版 Bug', status: 'active', severity: 1, pri: 2 }
      }
    }));
    return;
  }
  if (url.pathname.startsWith('/project-task-')) {
    // 顶层任务 + 一个 parent=-1 的父任务。子任务不在这个列表里，只在 recTotal 中计数，
    // 必须靠 task-view 的 children 才能拿到（覆盖 fetchTaskChildren 补全逻辑）。
    json(response, legacyEnvelope({
      recTotal: 3,
      tasks: {
        8: { id: 8, project: 1, execution: 3, name: '旧版任务', status: 'doing', pri: 2, estimate: 8, consumed: 3, left: 5, assignedTo: 'legacy-user', openedBy: 'legacy-user', openedDate: '2026-01-01 09:00:00', parent: 0 },
        10: { id: 10, project: 1, execution: 3, name: '旧版父任务', status: 'doing', pri: 2, estimate: 0, consumed: 0, left: 0, openedBy: 'legacy-user', openedDate: '2026-01-02 09:00:00', parent: -1 }
      }
    }));
    return;
  }
  if (url.pathname === '/task-view-10.json') {
    json(response, legacyEnvelope({
      task: {
        id: 10,
        children: {
          11: { id: 11, project: 1, execution: 3, name: '旧版子任务', status: 'wait', pri: 3, estimate: 1, consumed: 0, left: 1, parent: 10, openedBy: 'legacy-user', openedDate: '2026-01-03 09:00:00' }
        }
      }
    }));
    return;
  }
  if (url.pathname.startsWith('/project-story-')) {
    // 故意返回「按产品分组的嵌套对象」，以覆盖 flattenStories 的展平逻辑
    json(response, legacyEnvelope({
      stories: {
        552: {
          9: { id: 9, product: 552, title: '旧版需求', status: 'active', stage: 'developed', pri: 3, estimate: 2, category: 'feature', version: 1, openedBy: 'legacy-user', openedDate: '2026-01-02 09:00:00' }
        }
      }
    }));
    return;
  }
  if (url.pathname === '/my-task-assignedTo.json') {
    json(response, legacyEnvelope({
      title: '我的地盘-我的任务',
      tasks: {
        21: { id: 21, project: 5, projectName: '跨项目A', name: '我的任务', status: 'doing', pri: 1, estimate: 4, consumed: 2, left: 2, assignedTo: 'legacy-user', openedBy: 'someone', openedDate: '2026-02-01 09:00:00' }
      },
      recTotal: 0, recPerPage: 20, pageID: 1
    }));
    return;
  }
  if (url.pathname === '/my-bug.json') {
    json(response, legacyEnvelope({
      title: '我的地盘-我的Bug',
      bugs: { 22: { id: 22, project: 5, product: 6, title: '我的Bug', status: 'active', severity: 2, pri: 1 } },
      recTotal: 0, recPerPage: 20, pageID: 1
    }));
    return;
  }
  if (url.pathname === '/my-story.json') {
    json(response, legacyEnvelope({
      title: '我的地盘-我的需求',
      stories: { 23: { id: 23, product: 6, title: '我的需求', status: 'active', stage: 'developing', pri: 2, estimate: 3, version: 1 } },
      recTotal: 0, recPerPage: 20, pageID: 1
    }));
    return;
  }
  if (url.pathname.startsWith('/bug-view-')) {
    json(response, legacyEnvelope({
      bug: { id: 7, project: 1, product: 2, title: '旧版 Bug', status: 'active', severity: 1, pri: 2 }
    }));
    return;
  }

  response.writeHead(404);
  response.end();
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');

try {
  const client = new ZentaoClient({
    zentaoUrl: `http://127.0.0.1:${address.port}`,
    username: 'legacy-user',
    password: 'legacy-password',
    apiMode: 'auto',
    ttlSeconds: 60,
    logLevel: 'error'
  });

  const projects = await client.getProjects();
  assert.equal(projects.projects[0]?.name, '旧版项目');
  assert.equal(projects.projects[0]?.id, '1');

  const bugs = await client.getProjectBugs(1, { limit: 20, offset: 0 });
  assert.equal(bugs.bugs[0]?.title, '旧版 Bug');
  assert.equal(bugs.bugs[0]?.severity, '1');

  const tasks = await client.getProjectTasks(1, { limit: 20, offset: 0 });
  // 顶层 2 条 + 从 task-view 的 children 补回的 1 条子任务，且按 id 倒序
  assert.equal(tasks.tasks.length, 3, '子任务必须被补回，否则会静默漏数');
  assert.deepEqual(tasks.tasks.map(t => t.id), ['11', '10', '8']);
  assert.equal(tasks.tasks[0]?.name, '旧版子任务');
  assert.equal(tasks.tasks[2]?.name, '旧版任务');
  assert.equal(tasks.tasks[2]?.estimate, '8');
  assert.equal(tasks.serverRecTotal, 3);

  const stories = await client.getProjectStories(1, { limit: 20, offset: 0 });
  assert.equal(stories.stories.length, 1);
  assert.equal(stories.stories[0]?.title, '旧版需求');
  assert.equal(stories.stories[0]?.id, '9');
  assert.equal(stories.stories[0]?.stage, 'developed');

  // 「我的地盘」：跨项目、无 projectId，且 recTotal 恒为 0（真实条数看数组长度）
  const myTasks = await client.getMyTasks();
  assert.equal(myTasks.tasks.length, 1);
  assert.equal(myTasks.tasks[0]?.name, '我的任务');
  assert.equal(myTasks.tasks[0]?.projectName, '跨项目A');

  const myBugs = await client.getMyBugs();
  assert.equal(myBugs.bugs.length, 1);
  assert.equal(myBugs.bugs[0]?.title, '我的Bug');
  assert.equal(myBugs.bugs[0]?.severity, '2');

  const myStories = await client.getMyStories();
  assert.equal(myStories.stories.length, 1);
  assert.equal(myStories.stories[0]?.title, '我的需求');
  assert.equal(myStories.stories[0]?.stage, 'developing');

  const bug = await client.getBugDetails(7);
  assert.equal(bug.id, '7');
  assert.ok(Array.isArray(bug.files));

  assert.deepEqual(calls.slice(0, 3), [
    'POST /api.php/v1/tokens',
    'GET /api-getsessionid.json',
    'POST /user-login.json'
  ]);
  assert.equal(calls.filter(call => call.includes('getsessionid')).length, 1);
  assert.ok(calls.includes('GET /project-all-all-0-order_desc-0-0-1000-1.json'));
  assert.ok(calls.some(call => call.startsWith('GET /project-bug-1-')));
  assert.ok(calls.some(call => call.startsWith('GET /project-task-1-')));
  assert.ok(calls.includes('GET /task-view-10.json'), '必须为 parent=-1 的父任务补拉 children');
  assert.ok(calls.some(call => call.startsWith('GET /project-story-1-')));
  assert.ok(calls.includes('GET /my-task-assignedTo.json'));
  assert.ok(calls.includes('GET /my-bug.json'));
  assert.ok(calls.includes('GET /my-story.json'));
  assert.ok(calls.includes('GET /bug-view-7.json'));
  console.log('Legacy Zentao compatibility test passed (auto-detection, session login, projects, bugs, tasks, stories, my-*, details).');
} finally {
  await new Promise(resolve => server.close(resolve));
}
