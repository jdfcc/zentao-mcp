import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import ZentaoClient from '../services/zentao-client.js';
import {
  ListMyTasksInputSchema, type ListMyTasksInput,
  ListMyBugsInputSchema, type ListMyBugsInput,
  ListMyStoriesInputSchema, type ListMyStoriesInput
} from '../schemas/tool-input-schemas.js';
import { ListTasksOutputSchema, ListBugsOutputSchema, ListStoriesOutputSchema } from '../schemas/tool-output-schemas.js';
import { Task, Bug, Story, PaginatedTasksOutput, PaginatedBugsOutput, PaginatedStoriesOutput } from '../types.js';

const numberValue = (value: string) => Number.parseFloat(value) || 0;

/**
 * 禅道「我的地盘」接口单次最多返回 20 条，且分页参数被服务端忽略（实测确认）。
 * 正好拿到 20 条时无法区分"恰好 20"与"被截断"，所以按"可能被截断"提示。
 */
const MY_PAGE_CAP = 20;
const capHint = (n: number) => n >= MY_PAGE_CAP
  ? `\n\n> ⚠️ 禅道「我的地盘」接口单次最多返回 ${MY_PAGE_CAP} 条且不支持翻页，以上可能并非全部，请到禅道页面确认。`
  : '';

export function registerMyTools(server: McpServer, zentaoClient: ZentaoClient) {
  // ───────────── 指派给我的任务 ─────────────
  server.registerTool('zentao_list_my_tasks', {
    title: '获取指派给我的任务',
    description: '查询禅道「我的地盘-我的任务」：跨项目返回当前登录账号被指派的任务。无需 projectId。该工具只读。',
    inputSchema: ListMyTasksInputSchema,
    outputSchema: ListTasksOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params: ListMyTasksInput) => {
    try {
      const data = await zentaoClient.getMyTasks();
      let tasks = data.tasks || [];
      if (params.status && params.status !== 'all') tasks = tasks.filter((task: Task) => task.status === params.status);
      if (params.keyword) { const kw = params.keyword.toLowerCase(); tasks = tasks.filter((task: Task) => task.name.toLowerCase().includes(kw)); }
      const total = tasks.length;
      const page = tasks.slice(params.offset, params.offset + params.limit);
      const capped = total >= MY_PAGE_CAP;
      const output: PaginatedTasksOutput = {
        tasks: page.map((task: Task) => ({
          id: task.id, name: task.name, status: task.status, priority: Number.parseInt(task.pri, 10) || 0,
          project: task.project, projectName: task.projectName || undefined, execution: task.execution,
          assignedTo: task.assignedTo || undefined, assignedDate: task.assignedDate || undefined,
          openedBy: task.openedBy, openedDate: task.openedDate,
          deadline: task.deadline && task.deadline !== '0000-00-00' ? task.deadline : undefined,
          estimate: numberValue(task.estimate), consumed: numberValue(task.consumed), left: numberValue(task.left)
        })),
        total, count: page.length, offset: params.offset, has_more: params.offset + page.length < total,
        filters: { status: params.status }
      };
      if (output.has_more) output.next_offset = params.offset + page.length;
      if (capped) { output.truncated = true; output.truncation_message = `禅道「我的地盘」接口单次最多返回 ${MY_PAGE_CAP} 条且不支持翻页，结果可能不完整。`; }
      const textContent = params.response_format === 'json' ? JSON.stringify(output, null, 2) : [
        '# My Tasks (指派给我)', '', `Found ${total} tasks (showing ${page.length})`, '',
        ...page.flatMap((task: Task) => [
          `## Task #${task.id}: ${task.name}`,
          `- **Status**: ${task.status}`,
          `- **Priority**: ${task.pri}`,
          `- **Project**: ${task.projectName || task.project}`,
          `- **Hours**: estimate ${task.estimate}, consumed ${task.consumed}, left ${task.left}`,
          task.deadline && task.deadline !== '0000-00-00' ? `- **Deadline**: ${task.deadline}` : '',
          ''
        ])
      ].join('\n') + capHint(total);
      return { content: [{ type: 'text', text: textContent }], structuredContent: output as any };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  // ───────────── 指派给我的 Bug ─────────────
  server.registerTool('zentao_list_my_bugs', {
    title: '获取指派给我的 Bug',
    description: '查询禅道「我的地盘-我的Bug」：跨项目返回当前登录账号被指派的 Bug。无需 projectId。该工具只读。',
    inputSchema: ListMyBugsInputSchema,
    outputSchema: ListBugsOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params: ListMyBugsInput) => {
    try {
      const data = await zentaoClient.getMyBugs();
      let bugs = data.bugs || [];
      if (params.status && params.status !== 'all') bugs = bugs.filter((bug: Bug) => bug.status === params.status);
      if (params.severity) bugs = bugs.filter((bug: Bug) => bug.severity === params.severity);
      if (params.keyword) { const kw = params.keyword.toLowerCase(); bugs = bugs.filter((bug: Bug) => bug.title.toLowerCase().includes(kw)); }
      const total = bugs.length;
      const page = bugs.slice(params.offset, params.offset + params.limit);
      const capped = total >= MY_PAGE_CAP;
      const output: PaginatedBugsOutput = {
        bugs: page.map((bug: Bug) => ({
          id: bug.id, title: bug.title, status: bug.status,
          severity: Number.parseInt(bug.severity, 10) || 0, priority: Number.parseInt(bug.pri, 10) || 0,
          openedDate: bug.openedDate, openedBy: bug.openedBy,
          assignedTo: bug.assignedTo || undefined, assignedDate: bug.assignedDate || undefined,
          resolvedBy: bug.resolvedBy || undefined, resolution: bug.resolution || undefined, resolvedDate: bug.resolvedDate || undefined,
          closedBy: bug.closedBy || undefined, closedDate: bug.closedDate || undefined,
          project: bug.project, product: bug.product, steps: bug.steps
        })),
        total, count: page.length, offset: params.offset, has_more: params.offset + page.length < total,
        filters: { status: params.status, severity: params.severity ? Number(params.severity) : undefined }
      };
      if (output.has_more) output.next_offset = params.offset + page.length;
      if (capped) { output.truncated = true; output.truncation_message = `禅道「我的地盘」接口单次最多返回 ${MY_PAGE_CAP} 条且不支持翻页，结果可能不完整。`; }
      const textContent = params.response_format === 'json' ? JSON.stringify(output, null, 2) : [
        '# My Bugs (指派给我)', '', `Found ${total} bugs (showing ${page.length})`, '',
        ...page.flatMap((bug: Bug) => [
          `## Bug #${bug.id}: ${bug.title}`,
          `- **Status**: ${bug.status}`,
          `- **Severity**: ${bug.severity}`,
          `- **Priority**: ${bug.pri}`,
          `- **Opened By**: ${bug.openedBy} on ${bug.openedDate}`,
          ''
        ])
      ].join('\n') + capHint(total);
      return { content: [{ type: 'text', text: textContent }], structuredContent: output as any };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  // ───────────── 指派给我的需求 ─────────────
  server.registerTool('zentao_list_my_stories', {
    title: '获取指派给我的需求',
    description: '查询禅道「我的地盘-我的需求」：跨项目返回当前登录账号被指派的需求（Story）。无需 projectId。该工具只读。',
    inputSchema: ListMyStoriesInputSchema,
    outputSchema: ListStoriesOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params: ListMyStoriesInput) => {
    try {
      const data = await zentaoClient.getMyStories();
      let stories = data.stories || [];
      if (params.status && params.status !== 'all') stories = stories.filter((story: Story) => story.status === params.status);
      if (params.stage && params.stage !== 'all') stories = stories.filter((story: Story) => story.stage === params.stage);
      if (params.keyword) { const kw = params.keyword.toLowerCase(); stories = stories.filter((story: Story) => story.title.toLowerCase().includes(kw)); }
      const total = stories.length;
      const page = stories.slice(params.offset, params.offset + params.limit);
      const capped = total >= MY_PAGE_CAP;
      const output: PaginatedStoriesOutput = {
        stories: page.map((story: Story) => ({
          id: story.id, title: story.title, status: story.status, stage: story.stage,
          priority: Number.parseInt(story.pri, 10) || 0, category: story.category,
          estimate: numberValue(story.estimate), product: story.product,
          openedBy: story.openedBy, openedDate: story.openedDate,
          assignedTo: story.assignedTo || undefined, version: story.version
        })),
        total, count: page.length, offset: params.offset, has_more: params.offset + page.length < total,
        filters: { status: params.status, stage: params.stage }
      };
      if (output.has_more) output.next_offset = params.offset + page.length;
      if (capped) { output.truncated = true; output.truncation_message = `禅道「我的地盘」接口单次最多返回 ${MY_PAGE_CAP} 条且不支持翻页，结果可能不完整。`; }
      const textContent = params.response_format === 'json' ? JSON.stringify(output, null, 2) : [
        '# My Stories (指派给我)', '', `Found ${total} stories (showing ${page.length})`, '',
        ...page.flatMap((story: Story) => [
          `## Story #${story.id}: ${story.title}`,
          `- **Status**: ${story.status}`,
          `- **Stage**: ${story.stage}`,
          `- **Priority**: ${story.pri}`,
          `- **Estimate**: ${story.estimate}`,
          ''
        ])
      ].join('\n') + capHint(total);
      return { content: [{ type: 'text', text: textContent }], structuredContent: output as any };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
