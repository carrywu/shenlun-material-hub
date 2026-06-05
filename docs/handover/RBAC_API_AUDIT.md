# RBAC API 审计

审计日期：2026-06-05

说明：

- Guard：route-level 是否使用 `requireAuth`、`requireAdmin`、`requireVerifiedUser` 或等价守卫。
- Isolation：route 内是否有 owner 或 visibility 检查。
- Test：route 同目录是否有 `__tests__/route.test.ts`。
- Risk：
  - P0：阻断多用户或生产发布。
  - P1：重要，但可在 P0 后处理。
  - P2：加固或覆盖缺口。
  - P3：可接受的公开/低风险 surface。

| Route | Methods | Guard | Isolation | Test | Risk | 发现 |
| --- | --- | --- | --- | --- | --- | --- |
| `src/app/api/admin/backup/export/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/admin/backup/import/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only 破坏性 import，缺少 route test。 |
| `src/app/api/admin/clean/route.ts` | POST, GET | `requireAdmin` | none | no | P2 | Admin-only clean/preview，缺少 route test。 |
| `src/app/api/admin/logs/route.ts` | GET, DELETE | `requireAdmin` | none | yes | P2 | Admin-only，已有 route-level 测试。 |
| `src/app/api/admin/metrics/route.ts` | GET | `requireAdmin` | none | yes | P2 | Admin-only metrics，已有测试。 |
| `src/app/api/admin/tasks/[id]/route.ts` | GET | `requireAdmin` | none | no | P1 | 当前 admin-only；如果未来开放给非 admin，详情页缺少 userId 隔离。 |
| `src/app/api/admin/tasks/route.ts` | GET | `requireAdmin` | `ownerScopeWhere(user, "userId")` | yes | P1 | 有 future-proof 隔离，但由于 guard 是 admin-only，非 admin 当前不可达。 |
| `src/app/api/admin/users/[id]/route.ts` | GET, PUT, DELETE | `requireAdmin` | none | no | P1 | admin 用户管理缺少 last-admin 和 self-delete 保护测试。 |
| `src/app/api/admin/users/route.ts` | GET, POST | `requireAdmin` | none | no | P1 | admin 用户创建/列表缺少 route tests。 |
| `src/app/api/ai-config/prompts/route.ts` | GET, PUT, POST | `requireAdmin` | none | yes | P2 | 全局 admin config，已有测试。 |
| `src/app/api/ai-config/route.ts` | GET, POST, DELETE | `requireAdmin` | none | yes | P2 | 全局 admin config，已有测试。 |
| `src/app/api/ai-config/test/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only 外部 AI 测试接口，缺少 route test。 |
| `src/app/api/annotations/[id]/route.ts` | PATCH, DELETE | `requireAuth` | `canModifyResource` | yes | P2 | 已添加 owner check；route test 覆盖跨用户拒绝。 |
| `src/app/api/articles/route.ts` | GET | `getUserFromRequest(optional)` | `contentVisibilityWhere`+`mergeWhere` | yes | P2 | 已添加 auth-aware visibility filtering；route test 覆盖隔离。 |
| `src/app/api/auth/change-password/route.ts` | POST | `requireAuth` | current user | no | P2 | 已认证自助接口，缺少 route test。 |
| `src/app/api/auth/check/route.ts` | GET | `requireAuth` | current user | no | P2 | auth check surface 缺少 route test。 |
| `src/app/api/auth/login/route.ts` | POST, GET | `requireAuth` on GET | current user | yes | P2 | login route 已测试。 |
| `src/app/api/auth/logout/route.ts` | POST | none | token revoke | no | P3 | logout 有意设计为 public-idempotent，但缺少测试。 |
| `src/app/api/collectors/mediacrawler/crawl/route.ts` | POST, GET | `requireAdmin` | body `userId` is external platform id | no | P2 | Admin-only，缺少 route test；参数名可能和 RBAC userId 混淆。 |
| `src/app/api/collectors/mediacrawler/status/[runId]/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/collectors/web/collect/route.ts` | POST, GET | `requireAdmin`, `requireAuth` | none | no | P1 | admin/auth 混合行为需要明确 authorization matrix 和测试。 |
| `src/app/api/collectors/wechat/articles/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/collectors/wechat/import/route.ts` | POST | `requireAdmin` | none | yes | P2 | Admin-only import，已有测试。 |
| `src/app/api/collectors/wechat/sources/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/collectors/wechat/sync/confirm/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only confirm，缺少 route test。 |
| `src/app/api/collectors/wechat/sync/preview/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only preview，缺少 route test。 |
| `src/app/api/collectors/wechat/sync/route.ts` | POST | `requireAdmin` | none | yes | P2 | Admin-only sync，已有测试。 |
| `src/app/api/content-items/[id]/annotations/route.ts` | GET, POST, PUT | GET `requireAuth`; POST/PUT `requireAdmin` | GET `canAccessResource` | yes | P2 | GET 已要求 auth 和 ownership check；route test 覆盖未登录和跨用户拒绝。 |
| `src/app/api/content-items/[id]/generate-card/route.ts` | POST | `requireAdmin` | none | yes | P1 | Admin-only generation；生成卡片的 ownership 语义仍需明确测试。 |
| `src/app/api/content-items/[id]/route.ts` | GET, PUT, DELETE | GET `requireAuth`; PUT/DELETE `requireAdmin` | `canAccessResource`, `canModifyResource` | no | P1 | guard 和 ownership checks 已存在；缺少 route tests。 |
| `src/app/api/content-items/[id]/score/route.ts` | POST, GET | `requireAdmin` | none | no | P2 | Admin-only scoring，缺少 route test。 |
| `src/app/api/content-items/assess/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only AI assess，缺少 route test。 |
| `src/app/api/content-items/reassess/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only reassess，缺少 route test。 |
| `src/app/api/content-items/route.ts` | GET, POST | `requireAuth` | `contentVisibilityWhere`+`mergeWhere`, sets `ownerUserId` on create | no | P2 | `mergeWhere` 已修复 OR 组合；缺少 route test。 |
| `src/app/api/discover/route.ts` | GET | none | none | no | P1 | 公开推荐 feed；需要明确 public-data policy 和测试。 |
| `src/app/api/explore/route.ts` | GET | none | none | no | P1 | 公开探索 feed；需要明确 public-data policy 和测试。 |
| `src/app/api/export/route.ts` | GET | `requireAuth` | `ownerScopeWhere` | no | P1 | export 隔离已存在；缺少跨用户 card export 测试。 |
| `src/app/api/health/route.ts` | GET | none | none | no | P3 | health endpoint 有意公开；外网暴露时考虑脱敏配置细节。 |
| `src/app/api/integrations/wewe-rss/delete-missing-sources/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/integrations/wewe-rss/preview-sync/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/integrations/wewe-rss/refresh-source/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/integrations/wewe-rss/status/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/integrations/wewe-rss/sync-sources/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/integrations/wewe-rss/test/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/material-cards/[id]/route.ts` | GET, PUT, DELETE | GET `requireAuth`; PUT/DELETE `requireAdmin` | `canAccessResource`, `canModifyResource` | no | P1 | guard 和 ownership checks 已存在；缺少 route tests。 |
| `src/app/api/material-cards/route.ts` | GET, POST | `requireAuth` | `ownerScopeWhere`+`mergeWhere`, sets `ownerUserId` | no | P2 | `mergeWhere` 已修复 OR 组合；创建时应验证 source content ownership。 |
| `src/app/api/proxy/image/route.ts` | GET | none | allowlist only | no | P2 | public proxy 有 domain/protocol allowlist；应添加 SSRF 回归测试。 |
| `src/app/api/review/route.ts` | GET, POST | `requireAuth` | `ownerScopeWhere`, manual owner check on POST | no | P1 | GET 隔离存在；POST 阻止 non-owner，但无测试。 |
| `src/app/api/search/route.ts` | GET | `requireAuth` | `ownerScopeWhere`+`mergeWhere` | no | P2 | `mergeWhere` 已修复 OR 组合；缺少 route test。 |
| `src/app/api/sources/[id]/channels/[channelId]/route.ts` | PUT, DELETE | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/sources/[id]/channels/route.ts` | GET, POST | `requireAdmin` | none | no | P2 | GET 有 route-level admin-only；proxy 不保护 GET `/api/sources*`，但 route guard 会保护。 |
| `src/app/api/sources/[id]/route.ts` | GET, PUT, DELETE | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/sources/[id]/verify/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/sources/import/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/sources/quality/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only，缺少 route test。 |
| `src/app/api/sources/route.ts` | GET, POST | `requireAdmin` | none | no | P2 | Admin-only route guard 保护两个方法；缺少 route test。 |
| `src/app/api/sync-records/route.ts` | GET | `requireAuth` | `ownerScopeWhere(user, "userId")` | no | P1 | 隔离存在；缺少跨用户测试。 |
| `src/app/api/sync/route.ts` | POST, GET | `requireAdmin` | none | no | P2 | Admin-only sync，缺少 route test。 |

## 覆盖摘要

- API route 文件：58
- route-local API tests：15
- E2E specs：6
- 需要策略复核的公开未认证 API：`/api/discover`、`/api/explore`、`/api/health`、`/api/proxy/image`、`/api/auth/logout`。
