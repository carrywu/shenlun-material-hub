# RBAC P0 Foundation 任务日志

## 2026-06-05 20:15

Agent：Codex

模式：工作流搭建

已完成工作：

- 创建 RBAC P0 foundation 初始任务目录。
- 记录目标、约束、实施顺序、验证计划和交接入口。
- 未修改 RBAC 业务逻辑。
- 修复一个阻断 `pnpm build` 的 `NextRequest` 测试 helper 类型不兼容问题。

已检查文件：

- `docs/handover/RBAC_RESUME_PROMPT.md`
- `docs/handover/PROJECT_MASTER_TODO.md`
- `docs/testing.md`
- `src/test/helpers/route-helpers.ts`

已修改文件：

- `tasks/2026-06-05-rbac-p0-foundation/prd.md`
- `tasks/2026-06-05-rbac-p0-foundation/plan.md`
- `tasks/2026-06-05-rbac-p0-foundation/journal.md`
- `tasks/2026-06-05-rbac-p0-foundation/validation.md`
- `tasks/2026-06-05-rbac-p0-foundation/handoff.md`
- `src/test/helpers/route-helpers.ts`
- `next-env.d.ts`

决策：

- 决策：把 RBAC P0 foundation 作为第一个真实任务目录。
  - 原因：`docs/handover/PROJECT_MASTER_TODO.md` 把 RBAC 迁移和授权问题列为最高优先级。

风险 / 阻塞：

- Playwright 既有基线失败，不应视为本任务新回归。
- 当前 pnpm 不再读取 `package.json` 内的 `pnpm.onlyBuiltDependencies`，每次命令都会提示警告。

下一步：

- 执行 `plan.md` 第 1 步：建立 RBAC A/B 用户隔离测试夹具，并添加批注 route 失败用例。

## 2026-06-05 22:30

Agent：Codex

模式：交接体系中文化 + MCP 接入

已完成工作：

- 新增 `AGENT_HANDOFF.md`，作为唯一 Agent 交接入口。
- 新增 `docs/mcp.md`，记录浏览器、数据库、日志 MCP 的用途和安全边界。
- 将测试指南、任务 README、任务模板和当前任务文档改为中文。
- 将 `docs/handover` 中英文交接文档改为中文表达。
- 新增只读 SQLite/SystemLog MCP 服务，默认只读 `prisma/dev.db`。
- 添加 `@modelcontextprotocol/sdk` 和 `zod` devDependency。
- 为 Codex 添加 `shenlun-playwright` 和 `shenlun-sqlite-logs` MCP。
- 为 Claude Code 写入项目级 `.mcp.json`，添加 `shenlun-playwright` 和 `shenlun-sqlite-logs`。
- 运行 MCP self-test、MCP list、lint、test、build 验证。

已检查文件：

- `src/lib/logger.ts`
- `prisma/schema.prisma`
- `docs/handover/*.md`
- `tasks/templates/*.md`
- `tasks/2026-06-05-rbac-p0-foundation/*.md`

已修改文件：

- `AGENT_HANDOFF.md`
- `docs/mcp.md`
- `docs/testing.md`
- `tasks/README.md`
- `tasks/templates/*.md`
- `tasks/2026-06-05-rbac-p0-foundation/*.md`
- `scripts/mcp/sqlite-readonly-server.mjs`
- `package.json`
- `pnpm-lock.yaml`
- `.mcp.json`
- `docs/handover/*.md`

决策：

- 决策：数据库/日志 MCP 使用项目内只读实现，不采用通用第三方 SQLite MCP。
  - 原因：当前只需要 schema、SELECT 和 `SystemLog` 查询；项目内实现可以强制拒绝写入和多语句 SQL。
- 决策：暂不做 SQLite 到 PostgreSQL 迁移。
  - 原因：现有生产化文档明确选择 SQLite；当前阻断项是 RBAC、安全、空库迁移验收和 Playwright 基线。

风险 / 阻塞：

- Claude Code 项目级 MCP 处于 Pending approval；首次运行 `claude` 时需要批准 `.mcp.json`。
- Playwright 基线仍不是干净状态。

下一步：

- 继续执行 `plan.md` 第 1 步：建立 RBAC A/B 用户隔离测试夹具，并添加批注 route 越权测试。
