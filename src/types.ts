export interface ZentaoConfig {
  zentaoUrl: string;
  username: string;
  password: string;
  defaultProject?: string;
  ttlSeconds?: number;
  logLevel?: string;
  apiMode?: 'auto' | 'rest' | 'legacy';
}

export interface ZentaoApiResponse<T = any> {
  status: 'success' | 'fail';
  data?: T;
  message?: string;
}

// 实际禅道 API 响应格式
export interface ZentaoPagedResponse<T = any> {
  page: number;
  total: number;
  limit: number;
  [key: string]: any; // 动态键，如 'projects', 'bugs' 等
}

export interface Project {
  id: string;
  name: string;
  status: string;
  begin: string;
  end: string;
  realBegan: string;
  realEnd: string;
  openedBy: string;
  openedDate: string;
  desc?: string;
  PM?: boolean;
  PO?: string;
  QD?: string;
  RD?: string;
}

export interface Bug {
  id: string;
  project: string;
  product: string;
  title: string;
  severity: string;
  pri: string;
  type: string;
  os: string;
  browser: string;
  hardware: string;
  steps: string;
  status: string;
  subStatus: string;
  confirmed: string;
  activatedCount: string;
  activatedDate: string;
  openedBy: string;
  openedDate: string;
  openedBuild: string;
  assignedTo: string;
  assignedDate: string;
  deadline: string;
  resolvedBy: string;
  resolution: string;
  resolvedBuild: string;
  resolvedDate: string;
  closedBy: string;
  closedDate: string;
  duplicateBug: string;
  relatedBug: string;
  case: string;
  caseVersion: string;
  feedback: string;
  result: string;
  repo: string;
  mr: string;
  entry: string;
  lines: string;
  v1: string;
  v2: string;
  repoType: string;
  issueKey: string;
  testtask: string;
  lastEditedBy: string;
  lastEditedDate: string;
  deleted: string;
  projectName: string;
  executionName: string;
  storyTitle: string;
  storyStatus: string;
  latestStoryVersion: string;
  taskName: string;
  planName: string;
  injectionTitle: string;
  identifyTitle: string;
  linkMRTitles: any[];
  toCases: any[];
  files: any[];
  priOrder: string;
  severityOrder: string;
  relatedObject: number;
  execution?: string;
  plan?: string;
  story?: string;
  storyVersion?: string;
  task?: string;
  keywords?: string;
}

export interface BugListItem {
  id: string;
  title: string;
  status: string;
  severity: number;
  priority: number;
  openedDate: string;
  openedBy: string;
  assignedTo?: string;
  assignedDate?: string;
  resolvedBy?: string;
  resolution?: string;
  resolvedDate?: string;
  closedBy?: string;
  closedDate?: string;
  project: string;
  product: string;
  steps: string;
}

export interface ProjectsResponse extends ZentaoPagedResponse {
  projects: Project[];
}

export interface BugsResponse extends ZentaoPagedResponse {
  bugs: Bug[];
}

export interface Task {
  id: string;
  project: string;
  execution: string;
  parent: string;
  name: string;
  type: string;
  status: string;
  pri: string;
  estimate: string;
  consumed: string;
  left: string;
  deadline: string;
  assignedTo: string;
  assignedDate: string;
  openedBy: string;
  openedDate: string;
  finishedBy: string;
  finishedDate: string;
  closedBy: string;
  closedDate: string;
  story: string;
  /** 「我的地盘」跨项目返回时带项目名；按项目查询时通常为空 */
  projectName?: string;
}

export interface TasksResponse extends ZentaoPagedResponse {
  tasks: Task[];
  /** 服务端自报的总数。与 tasks.length 不等时说明仍有缺口（正常应相等）。 */
  serverRecTotal?: number;
}

export interface TaskListItem {
  id: string;
  name: string;
  status: string;
  priority: number;
  project: string;
  projectName?: string;
  execution: string;
  assignedTo?: string;
  assignedDate?: string;
  openedBy: string;
  openedDate: string;
  deadline?: string;
  estimate: number;
  consumed: number;
  left: number;
}

export interface PaginatedTasksOutput {
  tasks: TaskListItem[];
  total: number;
  count: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
  filters?: { projectId?: number; status?: string; assignedTo?: string; openedBy?: string; };
  truncated?: boolean;
  truncation_message?: string;
}

export interface BugDetailResponse extends Bug {
  // Bug detail API returns the bug object directly
}

export interface ListOutput<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}

export interface PaginatedProjectsOutput {
  projects: Array<Project & { desc?: string }>;
  total: number;
  count: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
  truncated?: boolean;
  truncation_message?: string;
}

export interface PaginatedBugsOutput {
  bugs: BugListItem[];
  total: number;
  count: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
  filters?: {
    projectId?: number;
    status?: string;
    severity?: number;
    priority?: number;
  };
  truncated?: boolean;
  truncation_message?: string;
}

// ── 需求（Story）──

export interface Story {
  id: string;
  product: string;
  branch: string;
  module: string;
  plan: string;
  source: string;
  title: string;
  keywords: string;
  pri: string;
  estimate: string;
  status: string;
  stage: string;
  category: string;
  version: string;
  openedBy: string;
  openedDate: string;
  assignedTo: string;
  assignedDate: string;
  reviewedBy: string;
  reviewedDate: string;
  closedBy: string;
  closedDate: string;
  closedReason: string;
  lastEditedBy: string;
  lastEditedDate: string;
  parent: string;
  childStories: string;
  linkStories: string;
  duplicateStory: string;
}

export interface StoriesResponse extends ZentaoPagedResponse {
  stories: Story[];
}

export interface StoryListItem {
  id: string;
  title: string;
  status: string;
  stage: string;
  priority: number;
  category: string;
  estimate: number;
  product: string;
  openedBy: string;
  openedDate: string;
  assignedTo?: string;
  version: string;
}

export interface PaginatedStoriesOutput {
  stories: StoryListItem[];
  total: number;
  count: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
  filters?: { projectId?: number; status?: string; stage?: string; assignedTo?: string; openedBy?: string };
  truncated?: boolean;
  truncation_message?: string;
}
