# 交接文档索引

审计日期：2026-06-05

本目录是后续 Codex、Claude Code、Gemini 或人工维护者的项目交接面。内容基于当前仓库真实状态，不依赖历史聊天记录。

## 审计基线

- 分支：`main`
- API route 数量：58 个 `src/app/api/**/route.ts`
- route-local API 测试数量：15 个 `__tests__/route.test.ts`
- Playwright spec 数量：7 个
- 验证基线：
  - `pnpm lint`：通过（0 errors）
  - `pnpm test`：通过，36 个文件 / 215 个测试
  - `pnpm build`：通过

## 建议阅读顺序

统一入口优先读根目录 `AGENT_HANDOFF.md`。需要 RBAC 细节时，再按以下顺序阅读：

1. `PROJECT_MASTER_TODO.md` - 全项目 TODO 总源。
2. `RBAC_HANDOVER.md` - RBAC 完成度和阻断项评估。
3. `RBAC_API_AUDIT.md` - route-by-route 守卫和隔离表。
4. `RBAC_RISK_REGISTER.md` - 风险登记和 TODO 映射。
5. `RBAC_RESUME_PROMPT.md` - 下一位 Agent 的 RBAC 接管提示词。

## 文档地图

- `RBAC_ARCHITECTURE.md` - auth/RBAC/data-isolation 架构。
- `RBAC_CHANGELOG.md` - 基于 Git 和代码证据的 RBAC 变更历史。
- `PROJECT_MASTER_TODO.md` - 全项目 TODO，包含代码证据项和规划推导项。

## 归档文档

已完成的历史评估、设计文档和检查点已移至 `docs/archive/`。包括：
- 4 份 AUTH_RBAC_* 预实现评估报告
- 生产加固设计方案（已实现）
- 项目评估报告（2 份，预 RBAC）
- Agent checkpoint 和 resume prompt（已过时）
- RBAC_MASTER_TODO（已归档，唯一 TODO 源为 PROJECT_MASTER_TODO.md）

## 证据标签

- `证据：代码审计`：任务直接由当前代码、schema、migration、测试或 Git 输出支持。
- `证据：规划推导`：任务根据当前模块边界和长期维护目标推导。

## 本次交接非目标

- 不修改 RBAC 业务代码。
- 不生成或应用数据库 migration。
- 不修改 `.env`、PostgreSQL 数据库、Docker 服务或外部 we-mp-rss 状态。
