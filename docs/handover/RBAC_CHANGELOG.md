# RBAC 变更记录

审计日期：2026-06-05

本 changelog 基于 Git history 和当前代码，不依赖历史聊天上下文。

## 近期相关提交

- `97da329 feat: complete Phase 1 auth + fix Phase 2 data isolation gaps`
  - 本次交接时的相关 HEAD。
  - 当前代码包含数据库 session auth、route guards、ownership helpers 和 schema owner 字段。
- `103ab0f feat: global auth protection, RBAC hardening, and codebase overview`
  - 表明 global auth 和 RBAC hardening 在 HEAD 前进入分支。
- `7a6789a Stabilize production admin and async task workflows`
  - 当前代码包含 admin shell、async task models 和 admin task routes。
- `ad05797 feat: optimize AI prompts, support configurable annotations, and add source type filter`
  - 当前代码包含 AI prompt routes 和 annotation routes。
- `e7bf31c Record rollout notes and align legacy card migration`
  - 与 migration/rollout 文档有关；后续仍需用空库验收证明 migration chain。
- `8185c8a Stabilize WeWe RSS content cleanup and browser QA workflow`
  - 与 content cleanup 和 browser QA 有关。
- `cf93c54 feat: WeWe RSS deep integration - SQLite fallback, preview-sync, delete confirmation`
  - 当前代码包含 WeWe RSS integration routes 和 SQLite fallback。

## 当前 RBAC 状态

- schema 和代码中存在 DB-backed session model。
- 大部分 admin APIs 使用 `requireAdmin`。
- 部分用户侧 APIs 使用 `requireAuth` 和 owner helpers。
- route-level 剩余缺口记录在 `RBAC_API_AUDIT.md`。

## Migration Drift 说明

generated Prisma client 反映当前 schema。未来 schema 变更前，应先通过空库迁移验收确认 `prisma/migrations` 能复现当前 schema，或在文档中明确解释 drift 风险。

## 后续指令

满足以下条件前，不要声称项目已经多用户就绪：

- 空库迁移和首启验收通过。
- P0 API 风险已修复并测试。
- A/B 隔离测试存在并通过。
- public API policy 已文档化并测试。
