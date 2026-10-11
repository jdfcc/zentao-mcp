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
    json(response, legacyEnvelope({
      tasks: {
        8: { id: 8, project: 1, execution: 3, name: '旧版任务', status: 'doing', pri: 2, estimate: 8, consumed: 3, left: 5, assignedTo: 'legacy-user', openedBy: 'legacy-user', openedDate: '2026-01-01 09:00:00' }
      }
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
  assert.equal(tasks.tasks[0]?.name, '旧版任务');
  assert.equal(tasks.tasks[0]?.estimate, '8');

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
  assert.ok(calls.includes('GET /bug-view-7.json'));
  console.log('Legacy Zentao compatibility test passed (auto-detection, session login, projects, bugs, tasks, details).');
} finally {
  await new Promise(resolve => server.close(resolve));
}
