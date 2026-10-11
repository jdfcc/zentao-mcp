#!/usr/bin/env node

import 'dotenv/config';
import assert from 'node:assert/strict';
import ZentaoClient from './dist/services/zentao-client.js';

const required = ['ZENTAO_URL', 'ZENTAO_USERNAME', 'ZENTAO_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const client = new ZentaoClient({
  zentaoUrl: process.env.ZENTAO_URL,
  username: process.env.ZENTAO_USERNAME,
  password: process.env.ZENTAO_PASSWORD,
  defaultProject: process.env.ZENTAO_DEFAULT_PROJECT,
  apiMode: process.env.ZENTAO_API_MODE ?? 'auto',
  ttlSeconds: Number(process.env.TTL_SECONDS ?? 3600),
  logLevel: process.env.LOG_LEVEL ?? 'info'
});

const projects = await client.getProjects();
assert.ok(Array.isArray(projects.projects));
console.log(`Live authentication and project query passed (${projects.projects.length} projects).`);

if (process.env.ZENTAO_DEFAULT_PROJECT) {
  const configuredProjectID = Number(process.env.ZENTAO_DEFAULT_PROJECT);
  assert.ok(Number.isInteger(configuredProjectID) && configuredProjectID > 0, 'ZENTAO_DEFAULT_PROJECT must be a positive integer.');
  const availableProjectIDs = projects.projects.map(project => Number(project.id));
  const projectID = availableProjectIDs.includes(configuredProjectID)
    ? configuredProjectID
    : availableProjectIDs[0];
  assert.ok(projectID, 'The authenticated account has no accessible project to test.');
  if (projectID !== configuredProjectID) {
    console.warn(`Configured default project ${configuredProjectID} is not accessible; using project ${projectID} for the smoke test.`);
  }

  const bugs = await client.getProjectBugs(projectID, { limit: 5, offset: 0 });
  assert.ok(Array.isArray(bugs.bugs));
  console.log(`Live project bug query passed (${bugs.bugs.length} bugs returned for the smoke test).`);

  const tasks = await client.getProjectTasks(projectID, { limit: 5, offset: 0 });
  assert.ok(Array.isArray(tasks.tasks));
  console.log(`Live project task query passed (${tasks.tasks.length} tasks returned for the smoke test).`);

  const stories = await client.getProjectStories(projectID, { limit: 5, offset: 0 });
  assert.ok(Array.isArray(stories.stories));
  console.log(`Live project story query passed (${stories.stories.length} stories returned for the smoke test).`);

  const firstBug = bugs.bugs[0];
  if (firstBug) {
    const detail = await client.getBugDetails(Number(firstBug.id));
    assert.equal(detail.id, firstBug.id);
    console.log('Live bug detail query passed.');
  } else {
    console.log('Bug detail query skipped because the selected project returned no bugs.');
  }
}

// 「我的地盘」跨项目接口，与 ZENTAO_DEFAULT_PROJECT 无关
const myTasks = await client.getMyTasks();
assert.ok(Array.isArray(myTasks.tasks));
console.log(`Live my-task query passed (${myTasks.tasks.length} tasks assigned to the current account).`);

const myBugs = await client.getMyBugs();
assert.ok(Array.isArray(myBugs.bugs));
console.log(`Live my-bug query passed (${myBugs.bugs.length} bugs assigned to the current account).`);

const myStories = await client.getMyStories();
assert.ok(Array.isArray(myStories.stories));
console.log(`Live my-story query passed (${myStories.stories.length} stories assigned to the current account).`);
