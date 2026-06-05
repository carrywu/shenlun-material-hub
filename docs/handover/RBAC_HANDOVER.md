# RBAC Handover

Audit date: 2026-06-05

## Current Assessment

RBAC is partially implemented and not ready for open multi-user use.

Evidence-backed completed pieces:

- `User` and `Session` models exist in `prisma/schema.prisma`.
- DB session auth exists in `src/lib/auth.ts`.
- Client auth context exists in `src/lib/auth-context.tsx`.
- Global page redirect and partial API protection exist in `src/proxy.ts`.
- Admin-only route guards are present on most admin, collector, AI config, source mutation, and integration routes.
- Ownership fields exist in schema for `ContentItem`, `MaterialCard`, `ArticleAnnotation`, `AsyncTask`, and `SyncRecord`.
- Isolation helpers exist in `src/lib/data-isolation.ts`.

Evidence-backed blockers:

- Migration history does not include RBAC DDL for `User`, `Session`, owner fields, or annotation tables.
- Several API routes are unguarded or under-scoped for multi-user data.
- The current test suite does not prove user A/B isolation.

## Completion Estimate

- Authentication foundation: 90%
- Admin route guard coverage: 85%
- Owner-based data isolation: 80%
- Migration readiness: 95%
- RBAC regression test coverage: 60%
- Multi-user production readiness: 65%

Overall RBAC readiness: about 75%.

## Multi-User Release Blockers

1. ~~Missing RBAC migration SQL for fresh environments.~~ ✅ DONE
2. ~~Annotation update/delete lacks owner checks.~~ ✅ DONE
3. ~~Annotation listing is unauthenticated.~~ ✅ DONE
4. ~~`/api/articles` has no auth or owner filtering.~~ ✅ DONE
5. ~~Search/content list `OR` composition must be fixed and tested.~~ ✅ DONE
6. Null-owner legacy data policy is undecided.
7. ~~No A/B user isolation test suite.~~ ✅ DONE

## Production Deployment Blockers

1. ~~Prisma migration drift between schema, generated client, and migrations.~~ ✅ DONE
2. Default admin password paths still exist and must be operationally controlled.
3. Destructive admin APIs need route tests and runbook clarity.
4. Public API surface needs explicit security policy.
5. Monitoring/backup/restore procedures are incomplete for production operations.

## Role Semantics

Current roles:

- `ADMIN`: operational owner, all admin APIs, all data.
- `VERIFIED_USER`: recognized by `useAuth` and `requireVerifiedUser`, but no clear route capability matrix was found.
- `USER`: authenticated user, can use user-facing APIs where `requireAuth` is used.

Required next step: define a capability matrix for route groups before adding non-admin collaboration features.

## Data Isolation Semantics

Current helper behavior:

- Admin sees all rows.
- Non-admin can see own rows.
- Non-admin can also see null-owner legacy rows.
- Public `ContentItem.visibility` can override strict owner isolation for reads.

Risk: null-owner behavior may be correct for imported public corpus data, but unsafe if historical user-created data exists.

## Test Audit Summary

Current tests:

- 27 Vitest files.
- 177 tests.
- 6 Playwright specs.
- 15 route-local API test files.

Missing high-value tests:

- Unauthenticated access to every protected API group.
- Authenticated non-admin access to admin APIs.
- User A reading User B content/card/annotation/sync/task.
- User A modifying/deleting User B content/card/annotation.
- Search isolation.
- Review isolation.
- AsyncTask isolation.
- SyncRecord isolation.

## Recommended Next Agent Start

Start with `RBAC_RESUME_PROMPT.md`, then implement P0 items from `PROJECT_MASTER_TODO.md` in this order:

1. Fix Prisma migration drift.
2. Add A/B isolation tests that currently fail.
3. Fix annotation routes.
4. Fix articles/search/content list isolation.
5. Re-run lint, tests, build, and Playwright.
