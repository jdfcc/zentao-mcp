import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import ZentaoClient from '../services/zentao-client.js';
import { ListBugsInputSchema, GetBugDetailsInputSchema, type ListBugsInput, type GetBugDetailsInput } from '../schemas/tool-input-schemas.js';
import { ListBugsOutputSchema, GetBugDetailsOutputSchema } from '../schemas/tool-output-schemas.js';
import { Bug, BugListItem, PaginatedBugsOutput } from '../types.js';
import { CHARACTER_LIMIT } from '../constants.js';

export function registerBugTools(server: McpServer, zentaoClient: ZentaoClient, defaultProjectId?: string) {
  server.registerTool(
    'zentao_list_bugs',
    {
      title: '获取禅道 Bug 列表',
      description: `从禅道查询 Bug 列表,支持全面的多维度筛选。

此工具从禅道检索 Bug,支持按项目、状态、严重程度、优先级、指派用户、创建者、日期范围等进行筛选。支持分页和多种输出格式。此工具不会创建或修改 Bug,仅查询现有 Bug。

参数:
  - projectId (number): 项目 ID (如未指定则使用默认值)
  - status (string): 按状态筛选 - 'all'(全部), 'active'(活跃), 'resolved'(已解决), 'closed'(已关闭) (默认: all)
  - severity (string): 按严重程度筛选 - '1' (致命), '2' (严重), '3' (一般), '4' (轻微)
  - priority (string): 按优先级筛选 - '1' (高), '2' (中), '3' (低), '4' (最低)
  - assignedTo (string): 按指派用户账号筛选
  - openedBy (string): 按创建者用户账号筛选
  - resolution (string): 按解决方案关键词筛选
  - startDate (string): 按创建开始日期筛选 (YYYY-MM-DD 格式)
  - endDate (string): 按创建结束日期筛选 (YYYY-MM-DD 格式)
  - limit (number): 返回的最大结果数,范围 1-100 (默认: 20)
  - offset (number): 分页跳过的结果数 (默认: 0)
  - orderBy (string): 结果排序方式
  - response_format (string): 输出格式 - 'markdown' 供人类阅读, 'json' 供机器读取 (默认: markdown)

返回:
  JSON 格式时,返回结构化数据:
  {
    "bugs": [
      {
        "id": string,              // Bug ID
        "title": string,           // Bug 标题
        "status": string,           // Bug 状态 (active/resolved/closed/...)
        "severity": number,         // 严重程度 (1-4)
        "priority": number,         // 优先级 (1-4)
        "openedDate": string,       // 创建日期 (YYYY-MM-DD HH:mm:ss)
        "openedBy": string,         // 创建者账号
        "assignedTo": string,       // 指派用户账号
        "assignedDate": string,     // 指派日期
        "resolvedBy": string,       // 解决者账号
        "resolution": string,       // 解决方案描述
        "resolvedDate": string,     // 解决日期
        "closedBy": string,         // 关闭者账号
        "closedDate": string,       // 关闭日期
        "project": string,          // 项目 ID
        "product": string,          // 产品 ID
        "steps": string            // 复现步骤
      }
    ],
    "total": number,              // 匹配的 Bug 总数
    "count": number,              // 当前响应中的 Bug 数
    "offset": number,             // 当前分页偏移量
    "has_more": boolean,           // 是否有更多结果可用
    "next_offset": number,        // 下一页偏移量 (当 has_more 为 true 时)
    "filters": {                  // 应用的筛选条件参考
      "projectId": number,
      "status": string,
      "severity": number,
      "priority": number
    }
  }

示例:
  - 使用场景: "列出项目 1 中的所有 Bug" -> 参数 projectId=1
  - 使用场景: "仅显示活跃 Bug" -> 参数 status="active"
  - 使用场景: "显示严重程度为致命的 Bug" -> 参数 severity="1"
  - 使用场景: "显示指派给用户 john 的 Bug" -> 参数 assignedTo="john"
  - 使用场景: "显示上周的 Bug" -> 参数 startDate="2024-01-15", endDate="2024-01-22"

错误处理:
  - 如果 projectId 无效,返回 "Error: Project not found"
  - 如果凭据无效,返回 "Error: Authentication failed"
  - 成功时返回带有分页信息的格式化 Bug 列表`,
      inputSchema: ListBugsInputSchema,
      outputSchema: ListBugsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ListBugsInput) => {
      try {
        const projectId = params.projectId || (defaultProjectId ? parseInt(defaultProjectId) : undefined);
        
        if (!projectId) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: 'Error: Project ID is required. Either specify projectId parameter or set ZENTAO_DEFAULT_PROJECT environment variable.'
            }]
          };
        }

        const queryParams: any = {};
        if (params.limit) queryParams.limit = params.limit;
        if (params.offset) queryParams.offset = params.offset;
        if (params.orderBy) queryParams.order = params.orderBy;

        const data = await zentaoClient.getProjectBugs(projectId, queryParams);

        // 禅道 API 直接返回 bugs 数组，无需检查 status
        let bugs = data.bugs || [];

        if (params.status && params.status !== 'all') {
          bugs = bugs.filter((b: Bug) => b.status === params.status);
        }

        if (params.severity) {
          bugs = bugs.filter((b: Bug) => b.severity === params.severity);
        }

        if (params.priority) {
          bugs = bugs.filter((b: Bug) => b.pri === params.priority);
        }

        if (params.assignedTo) {
          bugs = bugs.filter((b: Bug) => b.assignedTo === params.assignedTo);
        }

        if (params.openedBy) {
          bugs = bugs.filter((b: Bug) => b.openedBy === params.openedBy);
        }

        if (params.resolution) {
          bugs = bugs.filter((b: Bug) => {
            if (!b.resolution) return false;
            return b.resolution.toLowerCase().includes(params.resolution!.toLowerCase());
          });
        }

        if (params.startDate) {
          bugs = bugs.filter((b: Bug) => {
            const bugDate = new Date(b.openedDate);
            const startDate = new Date(params.startDate!);
            return bugDate >= startDate;
          });
        }

        if (params.endDate) {
          bugs = bugs.filter((b: Bug) => {
            const bugDate = new Date(b.openedDate);
            const endDate = new Date(params.endDate!);
            endDate.setHours(23, 59, 59, 999);
            return bugDate <= endDate;
          });
        }

        const total = bugs.length;
        const startIndex = Math.min(params.offset, bugs.length);
        const endIndex = Math.min(startIndex + params.limit, bugs.length);
        const paginatedBugs = bugs.slice(startIndex, endIndex);

        const output: PaginatedBugsOutput = {
          bugs: paginatedBugs.map((b: Bug) => ({
            id: b.id,
            title: b.title,
            status: b.status,
            severity: parseInt(b.severity),
            priority: parseInt(b.pri),
            openedDate: b.openedDate,
            openedBy: b.openedBy,
            assignedTo: b.assignedTo || undefined,
            assignedDate: b.assignedDate || undefined,
            resolvedBy: b.resolvedBy || undefined,
            resolution: b.resolution || undefined,
            resolvedDate: b.resolvedDate || undefined,
            closedBy: b.closedBy || undefined,
            closedDate: b.closedDate || undefined,
            project: b.project,
            product: b.product,
            steps: b.steps
          })),
          total,
          count: paginatedBugs.length,
          offset: params.offset,
          has_more: endIndex < bugs.length,
          filters: {
            projectId,
            status: params.status,
            severity: params.severity ? parseInt(params.severity) : undefined,
            priority: params.priority ? parseInt(params.priority) : undefined
          },
          ...(endIndex < bugs.length ? {
            next_offset: endIndex
          } : {})
        };

        let textContent: string;
        if (params.response_format === 'json') {
          textContent = JSON.stringify(output, null, 2);
        } else {
          const lines = [
            `# Bug List`,
            '',
            `Found ${total} bugs (showing ${paginatedBugs.length})`,
            ''
          ];

          if (output.filters) {
            const filters = [];
            if (output.filters.projectId) filters.push(`Project: ${output.filters.projectId}`);
            if (output.filters.status) filters.push(`Status: ${output.filters.status}`);
            if (output.filters.severity) filters.push(`Severity: ${output.filters.severity}`);
            if (output.filters.priority) filters.push(`Priority: ${output.filters.priority}`);
            if (filters.length > 0) {
              lines.push(`**Filters**: ${filters.join(', ')}`);
              lines.push('');
            }
          }

          for (const b of paginatedBugs) {
            lines.push(`## Bug #${b.id}: ${b.title}`);
            lines.push(`- **Status**: ${b.status}`);
            lines.push(`- **Severity**: ${b.severity} (1=Critical, 2=Serious, 3=Normal, 4=Minor)`);
            lines.push(`- **Priority**: ${b.pri} (1=High, 2=Medium, 3=Low, 4=Lowest)`);
            lines.push(`- **Opened By**: ${b.openedBy} on ${b.openedDate}`);
            if (b.assignedTo) lines.push(`- **Assigned To**: ${b.assignedTo}`);
            if (b.resolvedBy) lines.push(`- **Resolved By**: ${b.resolvedBy} (${b.resolvedDate})`);
            if (b.resolution) lines.push(`- **Resolution**: ${b.resolution}`);
            lines.push('');
          }

          textContent = lines.join('\n');

          if (textContent.length > CHARACTER_LIMIT) {
            const halfLength = Math.max(1, Math.floor(paginatedBugs.length / 2));
            const truncatedBugs = paginatedBugs.slice(0, halfLength);
            output.bugs = truncatedBugs.map((b: Bug) => ({
            id: b.id,
            title: b.title,
            status: b.status,
            severity: parseInt(b.severity),
            priority: parseInt(b.pri),
            openedDate: b.openedDate,
            openedBy: b.openedBy,
            assignedTo: b.assignedTo || undefined,
            assignedDate: b.assignedDate || undefined,
            resolvedBy: b.resolvedBy || undefined,
            resolution: b.resolution || undefined,
            resolvedDate: b.resolvedDate || undefined,
            closedBy: b.closedBy || undefined,
            closedDate: b.closedDate || undefined,
            project: b.project,
            product: b.product,
            steps: b.steps
          }));
            output.count = truncatedBugs.length;
            (output as any).truncated = true;
            (output as any).truncation_message = `Response truncated from ${paginatedBugs.length} to ${truncatedBugs.length} bugs. Use 'offset' parameter or add filters to see more results.`;

            const truncatedLines = [
              `# Bug List`,
              '',
              `Found ${total} bugs (showing ${truncatedBugs.length})`,
              '',
              `⚠️ Response truncated. Showing first ${truncatedBugs.length} of ${paginatedBugs.length} bugs.`,
              ''
            ];

            if (output.filters) {
              const filters = [];
              if (output.filters.projectId) filters.push(`Project: ${output.filters.projectId}`);
              if (output.filters.status) filters.push(`Status: ${output.filters.status}`);
              if (output.filters.severity) filters.push(`Severity: ${output.filters.severity}`);
              if (output.filters.priority) filters.push(`Priority: ${output.filters.priority}`);
              if (filters.length > 0) {
                truncatedLines.push(`**Filters**: ${filters.join(', ')}`);
                truncatedLines.push('');
              }
            }

            for (const b of truncatedBugs) {
              truncatedLines.push(`## Bug #${b.id}: ${b.title}`);
              truncatedLines.push(`- **Status**: ${b.status}`);
              truncatedLines.push(`- **Severity**: ${b.severity}`);
              truncatedLines.push(`- **Priority**: ${b.pri}`);
              truncatedLines.push(`- **Opened By**: ${b.openedBy} on ${b.openedDate}`);
              if (b.assignedTo) truncatedLines.push(`- **Assigned To**: ${b.assignedTo}`);
              truncatedLines.push('');
            }

            truncatedLines.push('');
            truncatedLines.push(`Use offset=${endIndex} to see more results.`);

            textContent = truncatedLines.join('\n');
          }
        }

        return {
          content: [{ type: 'text', text: textContent }],
          structuredContent: output as any
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error: ${errorMessage}`
          }]
        };
      }
    }
  );

  server.registerTool(
    'zentao_get_bug_details',
    {
      title: '获取禅道 Bug 详情',
      description: `根据 ID 检索特定 Bug 的详细信息。

此工具从禅道获取完整的 Bug 信息,包括标题、描述、步骤、状态、指派历史、解决方案详情和相关元数据。此工具不会创建或修改 Bug,仅查询现有 Bug。

参数:
  - bugId (number): 要检索的 Bug ID (必需)
  - response_format (string): 输出格式 - 'markdown' 供人类阅读, 'json' 供机器读取 (默认: markdown)

返回:
  JSON 格式时,返回完整的 Bug 信息结构化数据,包括:
  - id, title, status, severity, priority, type
  - 创建信息 (创建者、日期、版本)
  - 指派详情 (指派给谁、指派日期、截止日期)
  - 解决信息 (解决者、解决方案、解决版本、解决日期)
  - 关闭信息 (关闭者、关闭日期)
  - 关联对象 (项目、产品、执行、计划、需求、任务)
  - 复现步骤、预期结果、实际结果
  - 附件和评论
  - 最后编辑信息

示例:
  - 使用场景: "获取 Bug 12345 的详情" -> 参数 bugId=12345
  - 使用场景: "以 JSON 格式显示 Bug #54321" -> 参数 bugId=54321, response_format='json'

错误处理:
  - 如果 bugId 无效,返回 "Error: Bug not found"
  - 如果凭据无效,返回 "Error: Authentication failed"
  - 成功时返回完整的 Bug 详情`,
      inputSchema: GetBugDetailsInputSchema,
      outputSchema: GetBugDetailsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: GetBugDetailsInput) => {
      try {
        const bug = await zentaoClient.getBugDetails(params.bugId);

        // Bug detail API 直接返回 bug 对象，无需检查 status

        const output = {
          id: bug.id,
          title: bug.title,
          status: bug.status,
          severity: parseInt(bug.severity),
          priority: parseInt(bug.pri),
          type: bug.type,
          os: bug.os,
          browser: bug.browser,
          hardware: bug.hardware,
          steps: bug.steps,
          confirmed: bug.confirmed,
          activatedCount: parseInt(bug.activatedCount),
          activatedDate: bug.activatedDate,
          openedBy: bug.openedBy,
          openedDate: bug.openedDate,
          openedBuild: bug.openedBuild,
          assignedTo: bug.assignedTo || undefined,
          assignedDate: bug.assignedDate || undefined,
          deadline: bug.deadline || undefined,
          resolvedBy: bug.resolvedBy || undefined,
          resolution: bug.resolution || undefined,
          resolvedBuild: bug.resolvedBuild || undefined,
          resolvedDate: bug.resolvedDate || undefined,
          closedBy: bug.closedBy || undefined,
          closedDate: bug.closedDate || undefined,
          duplicateBug: bug.duplicateBug || undefined,
          relatedBug: bug.relatedBug || undefined,
          case: bug.case || undefined,
          caseVersion: bug.caseVersion || undefined,
          project: {
            id: bug.project,
            name: bug.projectName
          },
          product: {
            id: bug.product,
            name: undefined
          },
          execution: bug.execution ? {
            id: bug.execution,
            name: bug.executionName
          } : undefined,
          plan: bug.plan ? {
            id: bug.plan,
            name: bug.planName
          } : undefined,
          story: bug.story ? {
            id: bug.story,
            title: bug.storyTitle,
            version: bug.storyVersion,
            status: bug.storyStatus,
            latestVersion: bug.latestStoryVersion
          } : undefined,
          task: bug.task ? {
            id: bug.task,
            name: bug.taskName
          } : undefined,
          lastEditedBy: bug.lastEditedBy,
          lastEditedDate: bug.lastEditedDate,
          files: bug.files || [],
          keywords: bug.keywords || undefined
        };

        let textContent: string;
        if (params.response_format === 'json') {
          textContent = JSON.stringify({ bug: output }, null, 2);
        } else {
          const lines = [
            `# Bug #${output.id}: ${output.title}`,
            '',
            `**Status**: ${output.status}`,
            `**Severity**: ${output.severity} (1=Critical, 2=Serious, 3=Normal, 4=Minor)`,
            `**Priority**: ${output.priority} (1=High, 2=Medium, 3=Low, 4=Lowest)`,
            `**Type**: ${output.type}`,
            ''
          ];

          lines.push('## Basic Information');
          if (output.os) lines.push(`- **OS**: ${output.os}`);
          if (output.browser) lines.push(`- **Browser**: ${output.browser}`);
          if (output.hardware) lines.push(`- **Hardware**: ${output.hardware}`);
          if (output.openedBuild) lines.push(`- **Opened Build**: ${output.openedBuild}`);
          if (output.deadline) lines.push(`- **Deadline**: ${output.deadline}`);
          lines.push('');

          lines.push('## Assignment & Status');
          lines.push(`- **Opened By**: ${output.openedBy}`);
          lines.push(`- **Opened Date**: ${output.openedDate}`);
          if (output.assignedTo) {
            lines.push(`- **Assigned To**: ${output.assignedTo}`);
            if (output.assignedDate) lines.push(`- **Assigned Date**: ${output.assignedDate}`);
          }
          if (output.resolvedBy) {
            lines.push(`- **Resolved By**: ${output.resolvedBy}`);
            if (output.resolvedDate) lines.push(`- **Resolved Date**: ${output.resolvedDate}`);
            if (output.resolution) lines.push(`- **Resolution**: ${output.resolution}`);
            if (output.resolvedBuild) lines.push(`- **Resolved Build**: ${output.resolvedBuild}`);
          }
          if (output.closedBy) {
            lines.push(`- **Closed By**: ${output.closedBy}`);
            if (output.closedDate) lines.push(`- **Closed Date**: ${output.closedDate}`);
          }
          if (output.activatedCount > 0) {
            lines.push(`- **Activated Count**: ${output.activatedCount}`);
            if (output.activatedDate) lines.push(`- **Activated Date**: ${output.activatedDate}`);
          }
          if (output.confirmed === '1') lines.push(`- **Confirmed**: Yes`);
          lines.push('');

          if (output.steps) {
            lines.push('## Steps to Reproduce');
            lines.push(output.steps);
            lines.push('');
          }

          lines.push('## Related Objects');
          lines.push(`- **Project**: ${output.project.name} (${output.project.id})`);
          if (output.execution) lines.push(`- **Execution**: ${output.execution.name} (${output.execution.id})`);
          if (output.plan) lines.push(`- **Plan**: ${output.plan.name} (${output.plan.id})`);
          if (output.story) lines.push(`- **Story**: ${output.story.title} (${output.story.id})`);
          if (output.task) lines.push(`- **Task**: ${output.task.name} (${output.task.id})`);
          lines.push('');

          if (output.lastEditedBy) {
            lines.push('## Last Edited');
            lines.push(`- **Edited By**: ${output.lastEditedBy}`);
            lines.push(`- **Edited Date**: ${output.lastEditedDate}`);
            lines.push('');
          }

          if (output.files && output.files.length > 0) {
            lines.push('## Attachments');
            for (const file of output.files) {
              lines.push(`- [${file.name}](${file.url})`);
            }
            lines.push('');
          }

          textContent = lines.join('\n');
        }

        return {
          content: [{ type: 'text', text: textContent }],
          structuredContent: { bug: output } as any
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error: ${errorMessage}`
          }]
        };
      }
    }
  );
}
