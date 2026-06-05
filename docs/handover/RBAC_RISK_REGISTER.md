# RBAC Risk Register

Audit date: 2026-06-05

| ID | Severity | Risk | Evidence | Impact | Linked TODO |
| --- | --- | --- | --- | --- | --- |
| RBAC-R001 | P0 | Prisma schema and migration history are out of sync for RBAC. | `schema.prisma` defines `User`, `Session`, owner fields; `prisma/migrations` does not contain matching DDL. | Fresh deploy or migration replay can miss auth tables/columns. | P0 database migration task |
| RBAC-R002 | P0 | Authenticated users can update/delete annotations by id without ownership checks. | `src/app/api/annotations/[id]/route.ts` uses `requireAuth` only and updates/deletes by id. | User A can modify or delete User B annotations if id is known. | P0 annotation ownership task |
| RBAC-R003 | P0 | Annotation list endpoint is unauthenticated and unscoped. | `GET /api/content-items/[id]/annotations` has no guard and queries by `contentItemId`. | Annotation data can be exposed publicly. | P0 annotation GET guard task |
| RBAC-R004 | P0 | `/api/articles` returns all articles without auth or owner filtering. | `src/app/api/articles/route.ts` imports `db` only and queries `contentItem.findMany({ where })`. | Private or user-owned content may be listed outside intended scope. | P0 articles policy task |
| RBAC-R005 | P0 | Prisma `OR` filters can be overwritten by isolation `OR` filters. | `src/app/api/content-items/route.ts` and `src/app/api/search/route.ts` merge `{ ...where, ...ownerFilter }`. | Search filters may be dropped or isolation may be incorrectly composed. | P0 safe where merge task |
| RBAC-R006 | P1 | Null-owner legacy data is visible to non-admin users. | `ownerScopeWhere` and `contentVisibilityWhere` include `{ ownerUserId: null }`. | Historical private data may appear public after multi-user launch. | P1 legacy null-owner policy task |
| RBAC-R007 | P1 | Route tests mock auth guards and do not prove real A/B isolation. | Route tests mock `requireAdmin`/`requireAuth`; E2E covers admin login only. | Regressions in auth extraction or ownership checks can pass CI. | P0/P1 RBAC test matrix tasks |
| RBAC-R008 | P1 | AsyncTask list/detail isolation is admin-only today and underspecified for future non-admin use. | `admin/tasks` uses `requireAdmin`; `ownerScopeWhere` comment says future-proofing. | Future role expansion can leak or hide task records. | P1 AsyncTask role policy task |
| RBAC-R009 | P1 | MaterialCard creation may generate cards for content a user should not use. | `material-cards` POST sets `ownerUserId` but needs source content ownership validation. | User can create derived private artifact from inaccessible content. | P1 material-card create ownership task |
| RBAC-R010 | P2 | Public proxy requires regression tests for SSRF protections. | `/api/proxy/image` has allowlist and private-IP regex but no route test. | A future edit can weaken external fetch safety. | P2 proxy SSRF test task |

## Open Decisions

- Whether `/api/articles`, `/api/discover`, and `/api/explore` are intended public feeds or should require authentication.
- Whether `ownerUserId=null` should remain public compatibility data or be migrated to an admin owner before multi-user launch.
- Whether `VERIFIED_USER` should have separate capabilities beyond plain authenticated user.
