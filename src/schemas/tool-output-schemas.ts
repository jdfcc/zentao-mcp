import { z } from 'zod';

const ProjectOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  begin: z.string(),
  end: z.string(),
  realBegan: z.string(),
  realEnd: z.string(),
  openedBy: z.string(),
  openedDate: z.string(),
  desc: z.string().optional()
});

export const ListProjectsOutputSchema = z.object({
  total: z.number(),
  count: z.number(),
  offset: z.number(),
  projects: z.array(ProjectOutputSchema),
  has_more: z.boolean(),
  next_offset: z.number().optional(),
  truncated: z.boolean().optional(),
  truncation_message: z.string().optional()
});

const BugListItemOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  severity: z.number(),
  priority: z.number(),
  openedDate: z.string(),
  openedBy: z.string(),
  assignedTo: z.string().optional(),
  assignedDate: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolution: z.string().optional(),
  resolvedDate: z.string().optional(),
  closedBy: z.string().optional(),
  closedDate: z.string().optional(),
  project: z.string(),
  product: z.string(),
  steps: z.string()
});

export const ListBugsOutputSchema = z.object({
  bugs: z.array(BugListItemOutputSchema),
  total: z.number(),
  count: z.number(),
  offset: z.number(),
  has_more: z.boolean(),
  next_offset: z.number().optional(),
  filters: z.object({
    projectId: z.number().optional(),
    status: z.string().optional(),
    severity: z.number().optional(),
    priority: z.number().optional()
  }).optional(),
  truncated: z.boolean().optional(),
  truncation_message: z.string().optional()
});

const RelatedObjectOutputSchema = z.object({
  id: z.string(),
  name: z.string().nullish()
});

// 禅道在「关联对象已删除 / 无权限 / 字段从未填写」时，会把本该是字符串的字段返回 null。
// Bug 详情是原样透传的，所以这里对 null 一律放行——否则整个工具会在 MCP 输出校验阶段
// 直接失败（实测 Bug 77809：plan.name / story.title / story.status / story.latestVersion
// / task.name 全为 null，导致 zentao_get_bug_details 完全不可用）。
const DetailStr = z.string().nullish();
const DetailNum = z.number().nullish();

export const GetBugDetailsOutputSchema = z.object({
  bug: z.object({
    id: z.string(),
    title: z.string(),
    status: DetailStr,
    severity: DetailNum,
    priority: DetailNum,
    type: DetailStr,
    os: DetailStr,
    browser: DetailStr,
    hardware: DetailStr,
    steps: DetailStr,
    confirmed: DetailStr,
    activatedCount: DetailNum,
    activatedDate: DetailStr,
    openedBy: DetailStr,
    openedDate: DetailStr,
    openedBuild: DetailStr,
    assignedTo: DetailStr,
    assignedDate: DetailStr,
    deadline: DetailStr,
    resolvedBy: DetailStr,
    resolution: DetailStr,
    resolvedBuild: DetailStr,
    resolvedDate: DetailStr,
    closedBy: DetailStr,
    closedDate: DetailStr,
    duplicateBug: DetailStr,
    relatedBug: DetailStr,
    case: DetailStr,
    caseVersion: DetailStr,
    project: RelatedObjectOutputSchema,
    product: RelatedObjectOutputSchema,
    execution: RelatedObjectOutputSchema.optional(),
    plan: RelatedObjectOutputSchema.optional(),
    story: z.object({
      id: z.string(),
      title: DetailStr,
      version: DetailStr,
      status: DetailStr,
      latestVersion: DetailStr
    }).nullish(),
    task: RelatedObjectOutputSchema.optional(),
    lastEditedBy: DetailStr,
    lastEditedDate: DetailStr,
    files: z.array(z.unknown()),
    keywords: DetailStr
  })
});

const TaskListItemOutputSchema = z.object({
  id: z.string(), name: z.string(), status: z.string(), priority: z.number(),
  project: z.string(), projectName: z.string().optional(), execution: z.string(), assignedTo: z.string().optional(),
  assignedDate: z.string().optional(), openedBy: z.string(), openedDate: z.string(),
  deadline: z.string().optional(), estimate: z.number(), consumed: z.number(), left: z.number()
});

export const ListTasksOutputSchema = z.object({
  tasks: z.array(TaskListItemOutputSchema), total: z.number(), count: z.number(),
  offset: z.number(), has_more: z.boolean(), next_offset: z.number().optional(),
  filters: z.object({ projectId: z.number().optional(), status: z.string().optional(), assignedTo: z.string().optional(), openedBy: z.string().optional() }).optional(),
  truncated: z.boolean().optional(), truncation_message: z.string().optional()
});

const StoryListItemOutputSchema = z.object({
  id: z.string(), title: z.string(), status: z.string(), stage: z.string(),
  priority: z.number(), category: z.string(), estimate: z.number(),
  product: z.string(), openedBy: z.string(), openedDate: z.string(),
  assignedTo: z.string().optional(), version: z.string()
});

export const ListStoriesOutputSchema = z.object({
  stories: z.array(StoryListItemOutputSchema), total: z.number(), count: z.number(),
  offset: z.number(), has_more: z.boolean(), next_offset: z.number().optional(),
  filters: z.object({ projectId: z.number().optional(), status: z.string().optional(), stage: z.string().optional(), assignedTo: z.string().optional(), openedBy: z.string().optional() }).optional(),
  truncated: z.boolean().optional(), truncation_message: z.string().optional()
});
