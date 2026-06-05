# RBAC P0 Foundation 计划

## 当前状态

来自 `docs/handover/` 的证据：

- `prisma/schema.prisma` 定义了 `User`、`Session`、owner 字段和关系。
- `prisma/migrations/**/migration.sql` 曾缺少对应 RBAC DDL，后续审计记录显示迁移链已补齐，但仍需要空库验收脚本确认。
- `src/app/api/annotations/[id]/route.ts` 已使用 `requireAuth` 和 owner 检查，但仍需要真实 A/B 隔离测试证明。
- `src/app/api/content-items/[id]/annotations/route.ts` 已要求 auth 和 content 可访问性检查，但仍需要真实 A/B 隔离测试证明。
- `src/app/api/articles/route.ts` 已加入可见性过滤，但公开/私有策略仍需文档化。
- `src/app/api/content-items/route.ts` 和 `src/app/api/search/route.ts` 已使用安全 where 组合，但仍需要回归测试覆盖。
- Vitest 当前通过，但还不足以覆盖所有真实 A/B 用户隔离场景。
- Playwright 基线失败，详见 `docs/testing.md`。

## 实施步骤

1. 建立 RBAC 测试夹具。
   - 添加可复用 helper，用于创建 admin、userA、userB、session/cookie 和 owner 数据。
   - 为批注 update/delete/list 访问添加真实 A/B 用户隔离测试。

2. 验证迁移链。
   - 检查 Prisma migration 历史和 generated client。
   - 用临时 SQLite 数据库跑空库 migrate、seed admin 和 health check。
   - 不触碰持久化本地数据库，除非任务明确授权。

3. 验证批注授权。
   - 确认创建批注时设置 `userId`。
   - 确认 update/delete 只允许 admin、批注用户或符合策略的内容 owner。
   - 确认批注列表 GET 要求 auth，并检查内容可见性。

4. 固化文章列表策略。
   - 从当前前端需求确认 route 行为。
   - 若公开访问，只返回明确 public 内容。
   - 若登录访问，使用 `requireAuth` 和 `contentVisibilityWhere`。

5. 固化安全 where 组合。
   - 确认搜索条件和隔离条件通过 `AND` 组合。
   - 覆盖 `/api/content-items` 和 `/api/search`。

6. 验证和记录。
   - 先跑定向测试。
   - 再跑 `pnpm lint`、`pnpm test`、`pnpm build`。
   - 若 auth/page 行为变化，再跑目标 Playwright auth spec。
   - 更新 `journal.md`、`validation.md`、`handoff.md`。

## 文件范围

预计涉及文件：

- `prisma/schema.prisma`
- `prisma/migrations/**/migration.sql`
- `src/lib/data-isolation.ts`
- `src/app/api/annotations/[id]/route.ts`
- `src/app/api/content-items/[id]/annotations/route.ts`
- `src/app/api/articles/route.ts`
- `src/app/api/content-items/route.ts`
- `src/app/api/search/route.ts`
- `src/app/api/**/__tests__/route.test.ts`
- `src/test/**`
- `tasks/2026-06-05-rbac-p0-foundation/**`

本轮交接/MCP 工作额外涉及：

- `AGENT_HANDOFF.md`
- `docs/testing.md`
- `docs/mcp.md`
- `tasks/README.md`
- `tasks/templates/**`
- `scripts/mcp/sqlite-readonly-server.mjs`
- `package.json`
- `pnpm-lock.yaml`

不要编辑 WeWe RSS sidecar 文件、`.env`、本地数据库文件或无关 UI。

## 数据 / API / Schema 变更

本轮交接/MCP 工作：

- 不改变业务 API。
- 不改变 Prisma schema。
- 新增只读 MCP 服务，默认只读 `prisma/dev.db`。

RBAC 后续工作可能涉及：

- Prisma migration repair 或新增 migration。
- articles 和 annotations route 行为固化。

任何持久数据库操作前：

- 先用临时 SQLite 数据库验证。
- 把命令和结果记录到 `validation.md`。

## 测试计划

定向：

- `node scripts/mcp/sqlite-readonly-server.mjs --self-test`
- 批注 route tests。
- articles route visibility tests。
- content-items search + visibility tests。
- search owner + keyword tests。

全量：

- `pnpm lint`
- `pnpm test`
- `pnpm build`

条件：

- `pnpm exec playwright test e2e/admin-auth.spec.ts`

## 回滚计划

- 交接/MCP 文档可通过 Git 回滚。
- MCP 客户端配置可通过 `codex mcp remove <name>` 和 `claude mcp remove <name>` 移除。
- route/test 变更可通过 Git 回滚。
- 若创建 migration 但未应用到共享数据，可在合并前移除或用后续 migration 取代。
- 若 migration 已应用到本地库，必须先确认备份，再按任务授权恢复或重建本地开发库。
