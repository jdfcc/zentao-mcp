---
name: zentao
description: 查询禅道项目、Bug、任务、需求，以及指派给我的任务/Bug/需求。用户提到禅道/ZenTao/Bug/缺陷/提单/任务/需求/项目进度/我的任务/我的bug/指派给我，或给出 Bug 编号时使用。
---

# 禅道查询

本仓库内置了一个 MCP 客户端脚本，可直接以原生 MCP 协议查询禅道，无需注册 MCP server。

在 `D:\zendao\zentao-mcp` 目录下执行：

```powershell
node mcp-cli.mjs call <工具名> '<JSON参数>' --content-only
```

- `--content-only`：只输出 markdown，**上下文占用最小，默认用这个**
- `--json`：只输出紧凑 JSON，需要程序处理或落文件时用
- 不加开关：markdown 和 JSON 都输出，占用约为前者的 3 倍

## ⭐ 查「我的」东西：优先用 my-* 工具

问到**"我的"/"指派给我的"**任务、Bug、需求时，**直接用这三个工具，不要逐个项目去查**。
它们跨项目、**不需要 `projectId`**，底层走禅道「我的地盘」页面（`/my-task-assignedTo.html` 等），
由服务端按登录账号过滤。

| 工具 | 对应页面 | 可选参数 |
|---|---|---|
| `zentao_list_my_tasks` | `/my-task-assignedTo.html` | `status`=all\|wait\|doing\|done\|closed\|cancel `keyword` `limit` `offset` |
| `zentao_list_my_bugs` | `/my-bug.html` | `status`=all\|active\|resolved\|closed `severity` **字符串**`'1'~'4'` `keyword` `limit` `offset` |
| `zentao_list_my_stories` | `/my-story.html` | `status` `stage`（同 `zentao_list_stories`）`keyword` `limit` `offset` |

```powershell
node mcp-cli.mjs call zentao_list_my_tasks '{"limit":20}' --content-only
```

⚠️ **单次最多 20 条，且分页参数被服务端忽略。** 实测加 `?recPerPage=100&pageID=2` 完全无效，
响应恒为 `recPerPage=20 / pageID=1`。返回正好 20 条时工具会带 `truncated` 标记，**这种情况必须去禅道页面确认**。
另外响应里的 `recTotal` 字段**恒为 0，不可信**——真实条数只能看数组长度。

## 工具与参数（按项目/Bug 维度）

| 工具 | 必填 | 可选参数 |
|---|---|---|
| `zentao_list_projects` | — | `limit`(1-100，默认20) `offset` `status`=all\|active\|closed |
| `zentao_list_bugs` | — | `projectId` `status`=all\|active\|resolved\|closed `severity` **字符串**`'1'~'4'` `priority` **字符串**`'1'~'4'` `assignedTo` `openedBy` `resolution` `startDate` `endDate` `limit`(1-100) `offset` `orderBy`=id_desc\|id_asc\|openedDate_desc\|openedDate_asc\|severity_desc\|severity_asc |
| `zentao_get_bug_details` | `bugId` | — |
| `zentao_list_tasks` | — | `projectId` `status`=all\|wait\|doing\|done\|closed\|cancel `assignedTo` `openedBy` `startDate` `endDate` `limit`(1-100) `offset` |
| `zentao_list_stories` | — | `projectId` `status`(见下) `stage`(见下) `assignedTo` `openedBy` `keyword`(标题关键词) `startDate` `endDate` `limit`(1-100) `offset` |

参数 schema 是 `.strict()` 的：**多传一个未知字段就会报错**。日期格式 `YYYY-MM-DD`。

⚠️ **`severity` 和 `priority` 是字符串枚举**——必须写 `"severity":"1"`，写成 `"severity":1` 会被拒（`invalid_enum_value`）。
`severity`：`"1"`=致命 `"2"`=严重 `"3"`=一般 `"4"`=轻微；`priority`：`"1"`=高 `"2"`=中 `"3"`=低 `"4"`=最低。

⚠️ **`zentao_list_stories` 的 `status` / `stage` 也是枚举**，取值按禅道标准词表：
`status`（生命周期）= `all`\|`draft` 草稿\|`active` 激活\|`closed` 已关闭\|`changing` 变更中\|`reviewing` 评审中
`stage`（研发阶段）= `all`\|`wait` 未开始\|`planned` 已计划\|`projected` 已立项\|`developing` 研发中\|`testing` 测试中\|`verified` 已验证\|`released` 已发布\|`closed` 已关闭

注意：**枚举值由 Zod 校验，但筛选是在本地做的**。所以传了合法但不存在的值（比如全项目没有 `reviewing`）
不会报错，而是**静默返回 0 条**——遇到 0 条先怀疑筛选值，再怀疑数据。

⚠️ **`limit` 上限是 100**（不是 1000）。传大于 100 会被 `.max(100)` 拒绝。要取超过 100 条必须用 `offset` 翻页
（单页上限 100，翻页要重复冷启动，每页约 2.5 秒）。

## 已知项目 ID

| ID | 名称 | 状态 |
|---|---|---|
| 534 | 阿尔及利亚国家级一网通办项目 | doing |
| 533 | 阿国一网通办项目2025 | closed |
| 530 | 【ZW-2026】江苏公安项目 | doing |

不传 `projectId` 时，服务端回退到 `.env` 里的 `ZENTAO_DEFAULT_PROJECT`。

## 四个必须知道的坑

1. **每次调用都会重新登录禅道（约 2 秒）** —— 脚本每次冷启动，进程内的 token 缓存活不过单次调用。要查多个项目时，优先用**单次调用 + 大 `limit` + 本地筛选**，而不是反复调用。
2. **结果过大时 `pwsh` 会截尾丢开头** —— 超过约 50 条记录时不要直接读 stdout，改为落文件（**需求尤其容易超**，例如项目 530 有 313 条需求）：
   ```powershell
   node mcp-cli.mjs call zentao_list_bugs '{"projectId":534,"limit":100}' --json > bugs.json
   ```
   然后用文件读取工具分页读 `bugs.json`。
3. **`assignedTo` 会被禅道改写成 `closed`** —— 任务被关闭时指派人字段会被**覆写成字面量 `closed`**。实测全库 1329 条任务里 **1052 条（79%）** 的指派人已被抹掉，只剩 105 条是真人。**历史上指派给某人、且已关闭的任务查不回来**——原始信息在禅道侧已被覆盖，不是查询方式的问题。
   要查"某人负责的任务"用 `zentao_list_my_*`（服务端过滤，不受此影响），**不要靠逐项目扫描 + 本地过滤 `assignedTo`**。
4. **`zentao_list_tasks` 的子任务曾经会静默漏掉（已修复，但要知道 `truncated` 的含义）** —— 底层 `project-task` 只返回**顶层任务**，子任务既不在列表里也不在那批数据中，但会算进它自报的 `recTotal`（曾经 530 少 36 条、534 少 16 条，且 `orderBy` 被服务端忽略、只能拿到最旧的一批）。现已修好：会为 `parent=-1` 的父任务补拉 `task-view` 的 `children`，并按 id 倒序输出。
   修复后仍要留意返回里的 **`truncated` / `truncation_message`**：那是"禅道自报条数 > 实际取到条数"的信号，**看到就当结果不完整**，别当成全量。
