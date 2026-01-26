import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import ZentaoClient from '../services/zentao-client.js';
import { ListProjectsInputSchema, type ListProjectsInput } from '../schemas/tool-input-schemas.js';
import { Project } from '../types.js';
import { CHARACTER_LIMIT } from '../constants.js';

export function registerProjectTools(server: McpServer, zentaoClient: ZentaoClient) {
  server.registerTool(
    'zentao_list_projects',
    {
      title: '获取禅道项目列表',
      description: `从禅道系统查询项目列表,支持可选的筛选条件。

此工具从禅道项目管理系统中检索所有项目,支持状态筛选和分页。此工具不会创建或修改项目,仅查询现有项目。

参数:
  - limit (number): 返回的最大结果数,范围 1-100 (默认: 20)
  - offset (number): 分页跳过的结果数 (默认: 0)
  - status (string): 按项目状态筛选 - 'all'(全部), 'active'(进行中), 'closed'(已关闭) (可选)

返回:
  JSON 格式时,返回结构化数据:
  {
    "total": number,              // 找到的项目总数
    "count": number,              // 当前响应中的结果数
    "offset": number,             // 当前分页偏移量
    "projects": [
      {
        "id": string,            // 项目 ID
        "name": string,          // 项目名称
        "status": string,        // 项目状态 (wait/doing/done/pause/closed/...)
        "begin": string,         // 计划开始日期 (YYYY-MM-DD)
        "end": string,           // 计划结束日期 (YYYY-MM-DD)
        "realBegan": string,      // 实际开始日期 (YYYY-MM-DD HH:mm:ss)
        "realEnd": string,       // 实际结束日期 (YYYY-MM-DD HH:mm:ss)
        "openedBy": string,      // 创建者账号
        "openedDate": string,    // 创建日期 (YYYY-MM-DD HH:mm:ss)
        "desc": string           // 项目描述
      }
    ],
    "has_more": boolean,         // 是否有更多结果可用
    "next_offset": number        // 下一页的偏移量 (当 has_more 为 true 时)
  }

示例:
  - 使用场景: "列出所有进行中的项目" -> 参数 status="active"
  - 使用场景: "显示前 10 个项目" -> 参数 limit=10
  - 使用场景: "获取第 2 页项目" -> 参数 offset=20, limit=20
  - 不使用场景: 需要创建或修改项目时

错误处理:
  - 如果凭据无效,返回 "Error: Authentication failed"
  - 如果服务器无法访问,返回 "Error: Network connection failed"
  - 成功时返回带有分页信息的格式化项目列表`,
      inputSchema: ListProjectsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListProjectsInput) => {
      try {
        const data = await zentaoClient.getProjects();

        // 禅道 API 直接返回项目数组，无需检查 status
        const projects = data.projects || [];
        const total = projects.length;
        
        let filteredProjects = projects;
        if (params.status && params.status !== 'all') {
          filteredProjects = projects.filter(p => {
            if (params.status === 'active') {
              return p.status !== 'closed';
            } else if (params.status === 'closed') {
              return p.status === 'closed';
            }
            return true;
          });
        }

        const startIndex = Math.min(params.offset, filteredProjects.length);
        const endIndex = Math.min(startIndex + params.limit, filteredProjects.length);
        const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

        const output = {
          total: filteredProjects.length,
          count: paginatedProjects.length,
          offset: params.offset,
          projects: paginatedProjects.map((p: Project) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            begin: p.begin,
            end: p.end,
            realBegan: p.realBegan,
            realEnd: p.realEnd,
            openedBy: p.openedBy,
            openedDate: p.openedDate,
            desc: p.desc
          })) as Array<Project & { desc?: string }>,
          has_more: endIndex < filteredProjects.length,
          ...(endIndex < filteredProjects.length ? {
            next_offset: endIndex
          } : {}),
          truncated: false,
          truncation_message: undefined
        };

        let textContent: string;
        if ((params as any).response_format === 'json') {
          textContent = JSON.stringify(output, null, 2);
        } else {
          const lines = [
            `# Projects List`,
            '',
            `Found ${filteredProjects.length} projects (showing ${paginatedProjects.length})`,
            ''
          ];

          for (const p of paginatedProjects) {
            lines.push(`## ${p.name} (${p.id})`);
            lines.push(`- **Status**: ${p.status}`);
            lines.push(`- **Planned**: ${p.begin} to ${p.end}`);
            if (p.realBegan) lines.push(`- **Actual Start**: ${p.realBegan}`);
            if (p.realEnd) lines.push(`- **Actual End**: ${p.realEnd}`);
            lines.push(`- **Opened By**: ${p.openedBy} on ${p.openedDate}`);
            if (p.desc) lines.push(`- **Description**: ${p.desc}`);
            lines.push('');
          }

          textContent = lines.join('\n');

          if (textContent.length > CHARACTER_LIMIT) {
            const halfLength = Math.max(1, Math.floor(paginatedProjects.length / 2));
            const truncatedProjects = paginatedProjects.slice(0, halfLength);
            output.projects = truncatedProjects as Array<Project & { desc?: string }>;
            output.count = truncatedProjects.length;
            (output as any).truncated = true;
            (output as any).truncation_message = `Response truncated from ${paginatedProjects.length} to ${truncatedProjects.length} projects. Use 'offset' parameter or add filters to see more results.`;

            const truncatedLines = [
              `# Projects List`,
              '',
              `Found ${filteredProjects.length} projects (showing ${truncatedProjects.length})`,
              '',
              `⚠️ Response truncated. Showing first ${truncatedProjects.length} of ${paginatedProjects.length} projects.`,
              ''
            ];

            for (const p of truncatedProjects) {
              truncatedLines.push(`## ${p.name} (${p.id})`);
              truncatedLines.push(`- **Status**: ${p.status}`);
              truncatedLines.push(`- **Planned**: ${p.begin} to ${p.end}`);
              if (p.realBegan) truncatedLines.push(`- **Actual Start**: ${p.realBegan}`);
              if (p.realEnd) truncatedLines.push(`- **Actual End**: ${p.realEnd}`);
              truncatedLines.push(`- **Opened By**: ${p.openedBy} on ${p.openedDate}`);
              if (p.desc) truncatedLines.push(`- **Description**: ${p.desc}`);
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
          content: [{
            type: 'text',
            text: `Error: ${errorMessage}`
          }]
        };
      }
    }
  );
}
