import { z } from 'zod';
import {
  ResponseFormat,
  ProjectStatus,
  BugStatus,
  Severity,
  Priority,
  OrderBy
} from '../constants.js';

export const ListProjectsInputSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum results to return, between 1-100'),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of results to skip for pagination'),
  status: z.nativeEnum(ProjectStatus)
    .optional()
    .describe('Filter by project status: all/active/closed')
}).strict();

export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

export const ListBugsInputSchema = z.object({
  projectId: z.number()
    .optional()
    .describe('Project ID (uses default if not specified)'),
  status: z.nativeEnum(BugStatus)
    .optional()
    .describe('Filter by bug status: all/active/resolved/closed'),
  severity: z.nativeEnum(Severity)
    .optional()
    .describe('Filter by severity: 1-critical, 2-serious, 3-normal, 4-minor'),
  priority: z.nativeEnum(Priority)
    .optional()
    .describe('Filter by priority: 1-high, 2-medium, 3-low, 4-lowest'),
  assignedTo: z.string()
    .optional()
    .describe('Filter by assigned user account'),
  openedBy: z.string()
    .optional()
    .describe('Filter by creator user account'),
  resolution: z.string()
    .optional()
    .describe('Filter by resolution keyword'),
  startDate: z.string()
    .optional()
    .describe('Filter by creation date start (YYYY-MM-DD)'),
  endDate: z.string()
    .optional()
    .describe('Filter by creation date end (YYYY-MM-DD)'),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum results to return, between 1-100'),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of results to skip for pagination'),
  orderBy: z.nativeEnum(OrderBy)
    .optional()
    .describe('Sort order for results'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe('Output format: markdown for human-readable or json for machine-readable')
}).strict();

export type ListBugsInput = z.infer<typeof ListBugsInputSchema>;

export const GetBugDetailsInputSchema = z.object({
  bugId: z.number()
    .describe('Bug ID to retrieve'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe('Output format: markdown for human-readable or json for machine-readable')
}).strict();

export type GetBugDetailsInput = z.infer<typeof GetBugDetailsInputSchema>;
