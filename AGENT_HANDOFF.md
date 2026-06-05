# Agent 统一交接入口

> 以后 Claude Code、Codex、Gemini 或新的人工维护者接管本项目时，只需要先读取本文件。

## 接管原则

- 不依赖历史聊天记录。
- 以真实代码、当前 Git 状态、当前任务文档为准。
- 不默认重读全仓库；先读本文件和当前任务，再按证据扩展阅读范围。
- 不覆盖无关的本地未提交改动。
- 不修改 `.env`、PostgreSQL 数据库、生产配置或 WeWe RSS sidecar 状态，除非任务明确授权。

## 接管后先执行

```bash
git status --short --branch
git diff --stat
```

需要判断历史背景时再执行：

```bash
git log --oneline -20
```

## 当前活跃任务

先读取：

- `tasks/2026-06-05-rbac-p0-foundation/handoff.md`

然后严格执行其中的 `Next Single Action`。

## 必读支撑文档

- `tasks/README.md`：个人开发任务工作流。
- `docs/testing.md`：验证命令和 Playwright 当前基线。
- `docs/handover/RBAC_RESUME_PROMPT.md`：RBAC 接管上下文。
- `docs/mcp.md`：MCP 工具、权限边界和使用规则。

## 当前已知基线

- `pnpm lint`：最近一次通过。
- `pnpm test`：最近一次通过，36 个测试文件 / 215 个测试。
- `pnpm build`：最近一次通过。
- `pnpm exec playwright test`：当前不是干净基线，详见 `docs/testing.md`。

## MCP 使用规则

- 浏览器：使用 `shenlun-playwright` MCP 做交互式页面检查；正式 E2E 仍以 `pnpm exec playwright test` 为准。
- 数据库/日志：使用 `shenlun-sqlite-logs` MCP，只读查询 PostgreSQL 和 `SystemLog`。
- 数据库 MCP 默认禁止写入。任何写入、迁移、修复数据必须走任务文档授权、dry-run、备份或临时库验证。

## 每轮结束前必须更新

当前任务目录下：

- `journal.md`：记录本轮做了什么、改了哪些文件、关键决策。
- `validation.md`：记录命令、结果、失败证据或未运行原因。
- `handoff.md`：更新当前状态和下一步唯一行动。

## 当前长期决策

- ✅ **已完成 SQLite → PostgreSQL 迁移**（2026-06-06，分支 `feat/postgresql-migration`）。
  - 数据库：PostgreSQL 16，通过 `@prisma/adapter-pg` + `pg.Pool` 连接。
  - 备份系统：v2 Prisma 序列化格式（不再是文件复制）。
  - MCP 工具：已重写为 PostgreSQL 版本。
  - `better-sqlite3` 保留仅供 WeWe RSS sidecar 只读访问。
  - 迁移详情：`scripts/migrate-sqlite-to-postgres.ts`，662 行数据已验证迁移。
