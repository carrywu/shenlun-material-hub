# RBAC P0 Foundation

## 目标

解决多用户开放前必须稳住的 RBAC 基础：迁移链、批注授权、文章列表策略、安全 where 条件组合、A/B 用户隔离测试；同时建立统一中文交接入口和 MCP 辅助工具。

## 背景

优先读取：

- `AGENT_HANDOFF.md`
- `docs/handover/RBAC_RESUME_PROMPT.md`
- `docs/handover/PROJECT_MASTER_TODO.md`
- `docs/handover/RBAC_HANDOVER.md`
- `docs/handover/RBAC_API_AUDIT.md`
- `docs/testing.md`
- `docs/mcp.md`

交接审计结论：RBAC 已部分实现，但多用户开放前仍需真实隔离测试、空库迁移验收、安全策略固化和部署安全收口。

## 需求

- [ ] 空数据库迁移路径能创建 RBAC 表和 owner 字段。
- [ ] 用户 A 不能更新或删除用户 B 的批注。
- [ ] 批注列表访问必须认证，并具备 owner-aware 行为。
- [ ] `/api/articles` 有明确公开/私有策略，不能泄露 private 内容。
- [ ] `/api/content-items` 同时安全组合搜索过滤和可见性过滤。
- [ ] `/api/search` 同时安全组合关键词过滤和 owner 过滤。
- [ ] 存在可复用的 A/B 用户隔离测试模式。
- [x] 存在唯一中文交接入口 `AGENT_HANDOFF.md`。
- [x] 存在 MCP 使用说明 `docs/mcp.md`。
- [x] 存在只读 SQLite/SystemLog MCP self-test。

## 验收标准

- [ ] Prisma 迁移漂移已解决，或有可复现的迁移修复路径。
- [ ] P0 RBAC route tests 在可实践范围内做到修复前失败、修复后通过。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm test` 通过。
- [ ] `pnpm build` 通过。
- [x] `node scripts/mcp/sqlite-readonly-server.mjs --self-test` 通过。
- [ ] Playwright 对相关 auth 流程通过，或在 `validation.md` 记录为已知失败基线。

## 不在本任务范围

- 新产品功能。
- 视觉 redesign。
- WeWe RSS 功能变更。
- IMA 功能扩展。
- SQLite 到 PostgreSQL 迁移。
- 多 Agent 同时编辑同一批文件。

## 约束

- 不删除本地 SQLite 数据库。
- 破坏性数据库操作必须 dry-run。
- 不修改 `.env` 或 secrets。
- 保留手动来源和外部 WeRSS fallback。
- MCP 数据库能力默认只读；写入必须按任务临时授权。

## 风险

- 风险：迁移修复可能和现有本地数据库冲突。
  - 影响：本地开发数据需要谨慎迁移。
  - 缓解：先用临时数据库验证；破坏性操作保持 dry-run。
- 风险：文章公开策略可能影响现有前端页面。
  - 影响：页面可能需要 auth-aware 行为或公开过滤。
  - 缓解：实现前记录策略，并添加 route tests。
- 风险：Playwright 基线已经失败。
  - 影响：UI 验证不易隔离新回归。
  - 缓解：记录当前失败，auth 变化后跑定向 spec。
- 风险：MCP 暴露数据库查询能力。
  - 影响：若误配置生产库路径，可能泄露敏感数据。
  - 缓解：默认只读开发库；文档禁止生产库路径；写入不做常驻 MCP。

## 验证计划

- `node scripts/mcp/sqlite-readonly-server.mjs --self-test`
- `codex mcp list`
- `claude mcp list`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- 批注、articles、content-items、search 的定向 route tests。
- auth/page 行为变化后运行 `pnpm exec playwright test e2e/admin-auth.spec.ts`。
