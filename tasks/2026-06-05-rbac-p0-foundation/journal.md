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

## 2026-06-05 23:00

Agent：Claude Code (Opus 4.8)

模式：P0+P1 全面收尾

已完成工作：

### P0 收尾（2 项）
- **P0 空库迁移与首启验收脚本**：新建 `scripts/setup-fresh-db.ts`，一键 migrate → seed → health check。更新 Dockerfile 添加 `prisma migrate deploy`。添加 `db:setup`/`db:migrate` 命令到 package.json。
- **P0 生产禁用默认管理员密码**：`auth.ts` ensureInitialAdmin() 在 production 下无 bcrypt hash 时抛错。`seed-admin.ts` 在 production 下拒绝默认密码。添加 auth-production.test.ts。

### P1 策略与架构（4 项）
- **legacy null-owner 策略**：添加 data-isolation-legacy.test.ts，固定 null-owner 数据"可读不可写"策略。
- **VERIFIED_USER 能力矩阵**：新建 RBAC_CAPABILITY_MATRIX.md，定义每角色对每类 API 的权限。
- **owner 索引**：schema.prisma 添加 ContentItem.ownerUserId、ContentItem.visibility、SyncRecord.userId 索引。`prisma db push` 已同步。
- **asyncTask userId 绑定**：AI reassess route 现在创建绑定了 user.id 的 async task 并完成后记录 taskId。

### P1 数据隔离修复（5 项）
- **generate-card ownerUserId**：修复 materialCard.create() 未设置 ownerUserId 的关键 bug。
- **material-cards POST 访问校验**：添加 canAccessResource 检查，不可访问的 ContentItem 不能创建卡片。
- **web/collect userId**：createAsyncTask 传入 user.id。
- **WeChat 导入**：admin-only 策略已明确。
- **IMA 同步**：已有 user.id 传递。

### P1 测试补齐（6 项）
- 新建 review/route.test.ts — Review API 隔离测试
- 新建 sync-records/route.test.ts — SyncRecord 隔离测试
- 新建 proxy/image/route.test.ts — SSRF 防护测试
- 新建 env-validation.test.ts — 生产环境变量检查测试
- 新建 wewe-rss-sqlite.test.ts — WeWe RSS 只读约束测试
- 新建 regular-user-admin-access.spec.ts — Playwright E2E

### P1 文档（3 项）
- 新建 PUBLIC_API_INVENTORY.md — 公开 API 清单
- 新建 RBAC_CAPABILITY_MATRIX.md — 角色能力矩阵
- 生产环境变量检查模块 env-validation.ts

### P1 前端（1 项）
- admin/users 禁用用户后提示"会话已被撤销"

已修改文件：

- `scripts/setup-fresh-db.ts`（新建）
- `package.json`（添加 db:setup/db:migrate/seed:admin 脚本）
- `Dockerfile`（添加 prisma migrate deploy）
- `src/lib/auth.ts`（production 密码守卫）
- `src/scripts/seed-admin.ts`（production 密码守卫）
- `.env.example`（安全提示）
- `prisma/schema.prisma`（添加 owner 索引）
- `src/app/api/content-items/[id]/generate-card/route.ts`（ownerUserId 修复）
- `src/app/api/material-cards/route.ts`（ContentItem 访问校验）
- `src/app/api/content-items/reassess/route.ts`（userId 绑定）
- `src/app/api/collectors/web/collect/route.ts`（userId 绑定）
- `src/app/admin/users/page.tsx`（禁用提示）
- `src/lib/env-validation.ts`（新建）
- `src/lib/__tests__/auth-production.test.ts`（新建）
- `src/lib/__tests__/data-isolation-legacy.test.ts`（新建）
- `src/lib/__tests__/env-validation.test.ts`（新建）
- `src/app/api/review/__tests__/route.test.ts`（新建）
- `src/app/api/sync-records/__tests__/route.test.ts`（新建）
- `src/app/api/proxy/image/__tests__/route.test.ts`（新建）
- `src/services/integrations/__tests__/wewe-rss-sqlite.test.ts`（新建）
- `docs/handover/RBAC_CAPABILITY_MATRIX.md`（新建）
- `docs/handover/PUBLIC_API_INVENTORY.md`（新建）
- `e2e/regular-user-admin-access.spec.ts`（新建）

验证基线：
- pnpm lint：0 errors，3 warnings（测试文件）
- pnpm test：36 files / 215 tests passed
- pnpm build：passed
