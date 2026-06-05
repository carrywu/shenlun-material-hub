# RBAC P0 Foundation 交接记录

## 当前目标

准备并继续执行 RBAC P0 foundation 工作：迁移漂移、批注授权、文章列表策略、安全 where 条件组合、A/B 用户隔离测试。

## 当前步骤

工作流上下文已建立。本任务目录内尚未开始新的 RBAC 业务逻辑修复。

## 已完成

- [x] 创建 `docs/testing.md`。
- [x] 创建 `tasks/README.md`。
- [x] 创建可复用任务模板。
- [x] 创建本 RBAC P0 foundation 任务目录。
- [x] 创建 `AGENT_HANDOFF.md` 统一交接入口。
- [x] 创建 `docs/mcp.md`。
- [x] 创建只读 SQLite/SystemLog MCP 服务。
- [ ] 建立 RBAC A/B 用户隔离测试夹具。
- [ ] 修复迁移漂移。
- [ ] 修复批注 route 授权。
- [ ] 修复 article/content/search 隔离。

## 已修改文件

- `AGENT_HANDOFF.md` - 统一 Agent 交接入口。
- `docs/testing.md` - 共享验证契约和 Playwright 已知基线。
- `docs/mcp.md` - MCP 接入、权限边界和使用规则。
- `.mcp.json` - Claude Code 项目级 MCP 配置。
- `tasks/README.md` - 个人 Claude Code/Codex 任务工作流。
- `tasks/templates/*.md` - 可复用任务模板。
- `tasks/2026-06-05-rbac-p0-foundation/*.md` - 首个 RBAC P0 任务上下文。
- `scripts/mcp/sqlite-readonly-server.mjs` - 只读 SQLite/SystemLog MCP 服务。
- `package.json` / `pnpm-lock.yaml` - 添加 MCP SDK 和 `zod` 依赖。
- `src/test/helpers/route-helpers.ts` - 规范化 `NextRequest` init，避免 build 类型检查失败。
- `next-env.d.ts` - `next build` 更新为生产 route type 引用。

## 验证

- `node scripts/mcp/sqlite-readonly-server.mjs --self-test`：已通过。
- `codex mcp list`：已通过，能看到 `shenlun-playwright` 和 `shenlun-sqlite-logs`。
- `claude mcp list`：已通过，能看到两个项目 MCP；首次运行 Claude 时需要批准。
- `pnpm lint`：已通过。
- `pnpm test`：已通过，30 个测试文件 / 177 个测试。
- `pnpm build`：已通过。

## 未解决问题

- Playwright 基线失败。
  - 影响：完整 E2E 暂时不能作为干净 release gate。
  - 建议下一步：单独修复 Playwright 基线，或在每个任务 `validation.md` 继续记录为已知基线。
- `pnpm` 输出 `pnpm.onlyBuiltDependencies` 配置警告。
  - 影响：验证仍可通过，但输出有噪音。
  - 建议下一步：把设置迁移到 pnpm 支持的配置位置。
- PostgreSQL 迁移暂不执行。
  - 影响：当前继续 SQLite 路线。
  - 建议下一步：仅作为 P3 长期规划记录，除非出现高并发、多租户 SaaS 或 SQLite 文件锁等真实瓶颈。

## 下一步唯一行动

继续执行 `plan.md` 第 1 步：添加可复用 RBAC A/B 用户隔离测试夹具，并补批注 update/delete/list 越权测试。
