# RBAC 风险登记

审计日期：2026-06-05

| ID | 严重级别 | 风险 | 证据 | 影响 | 对应 TODO |
| --- | --- | --- | --- | --- | --- |
| RBAC-R001 | P0 | ✅ RESOLVED — Prisma migration chain 已包含 RBAC DDL。 | `schema.prisma` 定义 `User`、`Session`、owner 字段；历史审计发现 `prisma/migrations` 曾缺少对应 DDL。 | fresh deploy 或 migration replay 可能缺少 auth 表/字段。 | P0 database migration task |
| RBAC-R002 | P0 | ✅ RESOLVED — 批注 routes 已通过 `canModifyResource` 强制 owner checks。 | `src/app/api/annotations/[id]/route.ts` 曾只使用 `requireAuth` 并按 id 更新/删除。 | 知道 id 时用户 A 可修改或删除用户 B 批注。 | P0 annotation ownership task |
| RBAC-R003 | P0 | ✅ RESOLVED — 批注 GET 已要求 auth 和 `canAccessResource`。 | `GET /api/content-items/[id]/annotations` 曾无 guard 并按 `contentItemId` 查询。 | 批注数据可能公开暴露。 | P0 annotation GET guard task |
| RBAC-R004 | P0 | ✅ RESOLVED — `/api/articles` 已使用 optional auth + `contentVisibilityWhere` + `mergeWhere`。 | `src/app/api/articles/route.ts` 曾只导入 `db` 并查询 `contentItem.findMany({ where })`。 | private 或 user-owned 内容可能出现在不该出现的列表。 | P0 articles policy task |
| RBAC-R005 | P0 | ✅ RESOLVED — route 已使用 `mergeWhere` 安全组合搜索和隔离过滤。 | `src/app/api/content-items/route.ts` 和 `src/app/api/search/route.ts` 曾通过 `{ ...where, ...ownerFilter }` 合并。 | 搜索过滤可能丢失，或隔离语义被错误组合。 | P0 safe where merge task |
| RBAC-R006 | P1 | null-owner legacy 数据对非 admin 可见。 | `ownerScopeWhere` 和 `contentVisibilityWhere` 包含 `{ ownerUserId: null }`。 | 多用户开放后，历史私有数据可能被当作公开数据展示。 | P1 legacy null-owner policy task |
| RBAC-R007 | P1 | 部分 route tests mock auth guards，不能证明真实 A/B 隔离。 | route tests 中存在 `requireAdmin`/`requireAuth` mock；E2E 主要覆盖 admin login。 | auth extraction 或 ownership checks 回归可能通过 CI。 | P0/P1 RBAC test matrix tasks |
| RBAC-R008 | P1 | AsyncTask list/detail 当前 admin-only，未来非 admin 访问策略不明确。 | `admin/tasks` 使用 `requireAdmin`；`ownerScopeWhere` 注释为 future-proofing。 | 角色扩展后可能泄露或隐藏 task records。 | P1 AsyncTask role policy task |
| RBAC-R009 | P1 | MaterialCard 创建可能基于用户不可访问的内容生成卡片。 | `material-cards` POST 设置 `ownerUserId`，但仍需验证 source content ownership。 | 用户可能从不可访问内容创建自己的 private artifact。 | P1 material-card create ownership task |
| RBAC-R010 | P2 | public proxy 需要 SSRF 保护回归测试。 | `/api/proxy/image` 有 allowlist 和 private-IP regex，但缺少 route test。 | 未来修改可能削弱外部 fetch 安全边界。 | P2 proxy SSRF test task |

## 待决策项

- `/api/articles`、`/api/discover`、`/api/explore` 是公开 feed，还是应要求认证。
- `ownerUserId=null` 应保持为 public compatibility data，还是在多用户开放前迁移到 admin owner。
- `VERIFIED_USER` 是否需要区别于普通 authenticated user 的独立能力。
