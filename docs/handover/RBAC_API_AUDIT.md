# RBAC API Audit

Audit date: 2026-06-05

Legend:

- Guard: route-level use of `requireAuth`, `requireAdmin`, `requireVerifiedUser`, or equivalent.
- Isolation: owner or visibility checks in the route.
- Test: route-local `__tests__/route.test.ts` next to the route.
- Risk:
  - P0: blocks multi-user or production release.
  - P1: important but can follow P0.
  - P2: hardening or coverage gap.
  - P3: accepted public/low-risk surface.

| Route | Methods | Guard | Isolation | Test | Risk | Finding |
| --- | --- | --- | --- | --- | --- | --- |
| `src/app/api/admin/backup/export/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/admin/backup/import/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only destructive import, missing route test. |
| `src/app/api/admin/clean/route.ts` | POST, GET | `requireAdmin` | none | no | P2 | Admin-only clean/preview, missing route test. |
| `src/app/api/admin/logs/route.ts` | GET, DELETE | `requireAdmin` | none | yes | P2 | Admin-only, tested at route level. |
| `src/app/api/admin/metrics/route.ts` | GET | `requireAdmin` | none | yes | P2 | Admin-only metrics, tested. |
| `src/app/api/admin/tasks/[id]/route.ts` | GET | `requireAdmin` | none | no | P1 | Admin-only now; no userId detail isolation if route later opens beyond admin. |
| `src/app/api/admin/tasks/route.ts` | GET | `requireAdmin` | `ownerScopeWhere(user, "userId")` | yes | P1 | Future-proof isolation exists but is unreachable for non-admin because guard is admin-only. |
| `src/app/api/admin/users/[id]/route.ts` | GET, PUT, DELETE | `requireAdmin` | none | no | P1 | Admin user management lacks route tests for last-admin and self-delete protections. |
| `src/app/api/admin/users/route.ts` | GET, POST | `requireAdmin` | none | no | P1 | Admin user creation/listing lacks route tests. |
| `src/app/api/ai-config/prompts/route.ts` | GET, PUT, POST | `requireAdmin` | none | yes | P2 | Global admin config, tested. |
| `src/app/api/ai-config/route.ts` | GET, POST, DELETE | `requireAdmin` | none | yes | P2 | Global admin config, tested. |
| `src/app/api/ai-config/test/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only external AI test, missing route test. |
| `src/app/api/annotations/[id]/route.ts` | PATCH, DELETE | `requireAuth` | `canModifyResource` | yes | P2 | Owner check added; route test covers cross-user denial. |
| `src/app/api/articles/route.ts` | GET | `getUserFromRequest(optional)` | `contentVisibilityWhere`+`mergeWhere` | yes | P2 | Auth and visibility filtering added; route test covers isolation. |
| `src/app/api/auth/change-password/route.ts` | POST | `requireAuth` | current user | no | P2 | Authenticated self-service, missing route test. |
| `src/app/api/auth/check/route.ts` | GET | `requireAuth` | current user | no | P2 | Auth check surface missing route test. |
| `src/app/api/auth/login/route.ts` | POST, GET | `requireAuth` on GET | current user | yes | P2 | Login route tested. |
| `src/app/api/auth/logout/route.ts` | POST | none | token revoke | no | P3 | Logout is intentionally public-idempotent but untested. |
| `src/app/api/collectors/mediacrawler/crawl/route.ts` | POST, GET | `requireAdmin` | body `userId` is external platform id | no | P2 | Admin-only, missing route test; parameter name can confuse RBAC userId. |
| `src/app/api/collectors/mediacrawler/status/[runId]/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/collectors/web/collect/route.ts` | POST, GET | `requireAdmin`, `requireAuth` | none | no | P1 | Mixed admin/auth behavior needs explicit authorization matrix and tests. |
| `src/app/api/collectors/wechat/articles/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/collectors/wechat/import/route.ts` | POST | `requireAdmin` | none | yes | P2 | Admin-only import, tested. |
| `src/app/api/collectors/wechat/sources/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/collectors/wechat/sync/confirm/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/collectors/wechat/sync/preview/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only preview, missing route test. |
| `src/app/api/collectors/wechat/sync/route.ts` | POST | `requireAdmin` | none | yes | P2 | Admin-only sync, tested. |
| `src/app/api/content-items/[id]/annotations/route.ts` | GET, POST, PUT | GET `requireAuth`; POST/PUT `requireAdmin` | GET `canAccessResource` | yes | P2 | GET now requires auth and ownership check; route test covers unauthenticated and cross-user denial. |
| `src/app/api/content-items/[id]/generate-card/route.ts` | POST | `requireAdmin` | none | yes | P1 | Admin-only generation; ownership semantics for generated card need explicit test. |
| `src/app/api/content-items/[id]/route.ts` | GET, PUT, DELETE | GET `requireAuth`; PUT/DELETE `requireAdmin` | `canAccessResource`, `canModifyResource` | no | P1 | Guard and ownership checks exist; missing route tests. |
| `src/app/api/content-items/[id]/score/route.ts` | POST, GET | `requireAdmin` | none | no | P2 | Admin-only scoring, missing route test. |
| `src/app/api/content-items/assess/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only AI assess, missing route test. |
| `src/app/api/content-items/reassess/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only reassess, missing route test. |
| `src/app/api/content-items/route.ts` | GET, POST | `requireAuth` | `contentVisibilityWhere`+`mergeWhere`, sets `ownerUserId` on create | no | P2 | `mergeWhere` fixes OR composition; missing route test. |
| `src/app/api/discover/route.ts` | GET | none | none | no | P1 | Public recommendation feed; needs explicit public-data policy and test. |
| `src/app/api/explore/route.ts` | GET | none | none | no | P1 | Public exploration feed; needs explicit public-data policy and test. |
| `src/app/api/export/route.ts` | GET | `requireAuth` | `ownerScopeWhere` | no | P1 | Export isolation exists; missing route test for cross-user card export. |
| `src/app/api/health/route.ts` | GET | none | none | no | P3 | Health endpoint intentionally public; consider redacting config details if exposed externally. |
| `src/app/api/integrations/wewe-rss/delete-missing-sources/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/integrations/wewe-rss/preview-sync/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/integrations/wewe-rss/refresh-source/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/integrations/wewe-rss/status/route.ts` | GET | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/integrations/wewe-rss/sync-sources/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/integrations/wewe-rss/test/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/material-cards/[id]/route.ts` | GET, PUT, DELETE | GET `requireAuth`; PUT/DELETE `requireAdmin` | `canAccessResource`, `canModifyResource` | no | P1 | Guard and ownership checks exist; missing route tests. |
| `src/app/api/material-cards/route.ts` | GET, POST | `requireAuth` | `ownerScopeWhere`+`mergeWhere`, sets `ownerUserId` | no | P2 | `mergeWhere` fixes OR composition; creation should verify source content ownership. |
| `src/app/api/proxy/image/route.ts` | GET | none | allowlist only | no | P2 | Public proxy has domain/protocol allowlist; add SSRF regression tests. |
| `src/app/api/review/route.ts` | GET, POST | `requireAuth` | `ownerScopeWhere`, manual owner check on POST | no | P1 | GET isolation exists; POST blocks non-owner but no tests. |
| `src/app/api/search/route.ts` | GET | `requireAuth` | `ownerScopeWhere`+`mergeWhere` | no | P2 | `mergeWhere` fixes OR composition; missing route test. |
| `src/app/api/sources/[id]/channels/[channelId]/route.ts` | PUT, DELETE | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/sources/[id]/channels/route.ts` | GET, POST | `requireAdmin` | none | no | P2 | GET is admin-only route-level, but proxy does not protect GET `/api/sources*`; route guard does. |
| `src/app/api/sources/[id]/route.ts` | GET, PUT, DELETE | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/sources/[id]/verify/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/sources/import/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/sources/quality/route.ts` | POST | `requireAdmin` | none | no | P2 | Admin-only, missing route test. |
| `src/app/api/sources/route.ts` | GET, POST | `requireAdmin` | none | no | P2 | Admin-only route guard protects both methods; missing route test. |
| `src/app/api/sync-records/route.ts` | GET | `requireAuth` | `ownerScopeWhere(user, "userId")` | no | P1 | Isolation exists; missing cross-user test. |
| `src/app/api/sync/route.ts` | POST, GET | `requireAdmin` | none | no | P2 | Admin-only sync, missing route test. |

## Coverage Summary

- API route files: 58
- Route-local API tests: 15
- E2E specs: 6
- Public unauthenticated APIs that require policy review: `/api/discover`, `/api/explore`, `/api/health`, `/api/proxy/image`, `/api/auth/logout`.
