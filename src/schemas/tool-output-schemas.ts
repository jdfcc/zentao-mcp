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
  name: z.string().optional()
});

export const GetBugDetailsOutputSchema = z.object({
  bug: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    severity: z.number(),
    priority: z.number(),
    type: z.string(),
    os: z.string(),
    browser: z.string(),
    hardware: z.string(),
    steps: z.string(),
    confirmed: z.string(),
    activatedCount: z.number(),
    activatedDate: z.string(),
    openedBy: z.string(),
    openedDate: z.string(),
    openedBuild: z.string(),
    assignedTo: z.string().optional(),
    assignedDate: z.string().optional(),
    deadline: z.string().optional(),
    resolvedBy: z.string().optional(),
    resolution: z.string().optional(),
    resolvedBuild: z.string().optional(),
    resolvedDate: z.string().optional(),
    closedBy: z.string().optional(),
    closedDate: z.string().optional(),
    duplicateBug: z.string().optional(),
    relatedBug: z.string().optional(),
    case: z.string().optional(),
    caseVersion: z.string().optional(),
    project: RelatedObjectOutputSchema,
    product: RelatedObjectOutputSchema,
    execution: RelatedObjectOutputSchema.optional(),
    plan: RelatedObjectOutputSchema.optional(),
    story: z.object({
      id: z.string(),
      title: z.string(),
      version: z.string().optional(),
      status: z.string(),
      latestVersion: z.string()
    }).optional(),
    task: RelatedObjectOutputSchema.optional(),
    lastEditedBy: z.string(),
    lastEditedDate: z.string(),
    files: z.array(z.unknown()),
    keywords: z.string().optional()
  })
});

const TaskListItemOutputSchema = z.object({
  id: z.string(), name: z.string(), status: z.string(), priority: z.number(),
  project: z.string(), execution: z.string(), assignedTo: z.string().optional(),
  assignedDate: z.string().optional(), openedBy: z.string(), openedDate: z.string(),
  deadline: z.string().optional(), estimate: z.number(), consumed: z.number(), left: z.number()
});

export const ListTasksOutputSchema = z.object({
  tasks: z.array(TaskListItemOutputSchema), total: z.number(), count: z.number(),
  offset: z.number(), has_more: z.boolean(), next_offset: z.number().optional(),
  filters: z.object({ projectId: z.number().optional(), status: z.string().optional(), assignedTo: z.string().optional(), openedBy: z.string().optional() }).optional(),
  truncated: z.boolean().optional(), truncation_message: z.string().optional()
});
