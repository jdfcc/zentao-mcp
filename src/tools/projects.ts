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
      title: 'List Zentao Projects',
      description: `Query project lists from Zentao system with optional filtering.

This tool retrieves all projects from the Zentao project management system, with support for status filtering and pagination. It does NOT create or modify projects, only queries existing ones.

Args:
  - limit (number): Maximum results to return, between 1-100 (default: 20)
  - offset (number): Number of results to skip for pagination (default: 0)
  - status (string): Filter by project status - 'all', 'active', 'closed' (optional)

Returns:
  For JSON format: Structured data with schema:
  {
    "total": number,              // Total number of projects found
    "count": number,              // Number of results in this response
    "offset": number,             // Current pagination offset
    "projects": [
      {
        "id": string,            // Project ID
        "name": string,          // Project name
        "status": string,        // Project status (wait/doing/done/pause/closed/...)
        "begin": string,         // Planned start date (YYYY-MM-DD)
        "end": string,           // Planned end date (YYYY-MM-DD)
        "realBegan": string,      // Actual start date (YYYY-MM-DD HH:mm:ss)
        "realEnd": string,       // Actual end date (YYYY-MM-DD HH:mm:ss)
        "openedBy": string,      // Creator account
        "openedDate": string,    // Creation date (YYYY-MM-DD HH:mm:ss)
        "desc": string           // Project description
      }
    ],
    "has_more": boolean,         // Whether more results are available
    "next_offset": number        // Offset for next page (if has_more is true)
  }

Examples:
  - Use when: "List all active projects" -> params with status="active"
  - Use when: "Show first 10 projects" -> params with limit=10
  - Use when: "Get page 2 of projects" -> params with offset=20, limit=20
  - Don't use when: You need to create or modify projects

Error Handling:
  - Returns "Error: Authentication failed" if credentials are invalid
  - Returns "Error: Network connection failed" if server is unreachable
  - Returns formatted project list with pagination info on success`,
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
