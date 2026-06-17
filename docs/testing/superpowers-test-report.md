## Superpowers E2E Full Test Report

**Date**: 2026-06-14
**Project**: shenlun-material-hub (Next.js 16 + Prisma 7 + PostgreSQL)
**Framework**: Playwright 1.52 / 4 projects (anonymous, userA, verified, admin)
**Environment**: Production mode (`next build && next start`), port 3001

---

### Final Results

| Metric | Value |
|--------|-------|
| Total tests | 413 |
| Passed | 396 |
| Failed | 0 |
| Skipped | 17 |
| Duration | 6.1 min |

### Skipped Tests (17, all intentional)

All skipped tests are conditional — they skip when prerequisites are not met (e.g. no candidate articles for AI assessment, we-mp-rss already available). These are by design, not failures.

---

### Bugs Found and Fixed (Application Code)

**Bug 1: Admin login redirected to `/` instead of `/admin`**

Three locations had hardcoded `"/"` as the post-login redirect destination for admin users. This caused admin login to land on the public homepage instead of the admin dashboard.

Files modified:

- `src/proxy.ts` (line 53): middleware redirect for admin login page
- `src/app/admin/login/page.tsx` (line 27): client-side auth-check redirect for already-logged-in admin users
- `src/app/admin/login/page.tsx` (line 61): post-login redirect fallback when no `?redirect=` param is present

---

### Test Fixes (Test Code Only)

**Fix 1: Logout tests destroying shared admin session**

The logout tests in `admin-auth.spec.ts` and `auth.spec.ts` loaded the shared `admin.json` storageState, then clicked the logout button which called `revokeSession()` — deleting the session from the database. All subsequent tests (navigation, permissions) that relied on the same admin token then failed with 401.

Solution: Changed both logout tests to use empty storageState and create their own fresh admin session via `loginAdminViaForm()` before testing logout. This isolates the destructive logout action from the shared session.

Files modified: `tests/e2e/admin-auth.spec.ts`, `tests/e2e/auth.spec.ts`

**Fix 2: Admin pages have two `<main>` elements (strict mode violation)**

The admin layout renders an outer `<main>` wrapper and an inner page-specific `<main>` content area. Playwright's `page.locator('main')` in strict mode throws when it resolves to 2 elements.

Solution: Changed `page.locator('main')` to `page.locator('main').first()` in all admin-page test assertions.

Files modified: `tests/e2e/admin-content.spec.ts`, `tests/e2e/admin-ai-config.spec.ts`, `tests/e2e/admin-review.spec.ts`, `tests/e2e/ai-assessment.spec.ts`, `tests/e2e/loading-states.spec.ts`, `tests/e2e/sources.spec.ts`, `tests/e2e/we-mp-rss.spec.ts`

---

### Test Suite Progression

| Round | Passed | Failed | Skipped | Notes |
|-------|--------|--------|---------|-------|
| Previous session (Round 2) | 322 | 56 | 17 | Baseline — many admin tests failing |
| This session Round 1 | 378 | 18 | 17 | After initial test additions |
| This session Round 2 | 384 | 12 | 17 | After admin login redirect fix |
| This session Round 3 | 349 | 47 | 17 | Session fix applied, exposed double-main issue |
| This session Round 4 | 396 | 0 | 17 | All fixes applied |

### Test Coverage by Spec File (16 specs, 4 projects)

| Spec File | Tests | Coverage Area |
|-----------|-------|---------------|
| admin-ai-config | 3 | AI config page load, form, access control |
| admin-auth | 5 | Admin login, wrong password, unauth redirect, logout |
| admin-content | 7 | Dashboard, articles, users, tasks, logs, backup, cleanup |
| admin-review | 2 | Article review status, batch AI assess button |
| ai-assessment | 3 | Content page, API endpoints, assessment status |
| api-errors | 6 | 404, 500, network error, API structure |
| article-detail | 3 | Detail page, missing article, learning badge |
| articles | 5 | List, 500 error, tabs, click, anonymous access |
| auth | 9 | Login, register, logout, admin login, wrong password |
| frontend-navigation | 7 | Unauth/auth nav, admin nav links, user/verified nav |
| loading-states | 8 | Loading release for articles/search/cards/review/settings/admin |
| material-cards | 5 | Card list, tabs, click, access control |
| permissions | 11 | Unauth/user/verified/admin access boundaries |
| regression | 22 | All pages no white screen (20 routes + 3 public pages) |
| sources | 1 | Source management page |
| we-mp-rss | 2 | we-mp-rss page, unavailability handling |

### Files Changed Summary

Application code (2 files):
- `src/proxy.ts` — admin login redirect destination
- `src/app/admin/login/page.tsx` — admin login redirect (2 locations)

Test code (9 files):
- `tests/e2e/admin-auth.spec.ts` — logout isolation
- `tests/e2e/auth.spec.ts` — logout isolation
- `tests/e2e/admin-content.spec.ts` — double-main selector fix
- `tests/e2e/admin-ai-config.spec.ts` — double-main selector fix
- `tests/e2e/admin-review.spec.ts` — double-main selector fix
- `tests/e2e/ai-assessment.spec.ts` — double-main selector fix
- `tests/e2e/loading-states.spec.ts` — double-main selector fix
- `tests/e2e/sources.spec.ts` — double-main selector fix
- `tests/e2e/we-mp-rss.spec.ts` — double-main selector fix
