import axios, { AxiosError } from 'axios';
import https from 'https';
import { createHash } from 'node:crypto';
import {
  ZentaoConfig,
  ProjectsResponse,
  BugsResponse,
  BugDetailResponse,
  Project,
  Bug,
  Task,
  TasksResponse,
  Story,
  StoriesResponse
} from '../types.js';
import { API_TIMEOUT, DEFAULT_TTL_SECONDS } from '../constants.js';

type ActiveApiMode = 'rest' | 'legacy';

interface LegacySession {
  name: string;
  id: string;
}

class LegacyApiRequiredError extends Error {
  constructor() {
    super('The server requires the legacy session API.');
  }
}

class ZentaoClient {
  private config: ZentaoConfig;
  private token: string | null = null;
  private legacySession: LegacySession | null = null;
  private authExpiry = 0;
  private activeApiMode: ActiveApiMode | null = null;
  private baseUrl: string;
  private axiosInstance: any;

  constructor(config: ZentaoConfig) {
    this.config = config;
    this.baseUrl = config.zentaoUrl.replace(/\/$/, '');

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    });

    this.axiosInstance = axios.create({
      httpsAgent,
      timeout: API_TIMEOUT
    });
  }

  private log(message: string, level: string = 'info'): void {
    if (this.config.logLevel === 'debug' || level === 'error') {
      console.error(`[${level.toUpperCase()}] ${message}`);
    }
  }

  private isAuthenticationExpired(): boolean {
    const hasCredential = this.activeApiMode === 'legacy' ? Boolean(this.legacySession) : Boolean(this.token);
    return !hasCredential || Date.now() >= this.authExpiry;
  }

  private isLegacyApiResponse(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const response = data as Record<string, unknown>;
    const message = String(response.errmsg ?? response.message ?? '');
    return message.includes('缺少code参数') || message.toLowerCase().includes('missing code');
  }

  private async ensureAuthentication(): Promise<void> {
    if (!this.isAuthenticationExpired()) return;

    const configuredMode = this.config.apiMode ?? 'auto';
    if (configuredMode === 'legacy') {
      await this.loginWithLegacySession();
      return;
    }
    if (configuredMode === 'rest') {
      await this.refreshRestToken();
      return;
    }

    try {
      await this.refreshRestToken();
    } catch (error) {
      if (!(error instanceof LegacyApiRequiredError)) throw error;
      this.log('RESTful API is unavailable; switching to the legacy session API.');
      await this.loginWithLegacySession();
    }
  }

  private async refreshRestToken(): Promise<void> {
    try {
      const response = await this.axiosInstance.post(
        `${this.baseUrl}/api.php/v1/tokens`,
        { account: this.config.username, password: this.config.password },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (this.isLegacyApiResponse(response.data)) throw new LegacyApiRequiredError();
      if (!response.data?.token) throw new Error(`Authentication failed: ${JSON.stringify(response.data)}`);

      this.token = response.data.token;
      this.legacySession = null;
      this.activeApiMode = 'rest';
      this.setAuthenticationExpiry();
      this.log('RESTful API authentication succeeded.');
    } catch (error) {
      if (error instanceof LegacyApiRequiredError) throw error;
      if (axios.isAxiosError(error)) {
        if (this.isLegacyApiResponse(error.response?.data)) throw new LegacyApiRequiredError();
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('AUTH_ERROR: Authentication failed. Please check your username and password.');
        }
      }
      throw error;
    }
  }

  private async loginWithLegacySession(): Promise<void> {
    try {
      const sessionResponse = await this.axiosInstance.get(`${this.baseUrl}/api-getsessionid.json`);
      const sessionData = this.unwrapLegacyResponse(sessionResponse.data, 'get session');
      const sessionName = String(sessionData.sessionName ?? 'zentaosid');
      const sessionID = String(sessionData.sessionID ?? '');
      if (!sessionID) throw new Error('Legacy session response did not include sessionID.');

      const sessionRand = sessionData.rand;
      const password = sessionRand === undefined || sessionRand === null
        ? this.config.password
        : this.md5(`${this.md5(this.config.password)}${String(sessionRand)}`);

      const form = new URLSearchParams({
        account: this.config.username,
        password,
        keepLogin: '0'
      });
      const loginResponse = await this.axiosInstance.post(
        `${this.baseUrl}/user-login.json`,
        form.toString(),
        {
          params: { [sessionName]: sessionID },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': `${sessionName}=${sessionID}`
          }
        }
      );
      this.unwrapLegacyResponse(loginResponse.data, 'login', true);

      this.token = null;
      this.legacySession = { name: sessionName, id: sessionID };
      this.activeApiMode = 'legacy';
      this.setAuthenticationExpiry();
      this.log('Legacy session authentication succeeded.');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('AUTH_ERROR:')) throw error;
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        throw new Error('AUTH_ERROR: Legacy session authentication failed. Please check your username and password.');
      }
      throw new Error(`AUTH_ERROR: Legacy session authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private setAuthenticationExpiry(): void {
    this.authExpiry = Date.now() + (this.config.ttlSeconds || DEFAULT_TTL_SECONDS) * 1000;
  }

  private md5(value: string): string {
    return createHash('md5').update(value, 'utf8').digest('hex');
  }

  private unwrapLegacyResponse(data: unknown, operation: string, allowEmptyData = false): Record<string, any> {
    let envelope: any = data;
    if (typeof envelope === 'string') {
      const trimmed = envelope.trim();
      if (trimmed.startsWith('<')) throw new Error(`Legacy ${operation} returned HTML; the session may be invalid.`);
      try {
        envelope = JSON.parse(trimmed);
      } catch {
        throw new Error(`Legacy ${operation} returned invalid JSON.`);
      }
    }
    if (!envelope || typeof envelope !== 'object') throw new Error(`Legacy ${operation} returned an empty response.`);

    const state = String(envelope.status ?? envelope.result ?? 'success').toLowerCase();
    if (state === 'fail' || state === 'failed' || state === 'error') {
      const message = envelope.message ?? envelope.reason ?? envelope.errmsg ?? 'unknown error';
      throw new Error(`AUTH_ERROR: Legacy ${operation} failed: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
    }

    if (envelope.data === undefined || envelope.data === null || envelope.data === '') {
      return allowEmptyData ? envelope : envelope;
    }
    if (typeof envelope.data === 'string') {
      try {
        return JSON.parse(envelope.data);
      } catch {
        throw new Error(`Legacy ${operation} returned invalid nested JSON.`);
      }
    }
    return envelope.data;
  }

  private getRestHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(this.token ? { token: this.token } : {})
    };
  }

  private async restRequest<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.axiosInstance.get(`${this.baseUrl}${endpoint}`, {
        params,
        headers: this.getRestHeaders()
      });
      return response.data;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  private async legacyPageRequest(path: string, operation: string): Promise<Record<string, any>> {
    if (!this.legacySession) throw new Error('AUTH_ERROR: Legacy session is not initialized.');
    try {
      const response = await this.axiosInstance.get(`${this.baseUrl}/${path}`, {
        params: {
          [this.legacySession.name]: this.legacySession.id
        },
        headers: {
          'Accept': 'application/json',
          'Cookie': `${this.legacySession.name}=${this.legacySession.id}`
        }
      });
      return this.unwrapLegacyResponse(response.data, operation);
    } catch (error) {
      this.handleApiError(error);
    }
  }

  private handleApiError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;
        if (status === 401 || status === 403) {
          this.token = null;
          this.legacySession = null;
          throw new Error('AUTH_ERROR: Authentication failed. Please check your username and password.');
        }
        if (status === 404) throw new Error('INVALID_PARAMETER: Resource not found. Please check the ID is correct.');
        if (status === 429) throw new Error('API_ERROR: Rate limit exceeded. Please wait before making more requests.');
        if (data?.message) throw new Error(`API_ERROR: ${data.message}`);
        throw new Error(`API_ERROR: API request failed with status ${status}`);
      }
      if (axiosError.code === 'ECONNABORTED') throw new Error('NETWORK_ERROR: Request timed out. Please try again.');
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        throw new Error('NETWORK_ERROR: Cannot connect to Zentao server. Please check network connection and ZENTAO_URL.');
      }
    }
    if (error instanceof Error) throw error;
    throw new Error('NETWORK_ERROR: Unexpected error occurred');
  }

  private collectionValues<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') return Object.values(value) as T[];
    return [];
  }

  private normalizeProject(value: Record<string, any>): Project {
    return {
      ...value,
      id: String(value.id ?? ''),
      name: String(value.name ?? ''),
      status: String(value.status ?? ''),
      begin: String(value.begin ?? ''),
      end: String(value.end ?? ''),
      realBegan: String(value.realBegan ?? ''),
      realEnd: String(value.realEnd ?? ''),
      openedBy: String(value.openedBy ?? ''),
      openedDate: String(value.openedDate ?? ''),
      desc: value.desc == null ? undefined : String(value.desc)
    };
  }

  private normalizeBug(value: Record<string, any>): Bug {
    const defaults: Bug = {
      id: '', project: '', product: '', title: '', severity: '', pri: '', type: '', os: '', browser: '',
      hardware: '', steps: '', status: '', subStatus: '', confirmed: '', activatedCount: '0',
      activatedDate: '', openedBy: '', openedDate: '', openedBuild: '', assignedTo: '', assignedDate: '',
      deadline: '', resolvedBy: '', resolution: '', resolvedBuild: '', resolvedDate: '', closedBy: '',
      closedDate: '', duplicateBug: '', relatedBug: '', case: '', caseVersion: '', feedback: '', result: '',
      repo: '', mr: '', entry: '', lines: '', v1: '', v2: '', repoType: '', issueKey: '', testtask: '',
      lastEditedBy: '', lastEditedDate: '', deleted: '', projectName: '', executionName: '', storyTitle: '',
      storyStatus: '', latestStoryVersion: '', taskName: '', planName: '', injectionTitle: '',
      identifyTitle: '', linkMRTitles: [], toCases: [], files: [], priOrder: '', severityOrder: '', relatedObject: 0
    };
    const bug = { ...defaults, ...value } as Bug;
    for (const key of ['id', 'project', 'product', 'severity', 'pri', 'activatedCount'] as const) {
      (bug as any)[key] = String((bug as any)[key] ?? defaults[key]);
    }
    bug.files = this.collectionValues(bug.files);
    bug.toCases = this.collectionValues(bug.toCases);
    bug.linkMRTitles = this.collectionValues(bug.linkMRTitles);
    return bug;
  }

  private normalizeTask(value: Record<string, any>): Task {
    const defaults: Task = { id: '', project: '', execution: '', parent: '', name: '', type: '', status: '', pri: '', estimate: '0', consumed: '0', left: '0', deadline: '', assignedTo: '', assignedDate: '', openedBy: '', openedDate: '', finishedBy: '', finishedDate: '', closedBy: '', closedDate: '', story: '', projectName: '' };
    const task = { ...defaults, ...value } as Task;
    for (const key of Object.keys(defaults) as Array<keyof Task>) task[key] = String(task[key] ?? defaults[key]);
    return task;
  }

  private normalizeStory(value: Record<string, any>): Story {
    const defaults: Story = { id: '', product: '', branch: '', module: '', plan: '', source: '', title: '', keywords: '', pri: '0', estimate: '0', status: '', stage: '', category: '', version: '1', openedBy: '', openedDate: '', assignedTo: '', assignedDate: '', reviewedBy: '', reviewedDate: '', closedBy: '', closedDate: '', closedReason: '', lastEditedBy: '', lastEditedDate: '', parent: '0', childStories: '', linkStories: '', duplicateStory: '' };
    const story = { ...defaults, ...value } as Story;
    for (const key of Object.keys(defaults) as Array<keyof Story>) story[key] = String(story[key] ?? defaults[key]);
    return story;
  }

  /**
   * 旧版 project-story 返回的 stories 可能是扁平数组，也可能是按产品/计划分组的嵌套对象
   * （stories[productID][storyID] = story）。这里递归展平并按 id 去重，两种形态都能正确处理。
   */
  private flattenStories(value: unknown): Story[] {
    const out: Story[] = [];
    const seen = new Set<string>();
    const walk = (node: unknown, depth: number): void => {
      if (!node || typeof node !== 'object' || depth > 4) return;
      const entries = Array.isArray(node) ? node : Object.values(node as Record<string, unknown>);
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const record = entry as Record<string, any>;
        // 需求对象一定同时带 id 和 title；分组节点两者都没有
        if (record.id !== undefined && record.title !== undefined) {
          const story = this.normalizeStory(record);
          if (!seen.has(story.id)) { seen.add(story.id); out.push(story); }
        } else {
          walk(entry, depth + 1);
        }
      }
    };
    walk(value, 0);
    return out;
  }

  async getProjects(): Promise<ProjectsResponse> {
    await this.ensureAuthentication();
    if (this.activeApiMode === 'rest') return this.restRequest<ProjectsResponse>('/api.php/v1/projects');

    const data = await this.legacyPageRequest(
      'project-all-all-0-order_desc-0-0-1000-1.json',
      'project.all'
    );
    const projects = this.collectionValues<Record<string, any>>(data.projectStats ?? data.projects)
      .map(project => this.normalizeProject(project));
    return { page: 1, total: projects.length, limit: projects.length, projects };
  }

  async getProjectBugs(projectId: number, params?: any): Promise<BugsResponse> {
    await this.ensureAuthentication();
    if (this.activeApiMode === 'rest') {
      return this.restRequest<BugsResponse>(`/api.php/v1/projects/${projectId}/bugs`, params);
    }

    const requestedCount = Number(params?.offset ?? 0) + Number(params?.limit ?? 100);
    const orderBy = encodeURIComponent(String(params?.order ?? 'id_desc'));
    const recPerPage = Math.max(100, Math.min(requestedCount, 1000));
    const data = await this.legacyPageRequest(
      `project-bug-${projectId}-${orderBy}-0-all-0-0-${recPerPage}-1.json`,
      'project.bug'
    );
    const bugs = this.collectionValues<Record<string, any>>(data.bugs).map(bug => this.normalizeBug(bug));
    return { page: 1, total: bugs.length, limit: bugs.length, bugs };
  }

  async getProjectTasks(projectId: number, params?: any): Promise<TasksResponse> {
    await this.ensureAuthentication();
    if (this.activeApiMode === 'rest') return this.restRequest<TasksResponse>(`/api.php/v1/projects/${projectId}/tasks`, params);

    const requestedCount = Number(params?.offset ?? 0) + Number(params?.limit ?? 100);
    const recPerPage = Math.max(100, Math.min(requestedCount, 1000));
    // 旧版 PATH_INFO 签名为:
    //   project-task-{项目ID}-{status}-{param}-{orderBy}-{recTotal}-{recPerPage}-{pageID}.json
    // 原实现 `-0-all-0-{recPerPage}-1` 两个错都在:status 位放了 0(无效状态 → recTotal 恒为 0、
    // 任务列表永远为空),且整体少一个参数,导致 recPerPage 被错位解析成 pageID。
    // 这里拉全部状态(status=all),状态筛选交由调用方在本地做。
    const data = await this.legacyPageRequest(`project-task-${projectId}-all-0-id_desc-0-${recPerPage}-1.json`, 'project.task');
    const topLevel = this.collectionValues<Record<string, any>>(data.tasks).map(task => this.normalizeTask(task));

    // 子任务不在列表里。project-task 只返回顶层任务：凡是有子任务的父任务，其 parent 被标为 -1
    // （普通顶层任务为 0），子任务本身既不出现在 tasks 中、也不计入那 210 条，但会计入 recTotal。
    // 实测 530: 210 顶层 + 36 子 = 246、534: 271 + 16 = 287，与 recTotal 完全吻合。
    // 子任务只能通过 task-view-{父ID}.json 的 task.children 单独取。
    const parentIds = topLevel.filter(task => Number(task.parent) === -1).map(task => task.id);
    const childLists = await Promise.all(parentIds.map(id => this.fetchTaskChildren(id)));

    const merged = new Map<string, Task>();
    for (const task of [...topLevel, ...childLists.flat()]) {
      if (task.id) merged.set(task.id, task);
    }

    // 服务端会忽略 orderBy（实测 id_desc 与 id_asc 返回完全相同的顺序），这里按 id 倒序补齐语义，
    // 保证"最新在前"是确定的，而不是听天由命。
    const tasks = [...merged.values()].sort((a, b) => Number(b.id) - Number(a.id));
    const serverRecTotal = Number(data.recTotal);
    return {
      page: 1, total: tasks.length, limit: tasks.length, tasks,
      // 供调用方判断是否仍有缺口；正常情况两者相等
      serverRecTotal: Number.isFinite(serverRecTotal) ? serverRecTotal : undefined
    };
  }

  /** 取某个父任务下的子任务。单个失败不影响主列表，返回空数组。 */
  private async fetchTaskChildren(parentId: string): Promise<Task[]> {
    try {
      const data = await this.legacyPageRequest(`task-view-${parentId}.json`, `task.view.${parentId}`);
      return this.collectionValues<Record<string, any>>(data.task?.children).map(child => this.normalizeTask(child));
    } catch {
      return [];
    }
  }

  async getProjectStories(projectId: number, params?: any): Promise<StoriesResponse> {
    await this.ensureAuthentication();
    if (this.activeApiMode === 'rest') return this.restRequest<StoriesResponse>(`/api.php/v1/projects/${projectId}/stories`, params);

    const requestedCount = Number(params?.offset ?? 0) + Number(params?.limit ?? 100);
    const recPerPage = Math.max(100, Math.min(requestedCount, 1000));
    // 旧版 PATH_INFO（实测校准）:
    //   project-story-{项目ID}-{productID}-{branch}-{browseType}-{param}-{orderBy}-{recTotal}-{recPerPage}-{pageID}.json
    // 模块名是 project 而非 product —— 本实例 product-story-* 只返回 {locate:...}（未命中路由）。
    // productID 传 0 表示由服务端按项目自动解析（响应里会回填真实产品 ID）。
    const data = await this.legacyPageRequest(`project-story-${projectId}-0-all-0-0-${recPerPage}-1.json`, 'project.story');
    const stories = this.flattenStories(data.stories);
    return { page: 1, total: stories.length, limit: stories.length, stories };
  }

  /**
   * 「我的地盘」三个页面（跨项目、按登录账号隐式过滤，无需求传 projectId）：
   *   /my-task-assignedTo.html -> my-task-assignedTo.json  指派给我的任务
   *   /my-bug.html             -> my-bug.json              指派给我的 Bug
   *   /my-story.html           -> my-story.json            指派给我的需求
   *
   * 实测约束（禅道旧版接口，逐条验证过）：
   *  1. 没有等价的 REST v1 端点，只能走 legacy。
   *  2. **路径参数和查询串都被忽略**：加 `?recPerPage=100&pageID=2` 无效，
   *     响应恒为 recPerPage=20 / pageID=1 —— 单次最多只能取到 20 条。
   *  3. 响应的 `recTotal` 恒为 0（服务端不填），真实条数必须看数组长度。
   *  4. my-task-assignedTo 的 tasks 带 `projectName`，是跨项目场景下唯一的项目名来源。
   */
  async getMyTasks(): Promise<TasksResponse> {
    const data = await this.legacyMyRequest('my-task-assignedTo.json', 'my.task');
    const tasks = this.collectionValues<Record<string, any>>(data.tasks).map(task => this.normalizeTask(task));
    return { page: 1, total: tasks.length, limit: tasks.length, tasks };
  }

  async getMyBugs(): Promise<BugsResponse> {
    const data = await this.legacyMyRequest('my-bug.json', 'my.bug');
    const bugs = this.collectionValues<Record<string, any>>(data.bugs).map(bug => this.normalizeBug(bug));
    return { page: 1, total: bugs.length, limit: bugs.length, bugs };
  }

  async getMyStories(): Promise<StoriesResponse> {
    const data = await this.legacyMyRequest('my-story.json', 'my.story');
    const stories = this.flattenStories(data.stories);
    return { page: 1, total: stories.length, limit: stories.length, stories };
  }

  private async legacyMyRequest(path: string, operation: string): Promise<Record<string, any>> {
    await this.ensureAuthentication();
    if (this.activeApiMode === 'rest') {
      throw new Error(`UNSUPPORTED_API_MODE: ${operation} 只有禅道旧版接口，没有 REST v1 等价端点。请将 ZENTAO_API_MODE 设为 auto 或 legacy。`);
    }
    return this.legacyPageRequest(path, operation);
  }

  async getBugDetails(bugId: number): Promise<BugDetailResponse> {
    await this.ensureAuthentication();
    if (this.activeApiMode === 'rest') return this.restRequest<BugDetailResponse>(`/api.php/v1/bugs/${bugId}`);

    const data = await this.legacyPageRequest(`bug-view-${bugId}.json`, 'bug.view');
    const bug = data.bug;
    if (!bug || typeof bug !== 'object') throw new Error(`INVALID_PARAMETER: Bug ${bugId} was not found.`);
    return this.normalizeBug(bug) as BugDetailResponse;
  }
}

export default ZentaoClient;
