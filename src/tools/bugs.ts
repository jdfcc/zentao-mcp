import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import ZentaoClient from '../services/zentao-client.js';
import { ListBugsInputSchema, GetBugDetailsInputSchema, type ListBugsInput, type GetBugDetailsInput } from '../schemas/tool-input-schemas.js';
import { Bug, BugListItem, PaginatedBugsOutput } from '../types.js';
import { CHARACTER_LIMIT } from '../constants.js';

export function registerBugTools(server: McpServer, zentaoClient: ZentaoClient, defaultProjectId?: string) {
  server.registerTool(
    'zentao_list_bugs',
    {
      title: 'List Zentao Bugs',
      description: `Query bug lists from Zentao with comprehensive multi-dimensional filtering.

This tool retrieves bugs from Zentao with support for filtering by project, status, severity, priority, assigned user, creator, date range, and more. It supports pagination and multiple output formats. It does NOT create or modify bugs, only queries existing ones.

Args:
  - projectId (number): Project ID (uses default if not specified)
  - status (string): Filter by bug status - 'all', 'active', 'resolved', 'closed' (default: all)
  - severity (string): Filter by severity - '1' (critical), '2' (serious), '3' (normal), '4' (minor)
  - priority (string): Filter by priority - '1' (high), '2' (medium), '3' (low), '4' (lowest)
  - assignedTo (string): Filter by assigned user account
  - openedBy (string): Filter by creator user account
  - resolution (string): Filter by resolution keyword
  - startDate (string): Filter by creation date start (YYYY-MM-DD format)
  - endDate (string): Filter by creation date end (YYYY-MM-DD format)
  - limit (number): Maximum results to return, between 1-100 (default: 20)
  - offset (number): Number of results to skip for pagination (default: 0)
  - orderBy (string): Sort order for results
  - response_format (string): Output format - 'markdown' for human-readable or 'json' for machine-readable (default: markdown)

Returns:
  For JSON format: Structured data with schema:
  {
    "bugs": [
      {
        "id": string,              // Bug ID
        "title": string,           // Bug title
        "status": string,           // Bug status (active/resolved/closed/...)
        "severity": number,         // Severity (1-4)
        "priority": number,         // Priority (1-4)
        "openedDate": string,       // Creation date (YYYY-MM-DD HH:mm:ss)
        "openedBy": string,         // Creator account
        "assignedTo": string,       // Assigned user account
        "assignedDate": string,     // Assignment date
        "resolvedBy": string,       // Resolver account
        "resolution": string,       // Resolution description
        "resolvedDate": string,     // Resolution date
        "closedBy": string,         // Closer account
        "closedDate": string,       // Close date
        "project": string,          // Project ID
        "product": string,          // Product ID
        "steps": string            // Reproduction steps
      }
    ],
    "total": number,              // Total number of matching bugs
    "count": number,              // Number of bugs in this response
    "offset": number,             // Current pagination offset
    "has_more": boolean,           // Whether more results are available
    "next_offset": number,        // Offset for next page (if has_more is true)
    "filters": {                  // Applied filters for reference
      "projectId": number,
      "status": string,
      "severity": number,
      "priority": number
    }
  }

Examples:
  - Use when: "List all bugs in project 1" -> params with projectId=1
  - Use when: "Show only active bugs" -> params with status="active"
  - Use when: "Show critical severity bugs" -> params with severity="1"
  - Use when: "Show bugs assigned to user john" -> params with assignedTo="john"
  - Use when: "Show bugs from last week" -> params with startDate="2024-01-15", endDate="2024-01-22"

Error Handling:
  - Returns "Error: Project not found" if projectId is invalid
  - Returns "Error: Authentication failed" if credentials are invalid
  - Returns formatted bug list with pagination info on success`,
      inputSchema: ListBugsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ListBugsInput) => {
      try {
        const projectId = params.projectId || (defaultProjectId ? parseInt(defaultProjectId) : undefined);
        
        if (!projectId) {
          return {
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
      title: 'Get Zentao Bug Details',
      description: `Retrieve detailed information about a specific bug by its ID.

This tool fetches complete bug information from Zentao including title, description, steps, status, assignment history, resolution details, and related metadata. It does NOT create or modify bugs, only queries existing ones.

Args:
  - bugId (number): Bug ID to retrieve (required)
  - response_format (string): Output format - 'markdown' for human-readable or 'json' for machine-readable (default: markdown)

Returns:
  For JSON format: Structured data with complete bug information including:
  - id, title, status, severity, priority, type
  - Opened information (by, date, build)
  - Assignment details (assignedTo, assignedDate, deadline)
  - Resolution information (resolvedBy, resolution, resolvedBuild, resolvedDate)
  - Closing information (closedBy, closedDate)
  - Related objects (project, product, execution, plan, story, task)
  - Steps, expected result, actual result
  - Attachments and comments
  - Last edited information

Examples:
  - Use when: "Get details for bug 12345" -> params with bugId=12345
  - Use when: "Show me bug #54321 in JSON format" -> params with bugId=54321, response_format='json'

Error Handling:
  - Returns "Error: Bug not found" if bugId is invalid
  - Returns "Error: Authentication failed" if credentials are invalid
  - Returns complete bug details on success`,
      inputSchema: GetBugDetailsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
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
          content: [{
            type: 'text',
            text: `Error: ${errorMessage}`
          }]
        };
      }
    }
  );
}
