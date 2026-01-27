# Zentao MCP Server

[![npm version](https://badge.fury.io/js/zentao-mcp-server.svg)](https://www.npmjs.com/package/zentao-mcp-server)
[![Node.js Version](https://img.shields.io/node/v/zentao-mcp-server.svg)](https://www.npmjs.com/package/zentao-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/orange29233/zantao-mcp/workflows/CI/badge.svg)](https://github.com/orange29233/zantao-mcp/actions)
[![Release](https://github.com/orange29233/zantao-mcp/workflows/Release/badge.svg)](https://github.com/orange29233/zantao-mcp/actions)

禅道项目管理系统的 MCP (Model Context Protocol) 服务器，提供查询项目和 Bug 的工具。

## 功能特性

- 查询项目列表，支持状态过滤和分页
- 查询 Bug 列表，支持多维度过滤（项目、状态、严重程度、优先级、指派给、创建者、日期范围）
- 获取 Bug 详细信息
- 自动认证和 Token 缓存（TTL 可配置）
- 支持 Markdown 和 JSON 两种响应格式
- 完整的错误处理和用户友好的错误消息
- TypeScript 类型安全
- Zod 运行时输入验证

## npm 包信息

- **包名**: `zentao-mcp-server`
- **最新版本**: [![npm version](https://badge.fury.io/js/zentao-mcp-server.svg)](https://www.npmjs.com/package/zentao-mcp-server)
- **许可证**: MIT
- **Node.js 要求**: >= 18
- **仓库**: https://github.com/orange29233/zantao-mcp

## 前置要求

- Node.js 18 或更高版本
- 具有 API 访问权限的禅道实例

## 快速开始

### 方式 1: 使用 npm 包（推荐）

直接使用 npx，无需安装：

```bash
npx zentao-mcp-server
```

或全局安装：

```bash
npm install -g zentao-mcp-server
zentao-mcp
```

### 方式 2: 从源码安装（开发调试）

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
ZENTAO_PASSWORD=your-password
ZENTAO_DEFAULT_PROJECT=1

# 可选配置
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

## 配置到 Claude Desktop

### 配置文件位置:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 方式 1: 使用 npm 包（推荐）

```json
{
  "mcpServers": {
    "zentao": {
      "command": "npx",
      "args": ["-y", "zentao-mcp-server"],
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
      "args": ["D:\\path\\to\\zentao-mcp\\dist\\index.js"],
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

## API 端点映射

| 工具 | API 端点 | 说明 |
|------|---------|------|
| zentao_list_projects | `GET /api.php/v1/projects` | 获取项目列表 |
| zentao_list_bugs | `GET /api.php/v1/projects/:projectId/bugs` | 获取项目 Bug 列表 |
| zentao_get_bug_details | `GET /api.php/v1/bugs/:bugId` | 获取 Bug 详情 |
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
