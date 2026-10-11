import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import ZentaoClient from '../services/zentao-client.js';
import { ListTasksInputSchema, type ListTasksInput } from '../schemas/tool-input-schemas.js';
import { ListTasksOutputSchema } from '../schemas/tool-output-schemas.js';
import { Task, PaginatedTasksOutput } from '../types.js';

const numberValue = (value: string) => Number.parseFloat(value) || 0;

export function registerTaskTools(server: McpServer, zentaoClient: ZentaoClient, defaultProjectId?: string) {
  server.registerTool('zentao_list_tasks', {
    title: '获取禅道任务列表',
    description: '从禅道查询项目任务列表。支持按项目、状态、指派用户、创建者和创建日期筛选，并支持分页。该工具只读，不会创建或修改任务。',
    inputSchema: ListTasksInputSchema,
    outputSchema: ListTasksOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params: ListTasksInput) => {
    try {
      const projectId = params.projectId ?? (defaultProjectId ? Number.parseInt(defaultProjectId, 10) : undefined);
      if (!projectId) return { isError: true, content: [{ type: 'text', text: 'Error: Project ID is required. Either specify projectId parameter or set ZENTAO_DEFAULT_PROJECT environment variable.' }] };
      const data = await zentaoClient.getProjectTasks(projectId, { limit: 1000, offset: 0 });
      let tasks = data.tasks || [];
      if (params.status && params.status !== 'all') tasks = tasks.filter((task: Task) => task.status === params.status);
      if (params.assignedTo) tasks = tasks.filter((task: Task) => task.assignedTo === params.assignedTo);
      if (params.openedBy) tasks = tasks.filter((task: Task) => task.openedBy === params.openedBy);
      if (params.startDate) tasks = tasks.filter((task: Task) => new Date(task.openedDate) >= new Date(params.startDate!));
      if (params.endDate) tasks = tasks.filter((task: Task) => { const end = new Date(params.endDate!); end.setHours(23, 59, 59, 999); return new Date(task.openedDate) <= end; });
      const total = tasks.length;
      const page = tasks.slice(params.offset, params.offset + params.limit);
      const output: PaginatedTasksOutput = {
        tasks: page.map((task: Task) => ({ id: task.id, name: task.name, status: task.status, priority: Number.parseInt(task.pri, 10) || 0, project: task.project, execution: task.execution, assignedTo: task.assignedTo || undefined, assignedDate: task.assignedDate || undefined, openedBy: task.openedBy, openedDate: task.openedDate, deadline: task.deadline || undefined, estimate: numberValue(task.estimate), consumed: numberValue(task.consumed), left: numberValue(task.left) })),
        total, count: page.length, offset: params.offset, has_more: params.offset + page.length < total,
        filters: { projectId, status: params.status, assignedTo: params.assignedTo, openedBy: params.openedBy }
      };
      if (output.has_more) output.next_offset = params.offset + page.length;
      const textContent = params.response_format === 'json' ? JSON.stringify(output, null, 2) : [
        '# Task List', '', `Found ${total} tasks (showing ${page.length})`, '',
        ...page.flatMap((task: Task) => [`## Task #${task.id}: ${task.name}`, `- **Status**: ${task.status}`, `- **Priority**: ${task.pri}`, `- **Assigned To**: ${task.assignedTo || 'Unassigned'}`, `- **Opened By**: ${task.openedBy} on ${task.openedDate}`, `- **Hours**: estimate ${task.estimate}, consumed ${task.consumed}, left ${task.left}`, task.deadline ? `- **Deadline**: ${task.deadline}` : '', ''])
      ].join('\n');
      return { content: [{ type: 'text', text: textContent }], structuredContent: output as any };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
