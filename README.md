# Zentao MCP Server

[![npm version](https://badge.fury.io/js/@jdfcc/zentao-mcp.svg)](https://www.npmjs.com/package/@jdfcc/zentao-mcp)
[![Node.js Version](https://img.shields.io/node/v/@jdfcc/zentao-mcp.svg)](https://www.npmjs.com/package/@jdfcc/zentao-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/jdfcc/zentao-mcp/workflows/CI/badge.svg)](https://github.com/jdfcc/zentao-mcp/actions)
[![Release](https://github.com/jdfcc/zentao-mcp/workflows/Release/badge.svg)](https://github.com/jdfcc/zentao-mcp/actions)

禅道项目管理系统的 MCP (Model Context Protocol) 服务器，提供查询项目和 Bug 的工具，同时支持 Codex CLI/IDE 与 Claude Desktop/Claude Code。

## 功能特性

- 查询项目列表，支持状态过滤和分页
- 查询 Bug 列表，支持多维度过滤（项目、状态、严重程度、优先级、指派给、创建者、日期范围）
- 查询项目任务列表，支持按状态、指派人、创建人和日期筛选
- 获取 Bug 详细信息
- 自动认证和 Token 缓存（TTL 可配置）
- 支持 Markdown 和 JSON 两种响应格式
- 完整的错误处理和用户友好的错误消息
- TypeScript 类型安全
- Zod 运行时输入验证
- Codex 可读的结构化输出 schema 和安全注解

## npm 包信息

- **包名**: `@jdfcc/zentao-mcp`
- **最新版本**: [![npm version](https://badge.fury.io/js/@jdfcc/zentao-mcp.svg)](https://www.npmjs.com/package/@jdfcc/zentao-mcp)
- **许可证**: MIT
- **Node.js 要求**: >= 18
- **仓库**: https://github.com/jdfcc/zentao-mcp

## 前置要求

- Node.js 18 或更高版本
- 具有 API 访问权限的禅道实例

## 快速开始

### 方式 1: 一键安装 skill（推荐，Windows）

一条命令完成**下载 + 注册到用户级 skill 目录 + 配置向导 + 连接自检**：

```powershell
irm https://raw.githubusercontent.com/jdfcc/zentao-mcp/main/install.ps1 | iex
```

装完后 AI 工具启动时会**自动扫描到该 skill**，在**任意项目目录**下都能查询禅道——
不需要注册 MCP server，也不依赖项目内文件。

**它做了什么**

| 步骤 | 说明 |
|---|---|
| 1 | 从 GitHub Release 下载自包含安装包（含 `dist/` 与生产依赖，**用户端无需 npm install / 无需构建**） |
| 2 | 解压到 `$env:USERPROFILE\.agents\skills\zentao` |
| 3 | 把 `SKILL.md` 里的 `{{ZENTAO_SKILL_DIR}}` 占位符解析成真实绝对路径 |
| 4 | 无 `.env` 时进入配置向导（禅道地址 / 账号 / 密码 / 默认项目）；**已有 `.env` 一律保留**，升级不丢配置 |
| 5 | 写入 `.zentao-source`（版本 / 来源 / SHA256 / 安装时间） |
| 6 | 自检：真的拉起 MCP server 并拉取工具列表，连不上会明确报错而不是装完才发现 |

**重新配置**（换账号、密码过期）：

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/jdfcc/zentao-mcp/main/install.ps1))) -Configure
```

> `irm | iex` 无法直接传参，所以需要参数时用上面的 `scriptblock` 写法。也支持用环境变量做全非交互安装：
> ```powershell
> $env:ZENTAO_URL='https://zentao.example.com'; $env:ZENTAO_USERNAME='me'; $env:ZENTAO_PASSWORD='***'
> irm https://raw.githubusercontent.com/jdfcc/zentao-mcp/main/install.ps1 | iex
> ```

**离线 / 内网**：从 [Releases](https://github.com/jdfcc/zentao-mcp/releases) 下载 `zentao-skill.zip`，然后
```powershell
./install.ps1 -LocalZip .\zentao-skill.zip
```

### 方式 2: 使用 npm 包

直接使用 npx，无需安装：

```bash
npx @jdfcc/zentao-mcp
```

或全局安装：

```bash
npm install -g @jdfcc/zentao-mcp
zentao-mcp
```

### 方式 3: 从源码安装（开发调试）

#### 1. 安装依赖

```bash
npm install
```

#### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 必需配置
ZENTAO_URL=https://your-zentao-domain.com
ZENTAO_USERNAME=your-username
# 密码必须用引号包裹，否则 # 及其后内容会被当作注释
ZENTAO_PASSWORD="your-password"
ZENTAO_DEFAULT_PROJECT=1

# 可选配置
ZENTAO_API_MODE=auto
TTL_SECONDS=3600
LOG_LEVEL=info
```

##### 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ZENTAO_URL` | 禅道实例的完整 URL（需包含协议） | - |
| `ZENTAO_USERNAME` | 认证用户名 | - |
| `ZENTAO_PASSWORD` | 认证密码 | - |
| `ZENTAO_DEFAULT_PROJECT` | 默认项目 ID | - |
| `ZENTAO_API_MODE` | API 模式：auto/rest/legacy；旧版禅道使用 legacy | auto |
| `TTL_SECONDS` | Token 缓存时间（秒） | 3600 |
| `LOG_LEVEL` | 日志级别 (info/debug/error) | info |

#### 3. 编译项目

```bash
npm run build
```

#### 4. 启动服务器

**开发模式（支持自动重载）：**
```bash
npm run dev
```

**生产模式：**
```bash
npm start
```

## 测试服务器

### 使用 MCP Inspector 测试

```bash
# 启动 MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

在 Inspector 中，你可以：
- 查看所有已注册的工具
- 测试每个工具的各种参数
- 查看工具的输入/输出 schema
- 查看实际的 API 调用结果

### 测试示例

**1. 查询所有项目：**
```
Tool: zentao_list_projects
Parameters: {}
```

**2. 查询激活的项目：**
```
Tool: zentao_list_projects
Parameters: {
  "status": "active",
  "limit": 10
}
```

**3. 查询项目中的 Bug 列表：**
```
Tool: zentao_list_bugs
Parameters: {
  "projectId": 1,
  "status": "active",
  "severity": "1",
  "limit": 10,
  "response_format": "markdown"
}
```

**4. 获取特定 Bug 详情：**
```
Tool: zentao_get_bug_details
Parameters: {
  "bugId": 123,
  "response_format": "json"
}
```

**5. 查询项目任务：**
```
Tool: zentao_list_tasks
Parameters: {
  "projectId": 1,
  "assignedTo": "your-username",
  "status": "doing"
}
```

**6. 查询项目需求：**
```
Tool: zentao_list_stories
Parameters: {
  "projectId": 1,
  "status": "active",
  "stage": "developing",
  "limit": 50
}
```

**7. 查询指派给我的任务（跨项目，无需 projectId）：**
```
Tool: zentao_list_my_tasks
Parameters: {
  "status": "doing",
  "limit": 20
}
```

## 配置到 Codex

该服务器使用标准 MCP stdio 传输，Codex CLI 和 Codex IDE 扩展共享同一份 `~/.codex/config.toml` 配置。

### 方式 1：使用 Codex CLI 注册

```bash
codex mcp add zentao \
  --env ZENTAO_URL=https://your-zentao-domain.com \
  --env ZENTAO_USERNAME=your-username \
  --env ZENTAO_PASSWORD=your-password \
  --env ZENTAO_DEFAULT_PROJECT=1 \
  -- npx -y @jdfcc/zentao-mcp
```

PowerShell 中可以写成一行：

```powershell
codex mcp add zentao --env ZENTAO_URL=https://your-zentao-domain.com --env ZENTAO_USERNAME=your-username --env ZENTAO_PASSWORD=your-password --env ZENTAO_DEFAULT_PROJECT=1 -- npx -y @jdfcc/zentao-mcp
```

验证配置：

```bash
codex mcp list
```

### 方式 2：直接编辑 Codex TOML 配置

将项目中的 `codex.example.toml` 复制到 `~/.codex/config.toml`，或合并下列内容：

```toml
[mcp_servers.zentao]
command = "npx"
args = ["-y", "@jdfcc/zentao-mcp"]
startup_timeout_sec = 30
tool_timeout_sec = 60
enabled = true

[mcp_servers.zentao.env]
ZENTAO_URL = "https://your-zentao-domain.com"
ZENTAO_USERNAME = "your-username"
ZENTAO_PASSWORD = "your-password"
ZENTAO_DEFAULT_PROJECT = "1"
ZENTAO_API_MODE = "auto"
TTL_SECONDS = "3600"
LOG_LEVEL = "info"
```

Windows 上如果 Codex 找不到 `npx`，将 `command` 改为 `npx.cmd`。修改配置后重新启动 Codex 会话以重新加载工具。

### 从本地源码运行

先执行 `npm install && npm run build`，再将 `command` 和 `args` 改为：

```toml
[mcp_servers.zentao]
command = "node"
args = ["D:/path/to/zentao-mcp/dist/index.js"]
```

建议在使用该 MCP 的项目 `AGENTS.md` 中加上：

```md
当需要查询禅道项目或 Bug 时，优先使用 zentao MCP 工具。未知项目 ID 时，先调用 zentao_list_projects。
问「我的」任务/Bug/需求（指派给当前账号）时，直接用 zentao_list_my_tasks / zentao_list_my_bugs / zentao_list_my_stories，
它们跨项目、不需要 projectId；不要逐个项目去查。
```

### Codex 兼容性自测

```bash
npm run test:codex
npm run test:legacy
```

第一个测试通过 stdio 启动服务并检查 Codex 工具契约；第二个测试使用本地模拟服务验证旧版禅道自动探测、session 登录及项目/Bug 查询。两者都不会访问真实禅道数据。

需要使用本地 `.env` 对真实禅道执行只读烟雾测试时，运行：

```bash
npm run test:live
```

### 旧版禅道兼容

对不支持 `/api.php/v1/tokens` 的旧版禅道，设置 `ZENTAO_API_MODE=legacy`。服务会使用 `/api-getsessionid.json` 获取会话，通过 `/user-login.json` 登录，再调用旧版 PATH_INFO JSON 接口。`auto` 模式会在 REST 返回“缺少 code 参数”时自动切换。

## 配置到 Claude Desktop / Claude Code

### 配置文件位置:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 方式 1: 使用 npm 包（推荐）

```json
{
  "mcpServers": {
    "zentao": {
      "command": "npx",
      "args": ["-y", "@jdfcc/zentao-mcp"],
      "env": {
        "ZENTAO_URL": "https://your-zentao-domain.com",
        "ZENTAO_USERNAME": "your-username",
        "ZENTAO_PASSWORD": "your-password",
        "ZENTAO_DEFAULT_PROJECT": "1"
      }
    }
  }
}
```

**说明**:
- `npx -y` 确保自动使用最新版本
- 每次启动 Claude Desktop 时会自动检查更新

### 方式 2: 使用本地克隆（开发调试）

```json
{
  "mcpServers": {
    "zentao": {
      "command": "node",
      "args": ["D:\\path\\to\\@jdfcc/zentao-mcp\\dist\\index.js"],
      "env": {
        "ZENTAO_URL": "https://your-zentao-domain.com",
        "ZENTAO_USERNAME": "your-username",
        "ZENTAO_PASSWORD": "your-password",
        "ZENTAO_DEFAULT_PROJECT": "1"
      }
    }
  }
}
```

**macOS 路径示例**:
```json
"args": ["/Users/yourname/projects/@jdfcc/zentao-mcp/dist/index.js"]
```

**说明**: 请将路径替换为您实际的项目路径。

## 可用工具

### `zentao_list_projects`

查询项目列表，支持可选的过滤条件。

**参数：**
- `limit`: 返回结果的最大数量（默认: 20，范围: 1-100）
- `offset`: 分页偏移量（默认: 0）
- `status`: 按项目状态过滤（all/active/closed）

### `zentao_list_bugs`

查询 Bug 列表，支持多维度过滤。

**参数：**
- `projectId`: 项目 ID（如未指定则使用默认项目）
- `status`: 按状态过滤（all/active/resolved/closed）
- `severity`: 按严重程度过滤（1-严重，2-较严重，3-一般，4-轻微）
- `priority`: 按优先级过滤（1-高，2-中，3-低，4-最低）
- `assignedTo`: 按指派用户过滤
- `openedBy`: 按创建者过滤
- `startDate`: 创建日期范围起始（YYYY-MM-DD 格式）
- `endDate`: 创建日期范围结束（YYYY-MM-DD 格式）
- `limit`: 返回结果的最大数量（默认: 20，范围: 1-100）
- `offset`: 分页偏移量（默认: 0）
- `orderBy`: 排序方式（id_desc/id_asc/openedDate_desc/openedDate_asc/severity_desc/severity_asc）
- `response_format`: 输出格式（markdown/json，默认: markdown）

### `zentao_get_bug_details`

根据 Bug ID 获取详细的 Bug 信息。

**参数：**
- `bugId`: Bug ID（必需）
- `response_format`: 输出格式（markdown/json，默认: markdown）

### `zentao_list_tasks`

查询项目任务列表。

> **关于完整性**：禅道旧版的 `project-task` 接口只返回**顶层任务**，子任务不在其中（但会算进它自报的 `recTotal`）。
> 本实现会为 `parent=-1` 的父任务补拉 `task-view` 的 `children`，把子任务合并回来，并按 id 倒序输出
> （服务端实际会忽略 `orderBy`）。若合并后仍少于禅道自报的条数，结果里会带 `truncated` / `truncation_message`——
> **看到该标记即表示结果不完整**。
>
> 另注：任务关闭时禅道会把 `assignedTo` 覆写成字面量 `closed`，因此**按 `assignedTo` 过滤查不到已关闭的历史归属**。
> 要查"指派给某人的任务"，请用 `zentao_list_my_tasks`。

**参数：**
- `projectId`: 项目 ID（如未指定则使用默认项目）
- `status`: 任务状态（all/wait/doing/done/closed/cancel）
- `assignedTo`: 按指派用户过滤
- `openedBy`: 按创建者过滤
- `startDate`、`endDate`: 创建日期范围（YYYY-MM-DD）
- `limit`、`offset`: 分页参数
- `response_format`: 输出格式（markdown/json，默认: markdown）

### `zentao_list_stories`

查询项目需求（Story）列表。

**参数：**
- `projectId`: 项目 ID（如未指定则使用默认项目）
- `status`: 需求状态（all/draft/active/closed/changing/reviewing）
- `stage`: 需求阶段（all/wait/planned/projected/developing/testing/verified/released/closed）
- `assignedTo`: 按指派用户过滤
- `openedBy`: 按创建者过滤
- `keyword`: 按标题关键词过滤（不区分大小写）
- `startDate`、`endDate`: 创建日期范围（YYYY-MM-DD）
- `limit`、`offset`: 分页参数
- `response_format`: 输出格式（markdown/json，默认: markdown）

> 注：`status` / `stage` 的取值由 Zod 校验，但**筛选在本地完成**——传入合法但不存在的值不会报错，而是静默返回 0 条。

## 「我的地盘」工具（跨项目，无需 projectId）

这三个工具对应禅道的「我的地盘」页面，**按登录账号隐式过滤、跨项目**，因此都没有 `projectId` 参数。

### `zentao_list_my_tasks`

指派给我的任务（对应 `/my-task-assignedTo.html`）。

**参数：** `status`（all/wait/doing/done/closed/cancel）、`keyword`、`limit`、`offset`、`response_format`

### `zentao_list_my_bugs`

指派给我的 Bug（对应 `/my-bug.html`）。

**参数：** `status`（all/active/resolved/closed）、`severity`、`keyword`、`limit`、`offset`、`response_format`

### `zentao_list_my_stories`

指派给我的需求（对应 `/my-story.html`）。

**参数：** `status`、`stage`、`keyword`、`limit`、`offset`、`response_format`

> ⚠️ **单次最多返回 20 条，且服务端忽略分页参数**（实测 `?recPerPage=100&pageID=2` 无效，响应恒为 `recPerPage=20 / pageID=1`）。
> 返回正好 20 条时结果会带 `truncated` 标记。响应中的 `recTotal` 恒为 0，不可信——真实条数看数组长度。

## API 端点映射

| 工具 | API 端点 | 说明 |
|------|---------|------|
| zentao_list_projects | `GET /api.php/v1/projects` | 获取项目列表 |
| zentao_list_bugs | `GET /api.php/v1/projects/:projectId/bugs` | 获取项目 Bug 列表 |
| zentao_get_bug_details | `GET /api.php/v1/bugs/:bugId` | 获取 Bug 详情 |
| zentao_list_tasks | `GET /api.php/v1/projects/:projectId/tasks` | 获取项目任务 |
| zentao_list_stories | `GET /api.php/v1/projects/:projectId/stories` | 获取项目需求 |
| zentao_list_my_tasks | 仅旧版 `my-task-assignedTo.json` | 指派给我的任务（跨项目） |
| zentao_list_my_bugs | 仅旧版 `my-bug.json` | 指派给我的 Bug（跨项目） |
| zentao_list_my_stories | 仅旧版 `my-story.json` | 指派给我的需求（跨项目） |
| 认证 | `POST /api.php/v1/tokens` | 获取访问令牌 |

## 错误处理

服务器会针对不同错误类型提供清晰的错误消息：

### 认证错误
```
Error: AUTH_ERROR: Authentication failed.
Please check your username and password, or verify ZENTAO_URL is correct.
```
**解决方法：**
- 检查 `.env` 文件中的用户名和密码是否正确
- 验证 `ZENTAO_URL` 是否指向正确的禅道实例
- 确认账号没有被锁定或需要修改密码

### 网络错误
```
Error: NETWORK_ERROR: Cannot connect to Zentao server.
Please check network connection and ZENTAO_URL.
```
**解决方法：**
- 检查网络连接
- 验证 `ZENTAO_URL` 格式是否正确（需要包含协议：https:// 或 http://）
- 检查防火墙设置

### 参数错误
```
Error: INVALID_PARAMETER: Resource not found.
Please check the ID is correct.
```
**解决方法：**
- 使用 `zentao_list_projects` 查看可用的项目 ID
- 使用 `zentao_list_bugs` 查看可用的 Bug ID
- 检查日期格式是否为 YYYY-MM-DD

### API 错误
```
Error: API_ERROR: API request failed with status 500
```
**解决方法：**
- 检查禅道服务器日志
- 确认用户账号有足够的权限
- 联系系统管理员

## 常见使用场景

### 场景 1：查看所有正在进行的项目
```
Tool: zentao_list_projects
Parameters: {
  "status": "active",
  "response_format": "markdown"
}
```

### 场景 2：查看某个项目的严重 Bug
```
Tool: zentao_list_bugs
Parameters: {
  "projectId": 1,
  "severity": "1",
  "status": "active",
  "response_format": "markdown"
}
```

### 场景 3：查看我创建的 Bug
```
Tool: zentao_list_bugs
Parameters: {
  "projectId": 1,
  "openedBy": "your-username",
  "response_format": "markdown"
}
```

### 场景 4：查看某个 Bug 的详细信息
```
Tool: zentao_get_bug_details
Parameters: {
  "bugId": 123,
  "response_format": "markdown"
}
```

### 场景 5：导出 Bug 列表为 JSON（便于程序处理）
```
Tool: zentao_list_bugs
Parameters: {
  "projectId": 1,
  "limit": 100,
  "response_format": "json"
}
```

## 调试技巧

### 启用详细日志

在 `.env` 文件中设置：
```env
LOG_LEVEL=debug
```

### 查看日志

服务器会在 stderr 输出日志：
```
[INFO] Zentao MCP Server started successfully
[INFO] Connected to: https://your-zentao-domain.com
[INFO] Using username: your-username
[INFO] Default project ID: 1
[INFO] Token TTL: 3600 seconds
```

### 测试连接

手动测试 API 连接：
```bash
curl -X POST https://your-zentao-domain.com/api.php/v1/tokens \
  -H "Content-Type: application/json" \
  -d '{"account":"your-username","password":"your-password"}'
```

## 项目结构

| 文件 | 说明 |
|------|------|
| `src/index.ts` | MCP 服务器入口，配置和工具注册 |
| `src/types.ts` | TypeScript 类型定义 |
| `src/constants.ts` | 常量和枚举定义 |
| `src/schemas/tool-input-schemas.ts` | Zod 输入验证 schema |
| `src/services/zentao-client.ts` | 禅道 API 客户端，包含认证和请求逻辑 |
| `src/tools/projects.ts` | 项目查询工具实现 |
| `src/tools/bugs.ts` | Bug 查询工具实现 |
| `dist/` | 编译输出目录 |

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 清理构建产物
npm run clean
```

## 故障排除

### 服务器启动失败

1. 检查 Node.js 版本：`node --version`（需要 >= 18）
2. 检查依赖是否安装：`npm list`
3. 查看错误日志：`npm start 2>&1`

### 工具调用失败

1. 验证环境变量配置：`cat .env`
2. 测试禅道 API 连接：使用 curl 或 Postman
3. 启用调试日志：`LOG_LEVEL=debug npm start`
4. 检查 Token 是否正确获取

### 类型错误

如果遇到类型错误，运行：
```bash
npm run build
```

清理并重新安装：
```bash
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

## 提示

- **Token 缓存**：Token 会在内存中缓存 TTL_SECONDS 秒（默认 3600 秒）
- **分页**：使用 `offset` 和 `limit` 参数处理大量数据
- **格式选择**：`markdown` 适合人类阅读，`json` 适合程序处理
- **错误重试**：网络错误时会自动重试
- **字符限制**：大响应会被截断以保持响应在合理大小内（25,000 字符）

## 参考资料

- [禅道 API 文档](https://www.zentao.net/book/api/setting-369.html)
- [MCP 协议文档](https://modelcontextprotocol.io)
- [TypeScript SDK 文档](https://github.com/modelcontextprotocol/typescript-sdk)

## 许可证

MIT
