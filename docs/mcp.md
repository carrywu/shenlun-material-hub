# MCP 接入说明

本项目为 Codex 和 Claude Code 接入 MCP，用于浏览器检查、数据库只读分析和项目日志排查。

## 已接入 MCP

| 名称 | 用途 | 权限 |
| --- | --- | --- |
| `shenlun-playwright` | 使用 Playwright MCP 驱动真实浏览器，检查页面、表单、可访问性树和交互流程 | 浏览器操作 |
| `shenlun-sqlite-logs` | 查询项目 SQLite schema、执行只读 SQL、查询 `SystemLog` | 只读 |

## 浏览器 MCP

浏览器 MCP 使用 Microsoft 官方 Playwright MCP：

```bash
npx -y @playwright/mcp@latest
```

适合：

- 检查页面是否能打开。
- 验证登录、跳转、按钮、表单。
- 调试 Playwright selector。
- 辅助生成或修正 E2E 测试。

限制：

- 浏览器 MCP 的人工检查不能替代仓库 E2E。
- 正式结论仍以 `pnpm exec playwright test` 的退出码和报告为准。

## 数据库与日志 MCP

数据库/日志 MCP 使用项目内脚本：

```bash
node scripts/mcp/sqlite-readonly-server.mjs
```

默认读取：

```text
prisma/dev.db
```

也可以通过环境变量指定临时库：

```bash
SHENLUN_SQLITE_DB_PATH=/path/to/temp.db node scripts/mcp/sqlite-readonly-server.mjs
```

暴露工具：

- `db_schema`：查看表、字段、索引和建表 SQL。
- `db_query_readonly`：执行只读 SQL。
- `system_logs_query`：查询 `SystemLog`。

只允许：

- `SELECT`
- `WITH`
- `EXPLAIN`
- 白名单内的安全 `PRAGMA`

禁止：

- `INSERT`
- `UPDATE`
- `DELETE`
- `DROP`
- `ALTER`
- `CREATE`
- `REPLACE`
- `TRUNCATE`
- `ATTACH`
- `DETACH`
- `VACUUM`
- 事务语句
- 多语句 SQL

## 数据库写入策略

默认不开放数据库写入 MCP。

如果任务确实需要写数据库，必须同时满足：

1. 当前任务文档明确写明“允许临时数据库写入”。
2. 有 dry-run 或临时库验证方案。
3. 涉及真实数据前先备份。
4. 最终通过项目脚本、Prisma migration 或明确的维护脚本执行，不通过常驻 MCP 随手写入。

## 自测命令

```bash
node scripts/mcp/sqlite-readonly-server.mjs --self-test
```

自测必须证明：

- schema 查询成功。
- 只读查询成功。
- `SystemLog` 查询成功或返回空数组。
- 危险 SQL 被拒绝。
- 多语句 SQL 被拒绝。

## 客户端检查

Codex：

```bash
codex mcp list
```

Claude Code：

```bash
claude mcp list
```

## 安全边界

- 不把生产库路径配置给只读 MCP，除非任务明确授权。
- 不通过 MCP 打印 API Key、Cookie、Token、`.env` 内容。
- 不把 WeWe RSS sidecar 数据库作为写入目标。
- MCP 发现的问题必须回写到任务 `journal.md`、`validation.md` 或 `handoff.md`。
