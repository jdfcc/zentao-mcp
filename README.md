# Zentao MCP Server

[![npm version](https://badge.fury.io/js/@jdfcc/zentao-mcp.svg)](https://www.npmjs.com/package/@jdfcc/zentao-mcp)
[![Node.js Version](https://img.shields.io/node/v/@jdfcc/zentao-mcp.svg)](https://www.npmjs.com/package/@jdfcc/zentao-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/jdfcc/zentao-mcp/workflows/CI/badge.svg)](https://github.com/jdfcc/zentao-mcp/actions)
[![Release](https://github.com/jdfcc/zentao-mcp/workflows/Release/badge.svg)](https://github.com/jdfcc/zentao-mcp/actions)

禅道项目管理系统的 MCP (Model Context Protocol) 服务器，提供 **8 个只读查询工具**，覆盖项目、Bug、任务、需求，以及跨项目的「我的地盘」（指派给我的任务 / Bug / 需求）。同时支持 Codex CLI/IDE 与 Claude Desktop/Claude Code。

## 功能特性

| 工具 | 说明 |
|------|------|
| `zentao_list_projects` | 项目列表，支持状态过滤和分页 |
| `zentao_list_bugs` | Bug 列表，多维度过滤（项目、状态、严重程度、优先级、指派给、创建者、解决方式、日期范围） |
| `zentao_get_bug_details` | Bug 详情（含关联的产品/项目/执行/需求/任务） |
| `zentao_list_tasks` | 项目任务列表，支持状态、指派人、创建人、日期筛选 |
| `zentao_list_stories` | 项目需求列表，支持状态、阶段、关键词筛选 |
| `zentao_list_my_tasks` | **指派给我的任务**（跨项目，对应「我的地盘」） |
| `zentao_list_my_bugs` | **指派给我的 Bug**（跨项目） |
| `zentao_list_my_stories` | **指派给我的需求**（跨项目） |

其他特性：

- **双 API 模式**：优先走 REST v1（`api.php/v1`），实例不支持时自动回退到旧版 session 接口——同一份配置既能连新版禅道也能连旧版
- **子任务补全**：旧版 `project-task` 接口只返回顶层任务，本实现会补拉 `task-view` 的 `children` 合并回来
- **截断标记**：结果不完整时返回 `truncated` / `truncation_message`，而不是静默少给数据
- 自动认证和会话缓存（TTL 可配置）
- 支持 Markdown 和 JSON 两种响应格式
- 完整的错误处理和用户友好的错误消息
- TypeScript 类型安全 + Zod 运行时输入验证
- 结构化输出 schema 和只读安全注解（`readOnlyHint: true`），便于客户端做权限判断

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

> ⚠️ 本方式**必须显式提供环境变量**——npx 装出来的包里**没有 `.env`**
> （`dist/../.env` 指向 `node_modules` 内部，那里不存在这个文件）。这是它与方式 1 的关键区别。

直接使用 npx，无需安装：

```bash
ZENTAO_URL=https://your-zentao-domain.com \
ZENTAO_USERNAME=your-username \
ZENTAO_PASSWORD=your-password \
ZENTAO_DEFAULT_PROJECT=1 \
npx -y @jdfcc/zentao-mcp
```

或全局安装：

```bash
npm install -g @jdfcc/zentao-mcp
zentao-mcp
```

`-y` 跳过 npx 的安装确认，**在 MCP 宿主里必须加**，否则首次启动会卡在交互提示上。

实际使用时不必手敲这些变量——交给宿主工具通过 MCP 配置注入即可，参见下方
「配置到 Codex」方式 2 与「配置到 Claude Desktop」方式 1。

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

> **两种都可用**。方式 1 指向本地已构建的代码，凭据放 `.env`、无需传 `--env`；
> 方式 2 从 npm 拉取，**必须显式传 `--env`**（包里没有 `.env`）。

### 方式 1：指向本地构建（推荐，不依赖 npm 发布）

```powershell
codex mcp add zentao -- node D:\zendao\zentao-mcp\dist\index.js
```

**不需要传 `--env`。** 只要 `.env` 位于 `dist/` 的上一级（即仓库根目录），server 启动时会自己读它。
凭据放 `.env` 比写进 `config.toml` 更稳妥——`config.toml` 常被同步或备份，而 `.env` 已在 `.gitignore` 里；
安装脚本写出的 `.env` 也是同样的布局，所以也可以直接指向 skill 安装目录：

```powershell
codex mcp add zentao -- node "$env:USERPROFILE\.agents\skills\zentao\dist\index.js"
```

等价的手工 TOML（`~/.codex/config.toml`）：

```toml
[mcp_servers.zentao]
command = "node"
args = ['D:\zendao\zentao-mcp\dist\index.js']
enabled = true
```

> **Windows 路径务必用单引号**。TOML 的单引号是字面量字符串、不解析转义；
> 写成双引号时 `\z`、`\d` 之类会被当转义序列而报错（或必须写成 `\\`）。
> 另外 `args` 是数组，换行书写时别忘了方括号要成对——只留下 `['...']` 一行会变成
> 一个孤立的表头，配置能解析但内容不是你以为的那样。

### 方式 2：使用 Codex CLI 注册（npx）

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

### 方式 3：直接编辑 Codex TOML 配置

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

### 验证注册是否真的生效

```bash
npm run test:mcp
```

MCP 宿主（Codex / Claude Desktop）只声明 `command` 和 `args`，**不会设置工作目录**——
子进程继承宿主的当前目录。而 `.env` 是靠 `dist/../.env` 这条相对路径读到的，
所以这段逻辑一旦被改坏，症状是「在仓库里能用、一进别的项目就报缺环境变量」。
该脚本从若干个互不相关的目录各拉起一次 server，把这个失败模式钉死。

排查已注册的 server 是否正常，也可以直接看 Codex 侧的状态：

```bash
codex mcp list      # Status 应为 enabled
```

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

### 全量端到端测试（E2E）

```bash
npm run test:e2e
```

与上面几个测试的分工不同——**它验证的是用户实际走的那条路径**：

| | 验证对象 | 调用方式 |
|---|---|---|
| `test:codex` / `test:legacy` | 工具契约、旧版禅道协议 | 模拟服务，不碰真实禅道 |
| `test:live` | 客户端类逻辑 | 直接 `import` 客户端类 |
| **`test:e2e`** | **装好之后到底能不能用** | **通过 `mcp-cli.mjs` 以原生 MCP 协议调用** |

因此它会覆盖 `test:live` 覆盖不到的一层：stdio 握手 → 输入 schema 校验 → 真实 HTTP → **输出 schema 校验** → markdown/JSON 渲染。历史上 `zentao_get_bug_details` 正是因为关联对象名称为 `null` 撞上输出 schema，**整个工具在 MCP 层直接报 -32602 而完全不可用**，而 `test:live` 因为是直接调客户端类、绕过了输出校验，一直显示通过。

覆盖全部 8 个工具，外加过滤、分页、排序、错误路径和跨项目不变量，共 24 个用例（约 90 秒，每个用例独立登录一次）。

默认测试**已安装的 skill**（`~\.agents\skills\zentao`），并从临时目录启动以验证 cwd 无关性；也可指定其它安装位置：

```bash
# PowerShell
$env:ZENTAO_CLI = "D:\some\mcp-cli.mjs"; npm run test:e2e
```

> 该脚本随安装包一起分发，所以用户报「用不了」时可以直接跑
> `node "$env:USERPROFILE\.agents\skills\zentao\test-e2e.mjs"` 定位问题，无需回到仓库。

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
- `-y` 跳过 npx 的安装确认，**在 MCP 宿主里必须加**，否则首次启动会卡在交互提示上
- npx 会把包装进自己的缓存（`~/.npm/_npx`）并在后续启动时**复用**，**不会每次检查更新**。
  想升级请指定版本（`@jdfcc/zentao-mcp@1.3.3`）或用 `npm i -g` 后指向全局安装路径

### 方式 2: 使用本地克隆（开发调试）

```json
{
  "mcpServers": {
    "zentao": {
      "command": "node",
      "args": ["D:\\zendao\\zentao-mcp\\dist\\index.js"],
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

> 这里的 `args` 是**文件系统路径**，指向你克隆下来的仓库，别把包名 `@jdfcc/zentao-mcp` 混进去。
> 若指向的是带 `.env` 的本地仓库，`env` 块可以整个省略（server 会自己读 `dist/` 上一级的 `.env`）。

**macOS 路径示例**:
```json
"args": ["/Users/yourname/projects/zentao-mcp/dist/index.js"]
```

**说明**: 请将路径替换为您实际的项目路径。

## 可用工具

### `zentao_list_projects`

查询项目列表，支持可选的过滤条件。

**参数：**
- `limit`: 返回结果的最大数量（默认: 20，范围: 1-100）
- `offset`: 分页偏移量（默认: 0）
- `status`: 按项目状态过滤（all/active/closed）
- `response_format`: 输出格式（markdown/json，默认: markdown）

> 旧版接口一次取回全部项目后在本地分页，因此 `limit`/`offset` 对服务端不产生请求参数。

### `zentao_list_bugs`

查询 Bug 列表，支持多维度过滤。

**参数：**
- `projectId`: 项目 ID（如未指定则使用默认项目）
- `status`: 按状态过滤（all/active/resolved/closed）
- `severity`: 按严重程度过滤（1-严重，2-较严重，3-一般，4-轻微）
- `priority`: 按优先级过滤（1-高，2-中，3-低，4-最低）
- `assignedTo`: 按指派用户过滤
- `openedBy`: 按创建者过滤
- `resolution`: 按解决方案过滤（如 fixed/duplicate/bydesign/postponed/wontfix/notrepro）
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

本服务器有**两套后端**，由 `ZENTAO_API_MODE` 控制：

| 模式 | 行为 |
|------|------|
| `auto`（默认） | 先试 REST v1；实例返回「缺少code参数」时自动切换到旧版 session 接口 |
| `rest` | 只用 REST v1。旧版禅道没有这些端点，`my-*` 三个工具会直接报 `UNSUPPORTED_API_MODE` |
| `legacy` | 只用旧版 session 接口。适用于老版本禅道 |

认证方式随之切换：

| 模式 | 认证 |
|------|------|
| REST | `POST /api.php/v1/tokens`，body 为 `{account, password}`，返回 `token`，后续请求放 `token` 请求头 |
| 旧版 | `GET /api-getsessionid.json` 取 `sessionID` 与 `rand`，再 `POST /user-login.json`，密码为 `md5(md5(密码) + rand)` |

各工具的端点：

| 工具 | REST v1 | 旧版 |
|------|---------|------|
| zentao_list_projects | `GET /api.php/v1/projects` | `project-all-all-0-order_desc-0-0-1000-1.json` |
| zentao_list_bugs | `GET /api.php/v1/projects/{id}/bugs` | `project-bug-{id}-{orderBy}-0-all-0-0-{recPerPage}-1.json` |
| zentao_get_bug_details | `GET /api.php/v1/bugs/{id}` | `bug-view-{id}.json` |
| zentao_list_tasks | `GET /api.php/v1/projects/{id}/tasks` | `project-task-{id}-all-0-id_desc-0-{recPerPage}-1.json` |
| ↳ 子任务补拉 | 无（REST 已含子任务） | `task-view-{父任务ID}.json` 取其中的 `children` |
| zentao_list_stories | `GET /api.php/v1/projects/{id}/stories` | `project-story-{id}-0-all-0-0-{recPerPage}-1.json` |
| zentao_list_my_tasks | **无对应端点** | `my-task-assignedTo.json` |
| zentao_list_my_bugs | **无对应端点** | `my-bug.json` |
| zentao_list_my_stories | **无对应端点** | `my-story.json` |

旧版 URL 的构成规则是 `{module}-{method}-{参数...}-{recTotal}-{recPerPage}-{pageID}.json`，
末尾三段固定是分页元信息。旧版响应统一包在 `{status, data}` 信封里，`data` 可能是**被转义的 JSON 字符串**，需要二次解析。

> **`my-*` 三个工具只有旧版实现**——禅道 REST v1 没有「我的地盘」等价端点。
> 所以把 `ZENTAO_API_MODE` 设成 `rest` 会让这三个工具不可用（默认的 `auto` 不受影响）。

## 错误处理

服务器会针对不同错误类型提供清晰的错误消息：

### 认证错误
```
AUTH_ERROR: Authentication failed. Please check your username and password.
AUTH_ERROR: Legacy session authentication failed. Please check your username and password.
```
**解决方法：**
- 检查 `.env` 文件中的用户名和密码是否正确
- 验证 `ZENTAO_URL` 是否指向正确的禅道实例
- 确认账号没有被锁定或需要修改密码

> 密码里含 `#`、空格等字符时**必须用引号包裹**（`ZENTAO_PASSWORD="Lwyf!@#2024"`），
> 否则 `#` 之后的内容会被 dotenv 当作注释截断，表现为「密码明明是对的却认证失败」。

### 网络错误
```
NETWORK_ERROR: Cannot connect to Zentao server. Please check network connection and ZENTAO_URL.
NETWORK_ERROR: Request timed out. Please try again.
```
**解决方法：**
- 检查网络连接
- 验证 `ZENTAO_URL` 格式是否正确（需要包含协议：https:// 或 http://）
- 检查防火墙设置
- 超时上限为 30 秒；内网慢速实例可能需要放宽

### 参数错误
```
INVALID_PARAMETER: Resource not found. Please check the ID is correct.
INVALID_PARAMETER: Bug 12345 was not found.
```
**解决方法：**
- 使用 `zentao_list_projects` 查看可用的项目 ID
- 使用 `zentao_list_bugs` 查看可用的 Bug ID
- 检查日期格式是否为 YYYY-MM-DD

### API 错误
```
API_ERROR: API request failed with status 500
API_ERROR: Rate limit exceeded. Please wait before making more requests.
```
**解决方法：**
- 检查禅道服务器日志
- 确认用户账号有足够的权限
- 联系系统管理员

### 模式错误
```
UNSUPPORTED_API_MODE: listMyTasks 只有禅道旧版接口，没有 REST v1 等价端点。请将 ZENTAO_API_MODE 设为 auto 或 legacy。
```
**原因**：`ZENTAO_API_MODE=rest` 时调用了只有旧版实现的工具（`zentao_list_my_*`）。

**解决方法**：把 `ZENTAO_API_MODE` 改回 `auto` 或 `legacy` 并重启。默认的 `auto` 不会遇到这个问题。

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

服务器在 **stderr** 输出日志（stdout 留给 MCP 协议，任何非 JSON-RPC 内容都会破坏它）：

```
[INFO] Zentao MCP Server started successfully
[INFO] Connected to: https://your-zentao-domain.com
[INFO] Using username: your-username
[INFO] Default project ID: 1
[INFO] Token TTL: 3600 seconds
[INFO] Log level: info
[INFO] API mode: auto
```

最后两行用于确认配置是否真的生效。`API mode` 显示的是**你配置的值**；`auto` 时实际生效的模式在首次调用工具、完成认证后才确定。

### 测试连接

先确认实例走哪套 API，再对症测：

```bash
# REST v1 —— 新版禅道，返回 token
curl -X POST https://your-zentao-domain.com/api.php/v1/tokens \
  -H "Content-Type: application/json" \
  -d '{"account":"your-username","password":"your-password"}'

# 旧版 session —— 老版本禅道，返回 sessionID 与 rand
curl https://your-zentao-domain.com/api-getsessionid.json
```

更推荐直接用自带的命令行客户端，它会走完整认证链路：

```bash
node mcp-cli.mjs call zentao_list_projects '{"limit":1}' --content-only
```

> ⚠️ `node mcp-cli.mjs list` **完全不碰禅道**，它成功不代表凭据可用——排障时务必用 `call`。

## 项目结构

| 文件 | 说明 |
|------|------|
| `src/index.ts` | MCP 服务器入口：加载 `.env`、校验配置、注册工具 |
| `src/types.ts` | TypeScript 类型定义 |
| `src/constants.ts` | 常量与枚举（状态、严重程度、优先级、排序方式、响应格式） |
| `src/schemas/tool-input-schemas.ts` | Zod 输入校验 schema（`.strict()`，多余参数直接报错） |
| `src/schemas/tool-output-schemas.ts` | 结构化输出 schema，客户端据此校验返回值 |
| `src/services/zentao-client.ts` | 禅道客户端：双模式认证与探测、旧版信封解包、子任务补全 |
| `src/tools/projects.ts` | 项目工具 |
| `src/tools/bugs.ts` | Bug 列表与详情工具 |
| `src/tools/tasks.ts` | 任务工具 |
| `src/tools/stories.ts` | 需求工具 |
| `src/tools/my.ts` | 「我的地盘」三个跨项目工具 |
| `skill/SKILL.md` | skill 说明书模板（安装时把 `{{ZENTAO_SKILL_DIR}}` 替换成真实路径） |
| `mcp-cli.mjs` | 无依赖命令行客户端，用于手动调工具、排查问题 |
| `install.ps1` | Windows 一键安装脚本（`irm \| iex`） |
| `scripts/pack-skill.ps1` | 打包 Release 用的 `zentao-skill.zip` |
| `scripts/release.ps1` | 发版：改版本号 → 提交 → 打 tag → 推送 |
| `test-*.mjs` | 分层测试，见「开发」一节 |
| `.github/workflows/ci.yml` | 推送即跑：构建 + `npm test` |
| `.github/workflows/release.yml` | tag 触发：打包 + 建 Release + 发 npm |
| `dist/` | 编译输出（gitignored，随 Release 分发，不入库） |

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行（tsx watch 自动重载）
npm run dev

# 构建生产版本
npm run build

# 清理构建产物
npm run clean
```

### 测试

| 命令 | 覆盖内容 | 需要真实禅道账号 | 耗时 |
|------|---------|:---:|------|
| `npm test` | Codex 兼容性 + 旧版客户端解析（即下面两项） | 否 | 数秒 |
| `npm run test:codex` | 用官方 MCP SDK 客户端拉起 server，断言发现 8 个工具 | 否 | 数秒 |
| `npm run test:legacy` | 旧版接口解析、自动探测、信封解包 | 否 | 数秒 |
| `npm run test:mcp` | 从 3 个无关目录拉起 server，验证不依赖 cwd、且 **stdout 只有 JSON-RPC** | 是 | 数秒 |
| `npm run test:e2e` | 24 个端到端用例：8 个工具 + 过滤/分页/排序/错误路径/跨项目不变量 | 是 | ~90 秒 |
| `npm run test:live` | 直连真实禅道逐项验证 | 是 | 数秒 |

CI 只跑不需要凭据的那几项（`npm test`）。`test:e2e` 每条用例都登录一次，不适合放进 CI。

> **为什么 `test:mcp` 单独存在**：Codex 注册 MCP server 时**不设工作目录**，子进程继承你当前所在的项目目录。
> 这个测试从 3 个无关目录各拉起一次，覆盖「在仓库里能用、换个项目就报缺环境变量」这类问题。
> 它还会断言 stdout 除协议帧外没有任何内容——`dotenv` v17 默认会往 stdout 打印提示，
> 而 stdout 是 MCP 的 JSON-RPC 通道，混入非 JSON 内容会让严格客户端连接失败。

### 手动调用工具

```bash
node mcp-cli.mjs list                                        # 列出全部工具
node mcp-cli.mjs describe zentao_list_bugs                   # 查看某个工具的完整 schema
node mcp-cli.mjs call zentao_list_projects '{"limit":1}'     # 直接调用
node mcp-cli.mjs call zentao_list_projects '{"limit":1}' --content-only   # 只输出内容
node mcp-cli.mjs raw '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'   # 发任意 JSON-RPC
```

排障时优先用 `call`（会真正发起认证），`list` 不碰禅道、验证不了凭据。

### 打包与发版

```bash
npm run pack:skill        # 生成 zentao-skill.zip
npm run release 1.3.1     # 改版本号 → 提交 → 打 tag → 推送，由 CI 发版
```

## 发布新版本（维护者）

发版**由 git tag 驱动**，不需要手动 `npm publish`：

```powershell
npm run release 1.3.1        # 改版本号 -> 提交 -> 打 tag -> 推送
npm run release 1.3.1 -DryRun  # 只做检查，不改动任何东西
```

推送 `v*.*.*` 格式的 tag 会触发 `.github/workflows/release.yml`，CI 依次执行：

```
跑测试 → 构建 → 打包 skill → 创建 GitHub Release（附 zip）→ 发布到 npm
```

几分钟后两处同时就绪：

```powershell
npm view @jdfcc/zentao-mcp --registry https://registry.npmjs.org/
Invoke-WebRequest "https://github.com/jdfcc/zentao-mcp/releases/latest/download/zentao-skill.zip" -Method Head
```

### ⚠️ 发出去的是 tag 所指的 commit，不是 main 的最新提交

这是本流程最容易踩的坑：**tag 打在落后的 commit 上时，CI 会老老实实把旧代码发出去，而且全程绿灯**——看起来一切正常，实际发的是旧版本。本仓库就发生过一次：`v1.3.0` 落后 main 三个提交，导致 Release 上的 `zentao-skill.zip` 缺少当时的修复，而 npm 上那份是手工发的、反而是新的。

`npm run release` 每次都要求「工作区干净 + 本地与 origin/main 同步」，然后从 HEAD 打 tag，就是为了杜绝这种情况。

CI 里还有一道守卫：**tag 版本号必须与 `package.json` 的 `version` 一致**，不一致直接失败（版本已发布过则只告警，因为「重跑失败的任务」是合法场景）。

### 前置配置（每台机器一次）

```powershell
# 发布必须走官方源；本机全局 registry 可能指向 npmmirror（只读镜像，发不了）
npm config set @jdfcc:registry https://registry.npmjs.org/
npm login --registry https://registry.npmjs.org/
```

CI 需要在仓库 Settings → Secrets → Actions 配置 `NPM_TOKEN`：

- 在 https://www.npmjs.com/settings/~/tokens 创建
- 类型选 **Automation**（或 Granular 并勾选 bypass 2FA）——普通 token 在 CI 里会卡在 2FA

没配 `NPM_TOKEN` 时 `Publish to npm` 会自动跳过，Release 仍会正常创建——**skill 安装包是主分发渠道，不该被 npm 拖累**。

### 重跑失败的任务

在 Actions 页面点 **"Re-run failed jobs"** 即可（会在同一个 tag 上重跑）。不要为了重试去删 tag 重推——那样容易把 tag 落到新的 commit 上。

## 故障排除

### 服务器启动失败

1. 检查 Node.js 版本：`node --version`（需要 >= 18）
2. 检查依赖是否安装：`npm list`
3. 查看错误日志：`npm start 2>&1`

### 工具调用失败

1. 验证环境变量配置：`Get-Content .env`
2. 用自带客户端实测认证链路：`node mcp-cli.mjs call zentao_list_projects '{"limit":1}' --content-only`
3. 启用调试日志：`$env:LOG_LEVEL='debug'; npm start`
4. 先确认实例走 REST 还是旧版接口（日志里的 `API mode` 行）

> 若怀疑是环境变量没生效：**已存在的进程环境变量会覆盖 `.env`**（dotenv 不覆写既有变量）。
> 检查 `$env:ZENTAO_URL` 等是否在本会话里被设过。

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

- **凭证缓存**：认证凭证在内存中缓存 `TTL_SECONDS` 秒（默认 3600 秒）。REST 模式下缓存的是 token，旧版模式下缓存的是 session
- **分页**：用 `offset` 和 `limit` 处理大量数据（`limit` 上限 100）。注意 `zentao_list_my_*` 服务端忽略分页参数，见上文
- **格式选择**：`markdown` 适合人类阅读，`json` 适合程序处理。`json` 时同时返回 `structuredContent`，由输出 schema 校验
- **字符上限**：**仅 `zentao_list_bugs` 与 `zentao_list_projects` 在 Markdown 输出超过 25,000 字符时会自动截断**，并在结果里带 `truncated` 标记与提示。其余工具（任务、需求、Bug 详情、我的地盘）不做这层截断——它们的返回量由 `limit` 控制
- **不会自动重试**：网络错误会直接以 `NETWORK_ERROR` 返回，请自行重试

## 参考资料

- [禅道 API 文档](https://www.zentao.net/book/api/setting-369.html)
- [MCP 协议文档](https://modelcontextprotocol.io)
- [TypeScript SDK 文档](https://github.com/modelcontextprotocol/typescript-sdk)

## 许可证

MIT
