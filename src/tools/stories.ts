import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import ZentaoClient from '../services/zentao-client.js';
import { ListStoriesInputSchema, type ListStoriesInput } from '../schemas/tool-input-schemas.js';
import { ListStoriesOutputSchema } from '../schemas/tool-output-schemas.js';
import { Story, PaginatedStoriesOutput } from '../types.js';

const numberValue = (value: string) => Number.parseFloat(value) || 0;

export function registerStoryTools(server: McpServer, zentaoClient: ZentaoClient, defaultProjectId?: string) {
  server.registerTool('zentao_list_stories', {
    title: '获取禅道需求列表',
    description: '从禅道查询项目需求（Story）列表。支持按项目、状态、阶段、指派用户、创建者、标题关键词和创建日期筛选，并支持分页。该工具只读，不会创建或修改需求。',
    inputSchema: ListStoriesInputSchema,
    outputSchema: ListStoriesOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params: ListStoriesInput) => {
    try {
      const projectId = params.projectId ?? (defaultProjectId ? Number.parseInt(defaultProjectId, 10) : undefined);
      if (!projectId) return { isError: true, content: [{ type: 'text', text: 'Error: Project ID is required. Either specify projectId parameter or set ZENTAO_DEFAULT_PROJECT environment variable.' }] };
      const data = await zentaoClient.getProjectStories(projectId, { limit: 1000, offset: 0 });
      let stories = data.stories || [];
      if (params.status && params.status !== 'all') stories = stories.filter((story: Story) => story.status === params.status);
      if (params.stage && params.stage !== 'all') stories = stories.filter((story: Story) => story.stage === params.stage);
      if (params.assignedTo) stories = stories.filter((story: Story) => story.assignedTo === params.assignedTo);
      if (params.openedBy) stories = stories.filter((story: Story) => story.openedBy === params.openedBy);
      if (params.keyword) { const kw = params.keyword.toLowerCase(); stories = stories.filter((story: Story) => story.title.toLowerCase().includes(kw)); }
      if (params.startDate) stories = stories.filter((story: Story) => new Date(story.openedDate) >= new Date(params.startDate!));
      if (params.endDate) stories = stories.filter((story: Story) => { const end = new Date(params.endDate!); end.setHours(23, 59, 59, 999); return new Date(story.openedDate) <= end; });
      const total = stories.length;
      const page = stories.slice(params.offset, params.offset + params.limit);
      const output: PaginatedStoriesOutput = {
        stories: page.map((story: Story) => ({
          id: story.id, title: story.title, status: story.status, stage: story.stage,
          priority: Number.parseInt(story.pri, 10) || 0, category: story.category,
          estimate: numberValue(story.estimate), product: story.product,
          openedBy: story.openedBy, openedDate: story.openedDate,
          assignedTo: story.assignedTo || undefined, version: story.version
        })),
        total, count: page.length, offset: params.offset, has_more: params.offset + page.length < total,
        filters: { projectId, status: params.status, stage: params.stage, assignedTo: params.assignedTo, openedBy: params.openedBy }
      };
      if (output.has_more) output.next_offset = params.offset + page.length;
      const textContent = params.response_format === 'json' ? JSON.stringify(output, null, 2) : [
        '# Story List', '', `Found ${total} stories (showing ${page.length})`, '',
        ...page.flatMap((story: Story) => [
          `## Story #${story.id}: ${story.title}`,
          `- **Status**: ${story.status}`,
          `- **Stage**: ${story.stage}`,
          `- **Priority**: ${story.pri}`,
          `- **Category**: ${story.category}`,
          `- **Estimate**: ${story.estimate}`,
          `- **Product**: ${story.product}`,
          `- **Opened By**: ${story.openedBy} on ${story.openedDate}`,
          `- **Assigned To**: ${story.assignedTo || 'Unassigned'}`,
          ''
        ])
      ].join('\n');
      return { content: [{ type: 'text', text: textContent }], structuredContent: output as any };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
