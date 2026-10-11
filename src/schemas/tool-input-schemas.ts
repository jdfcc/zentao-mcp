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
    .describe('返回的最大结果数,范围 1-100'),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe('分页跳过的结果数'),
  status: z.nativeEnum(ProjectStatus)
    .optional()
    .describe('按项目状态筛选: all(全部)/active(进行中)/closed(已关闭)'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

export const ListBugsInputSchema = z.object({
  projectId: z.number()
    .optional()
    .describe('项目 ID (如未指定则使用默认值)'),
  status: z.nativeEnum(BugStatus)
    .optional()
    .describe('按 Bug 状态筛选: all(全部)/active(活跃)/resolved(已解决)/closed(已关闭)'),
  severity: z.nativeEnum(Severity)
    .optional()
    .describe('按严重程度筛选: 1-致命, 2-严重, 3-一般, 4-轻微'),
  priority: z.nativeEnum(Priority)
    .optional()
    .describe('按优先级筛选: 1-高, 2-中, 3-低, 4-最低'),
  assignedTo: z.string()
    .optional()
    .describe('按指派用户账号筛选'),
  openedBy: z.string()
    .optional()
    .describe('按创建者用户账号筛选'),
  resolution: z.string()
    .optional()
    .describe('按解决方案关键词筛选'),
  startDate: z.string()
    .optional()
    .describe('按创建开始日期筛选 (YYYY-MM-DD)'),
  endDate: z.string()
    .optional()
    .describe('按创建结束日期筛选 (YYYY-MM-DD)'),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('返回的最大结果数,范围 1-100'),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe('分页跳过的结果数'),
  orderBy: z.nativeEnum(OrderBy)
    .optional()
    .describe('结果排序方式'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type ListBugsInput = z.infer<typeof ListBugsInputSchema>;

export const GetBugDetailsInputSchema = z.object({
  bugId: z.number()
    .describe('要检索的 Bug ID'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type GetBugDetailsInput = z.infer<typeof GetBugDetailsInputSchema>;


export const ListTasksInputSchema = z.object({
  projectId: z.number().optional().describe('项目 ID (如未指定则使用默认值)'),
  status: z.enum(['all', 'wait', 'doing', 'done', 'closed', 'cancel']).optional().describe('按任务状态筛选'),
  assignedTo: z.string().optional().describe('按指派用户账号筛选'),
  openedBy: z.string().optional().describe('按创建者用户账号筛选'),
  startDate: z.string().optional().describe('按创建开始日期筛选 (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('按创建结束日期筛选 (YYYY-MM-DD)'),
  limit: z.number().int().min(1).max(100).default(20).describe('返回的最大结果数,范围 1-100'),
  offset: z.number().int().min(0).default(0).describe('分页跳过的结果数'),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;

export const ListStoriesInputSchema = z.object({
  projectId: z.number().optional().describe('项目 ID (如未指定则使用默认值)'),
  status: z.enum(['all', 'draft', 'active', 'closed', 'changing', 'reviewing']).optional().describe('按需求状态筛选'),
  stage: z.enum(['all', 'wait', 'planned', 'projected', 'developing', 'testing', 'verified', 'released', 'closed']).optional().describe('按需求阶段筛选'),
  assignedTo: z.string().optional().describe('按指派用户账号筛选'),
  openedBy: z.string().optional().describe('按创建者用户账号筛选'),
  keyword: z.string().optional().describe('按标题关键词筛选 (不区分大小写)'),
  startDate: z.string().optional().describe('按创建开始日期筛选 (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('按创建结束日期筛选 (YYYY-MM-DD)'),
  limit: z.number().int().min(1).max(100).default(20).describe('返回的最大结果数,范围 1-100'),
  offset: z.number().int().min(0).default(0).describe('分页跳过的结果数'),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type ListStoriesInput = z.infer<typeof ListStoriesInputSchema>;

// ── 「我的地盘」：跨项目、按登录账号隐式过滤，因此都没有 projectId ──
// 注意：底层接口单次最多返回 20 条（分页参数被服务端忽略），见 zentao-client 里的说明。

export const ListMyTasksInputSchema = z.object({
  status: z.enum(['all', 'wait', 'doing', 'done', 'closed', 'cancel']).optional().describe('按任务状态筛选'),
  keyword: z.string().optional().describe('按任务名称关键词筛选 (不区分大小写)'),
  limit: z.number().int().min(1).max(100).default(20).describe('返回的最大结果数,范围 1-100'),
  offset: z.number().int().min(0).default(0).describe('分页跳过的结果数'),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type ListMyTasksInput = z.infer<typeof ListMyTasksInputSchema>;

export const ListMyBugsInputSchema = z.object({
  status: z.enum(['all', 'active', 'resolved', 'closed']).optional().describe('按 Bug 状态筛选'),
  severity: z.nativeEnum(Severity).optional().describe('按严重程度筛选,必须是字符串 "1"~"4"'),
  keyword: z.string().optional().describe('按 Bug 标题关键词筛选 (不区分大小写)'),
  limit: z.number().int().min(1).max(100).default(20).describe('返回的最大结果数,范围 1-100'),
  offset: z.number().int().min(0).default(0).describe('分页跳过的结果数'),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type ListMyBugsInput = z.infer<typeof ListMyBugsInputSchema>;

export const ListMyStoriesInputSchema = z.object({
  status: z.enum(['all', 'draft', 'active', 'closed', 'changing', 'reviewing']).optional().describe('按需求状态筛选'),
  stage: z.enum(['all', 'wait', 'planned', 'projected', 'developing', 'testing', 'verified', 'released', 'closed']).optional().describe('按需求阶段筛选'),
  keyword: z.string().optional().describe('按需求标题关键词筛选 (不区分大小写)'),
  limit: z.number().int().min(1).max(100).default(20).describe('返回的最大结果数,范围 1-100'),
  offset: z.number().int().min(0).default(0).describe('分页跳过的结果数'),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN).describe('输出格式: markdown 供人类阅读或 json 供机器读取')
}).strict();

export type ListMyStoriesInput = z.infer<typeof ListMyStoriesInputSchema>;
