# Zentao MCP Server - 快速开始指南

## ✅ 实现完成！

禅道 MCP 服务器已成功实现，包含以下功能：

### 🛠️ 已实现的工具

1. **zentao_list_projects** - 查询项目列表
   - 支持按状态过滤
   - 支持分页
   - 支持 Markdown/JSON 格式输出

2. **zentao_list_bugs** - 查询 Bug 列表
   - 支持多维度过滤（项目、状态、严重程度、优先级、指派给、创建者、日期范围）
   - 支持分页
   - 支持 Markdown/JSON 格式输出

3. **zentao_get_bug_details** - 获取 Bug 详情
   - 返回完整的 Bug 信息
   - 支持 Markdown/JSON 格式输出

### 🎯 核心特性

- ✅ 自动认证和 Token 缓存（TTL 可配置）
- ✅ 完整的错误处理和用户友好的错误消息
- ✅ 字符限制保护（25,000 字符）
- ✅ TypeScript 类型安全
- ✅ Zod 运行时输入验证
- ✅ 只读操作，所有工具标注为 `readOnlyHint: true`

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

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

### 3. 编译项目

```bash
npm run build
```

### 4. 启动服务器

**开发模式（支持自动重载）：**
```bash
npm run dev
```

**生产模式：**
```bash
npm start
```

## 🧪 测试服务器

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

在 MCP Inspector 中，尝试以下查询：

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

## 🔧 配置到 Claude Desktop

在 Claude Desktop 的配置文件中添加：

### macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
### Windows: %APPDATA%\Claude\claude_desktop_config.json

```json
{
  "mcpServers": {
    "zentao": {
      "command": "node",
      "args": ["E:\\wangfan\\zantao-mcp\\dist\\index.js"],
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

### macOS 路径示例：
```json
"args": ["/Users/yourname/projects/zentao-mcp/dist/index.js"]
```

## 📝 API 端点映射

| 工具 | API 端点 | 说明 |
|------|---------|------|
| zentao_list_projects | `GET /api.php/v2/projects` | 获取项目列表 |
| zentao_list_bugs | `GET /api.php/v2/projects/:projectId/bugs` | 获取项目 Bug 列表 |
| zentao_get_bug_details | `GET /api.php/v2/bugs/:bugId` | 获取 Bug 详情 |
| 认证 | `POST /api.php/v2/users/login` | 获取访问令牌 |

## 🛡️ 错误处理

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

## 🎓 常见使用场景

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

## 🔍 调试技巧

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
curl -X POST https://your-zentao-domain.com/api.php/v2/users/login \
  -H "Content-Type: application/json" \
  -d '{"account":"your-username","password":"your-password"}'
```

## 📚 文件说明

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

## 🎉 下一步

1. ✅ 配置 `.env` 文件
2. ✅ 运行 `npm run build`
3. ✅ 测试 `npm start` 或使用 MCP Inspector
4. ✅ 配置到 Claude Desktop
5. ✅ 开始在 Claude 中使用禅道工具！

## 💡 提示

- **Token 缓存**：Token 会在内存中缓存 TTL_SECONDS 秒（默认 3600 秒）
- **分页**：使用 `offset` 和 `limit` 参数处理大量数据
- **格式选择**：`markdown` 适合人类阅读，`json` 适合程序处理
- **错误重试**：网络错误时会自动重试
- **字符限制**：大响应会被截断以保持响应在合理大小内

## 🐛 故障排除

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

## 📖 参考资料

- [禅道 API 文档](https://www.zentao.net/book/api/setting-369.html)
- [MCP 协议文档](https://modelcontextprotocol.io)
- [TypeScript SDK 文档](https://github.com/modelcontextprotocol/typescript-sdk)

---

祝使用愉快！如有问题，请参考以上故障排除指南。
