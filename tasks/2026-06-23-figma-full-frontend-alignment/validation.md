# Validation

## 2026-06-23

- Command: `git status --short --branch`
- Result: passed
- Evidence: clean worktree before branch creation.
- Notes: `.mcp.json` local Figma MCP config containing a Figma API key was removed with user approval.

- Command: `git fetch origin && git switch main && git pull --ff-only origin main && git switch -c feat/figma-full-frontend-alignment`
- Result: passed after retry
- Evidence: first fetch failed with transient GitHub SSL error; retry succeeded and branch was created.
- Notes: branch is based on current `origin/main`.

- Command: Figma MCP read-only `use_figma` scan
- Result: passed
- Evidence: approved nodes `17:2`, `17:89`, `8:2`, `8:48`, `12:19`, `12:162`, `14:20`, `14:103`, `15:20`, `16:113` all found.
- Notes: no final frames found for full route set beyond shell/reader scope.

- Command: Figma MCP `get_metadata` for `0:1`
- Result: passed
- Evidence: top-level file contains one page, `00 Cover & Index`; cover text node `16:7` says current approval scope is Batch 1 Shell/navigation and Batch 4 Article Reader; approval gate node `16:30` requires Figma URL, Frame/Node ID, and Batch before source/API/Prisma/database/RBAC/business-semantic changes.
- Notes: this confirms the remaining full-route pages are blocked by current design approval scope, not by repo inspection.

- Command: `pnpm exec vitest run src/components/navigation/__tests__/RootNav.test.tsx src/components/navigation/__tests__/MobileBottomTab.test.tsx src/components/admin/__tests__/AdminShell.test.tsx`
- Result: failed as expected before implementation, then passed after implementation
- Evidence: RED failures covered text-only brand, mobile active background, and admin brand contract; GREEN result passed 3 files / 8 tests.
- Notes: regression tests were added before the local Shell patch.

- Command: `pnpm exec vitest run src/components/layout/__tests__/AppShell.test.tsx src/components/navigation/__tests__ src/components/admin/__tests__`
- Result: passed
- Evidence: 7 test files / 33 tests passed.
- Notes: covers route-aware shell ownership, role-aware frontend nav, Account Menu surface, admin shell grouping, drawer basics, text-only brand, and active mobile tab styling.

- Command: `rg -n "#244936|#91b29b|#5f806d|5f806d|91b29b|244936" src e2e tasks || true`
- Result: passed
- Evidence: no matches.
- Notes: removed stale green admin palette in favor of global brand tokens.

- Command: `pnpm exec eslint src/components/RootNav.tsx src/components/MobileBottomTab.tsx src/components/admin/AdminShell.tsx src/components/layout/AuthShell.tsx src/components/navigation/__tests__/RootNav.test.tsx src/components/navigation/__tests__/MobileBottomTab.test.tsx src/components/admin/__tests__/AdminShell.test.tsx e2e/batch-0-shell.spec.ts`
- Result: passed
- Evidence: command exited 0.
- Notes: targeted lint for the Shell patch.

- Command: `pnpm exec playwright test e2e/batch-0-shell.spec.ts --project=anonymous --project=verified --project=admin`
- Result: failed before browser assertions
- Evidence: `seed:e2e-accounts` failed with PostgreSQL connection timeout; `globalSetup` then failed admin API login with HTTP 500.
- Notes: `.env` contains `DATABASE_URL` for `localhost:5432/shenlun_material_hub`, but no local listener was found on port 5432. Per project rules, Docker/database services were not auto-started.

- Command: `command -v postgres || true; command -v initdb || true; command -v pg_ctl || true; command -v psql || true; command -v createdb || true`
- Result: passed
- Evidence: no local PostgreSQL command-line binaries were found on PATH.
- Notes: a safe temporary PostgreSQL data directory cannot be created from local binaries in this environment.

- Command: `lsof -iTCP:5432 -sTCP:LISTEN -n -P || true; lsof -iTCP:3001 -sTCP:LISTEN -n -P || true`
- Result: passed
- Evidence: no listener on 5432; existing `node` process listening on 3001.
- Notes: Playwright web server reuse is possible, but authenticated browser setup still fails without PostgreSQL.

- Command: `pnpm exec playwright test e2e/figma-approved-no-db.spec.ts --config e2e/figma-no-db.playwright.config.ts`
- Result: failed as expected before implementation
- Evidence: first run failed because `e2e/figma-no-db.playwright.config.ts` did not exist.
- Notes: RED step for a dedicated no-DB browser evidence harness.

- Command: `pnpm exec playwright test e2e/figma-approved-no-db.spec.ts --config e2e/figma-no-db.playwright.config.ts`
- Result: failed during implementation, then passed after scope correction
- Evidence: intermediate run passed auth pages but `/articles/[id]` redirected to `/login`, proving reader browser checks require an authenticated session and therefore PostgreSQL-backed session validation. Final run passed 3 tests for `/login`, `/register`, and `/admin/login`.
- Notes: no-DB harness intentionally covers only auth pages, because protected frontend/admin/reader routes require real session validation.

- Command: `pnpm exec eslint e2e/figma-approved-no-db.spec.ts e2e/figma-no-db.playwright.config.ts`
- Result: passed
- Evidence: command exited 0.
- Notes: targeted lint for the no-DB Playwright harness.

- Command: `pnpm lint`
- Result: passed
- Evidence: command exited 0 with 67 existing warnings.
- Notes: rerun after adding the no-DB Playwright harness.

- Screenshots: `docs/testing/figma-alignment/auth-login-mobile-light-no-db.png`, `docs/testing/figma-alignment/auth-register-mobile-light-no-db.png`, `docs/testing/figma-alignment/auth-admin-login-mobile-light-no-db.png`
- Result: generated
- Evidence: saved by the passing no-DB Playwright run.
- Notes: authenticated role, shell, admin, and reader screenshots remain blocked by PostgreSQL.

- Command: `pnpm exec vitest run src/app/__tests__/legacy-route-redirects.test.ts`
- Result: passed
- Evidence: 1 test file / 4 tests passed.
- Notes: covers `/integrations/wewe-rss`, `/admin/integrations/wewe-rss`, `/subscriptions`, and `/sync-records` compatibility redirects.

- Command: `pnpm exec eslint src/app/__tests__/legacy-route-redirects.test.ts src/app/integrations/wewe-rss/page.tsx src/app/admin/integrations/wewe-rss/page.tsx src/app/subscriptions/page.tsx src/app/sync-records/page.tsx`
- Result: passed
- Evidence: command exited 0.
- Notes: targeted lint for route audit test and redirect pages.

- Command: `pnpm exec vitest run 'src/app/articles/[id]/__tests__/page.test.tsx'`
- Result: failed as expected before implementation, then passed after implementation
- Evidence: RED failed on missing `article-reader-shell`; GREEN passed 1 file / 3 tests.
- Notes: covers reader region markers and USER / VERIFIED_USER / ADMIN capability surfaces.

- Command: `pnpm exec vitest run 'src/app/articles/[id]/__tests__/page.test.tsx' src/components/articles/__tests__/ArticleContentRenderer.test.tsx src/components/articles/__tests__/ArticleExportMenu.test.tsx src/components/articles/__tests__/ArticlePrintableContent.test.tsx`
- Result: passed
- Evidence: 4 test files / 24 tests passed.
- Notes: covers page layout contracts plus article content rendering, export menu options, and printable content.

- Command: `pnpm exec eslint 'src/app/articles/[id]/page.tsx' 'src/app/articles/[id]/__tests__/page.test.tsx' src/components/articles/ArticleContentRenderer.tsx src/components/articles/ArticleExportMenu.tsx`
- Result: passed
- Evidence: command exited 0.
- Notes: targeted lint for reader patch.

## Pending

- Auth-page no-DB Playwright/axe/screenshots: partial pass
- Authenticated Shell/Reader/Admin Playwright: blocked by unavailable PostgreSQL
- Authenticated Shell/Reader/Admin axe: blocked by unavailable PostgreSQL
- Authenticated Shell/Reader/Admin screenshots: blocked by unavailable PostgreSQL

## Final Local Commands

- Command: `pnpm lint`
- Result: passed
- Evidence: command exited 0 with 67 existing warnings.
- Notes: no lint errors.

- Command: `pnpm test`
- Result: passed
- Evidence: 94 test files / 862 tests passed.
- Notes: full Vitest suite.

- Command: `pnpm build`
- Result: failed once, then passed after cleaning generated `.next/server/.DS_Store`
- Evidence: first run failed with `ENOTEMPTY: directory not empty, rmdir '.next/server'`; `.next/server` contained `.DS_Store` and no open file handles. Second run completed successfully and generated 91 static pages.
- Notes: build failure was a generated artifact cleanup issue, not a TypeScript or compilation failure.

- Command: `git push -u origin feat/figma-full-frontend-alignment`
- Result: passed
- Evidence: branch now tracks `origin/feat/figma-full-frontend-alignment`.
- Notes: no merge was performed.

- Command: `gh pr create --draft --base main --head feat/figma-full-frontend-alignment`
- Result: passed
- Evidence: Draft PR #10 created at `https://github.com/carrywu/shenlun-material-hub/pull/10`.
- Notes: PR body links Issue #8 and lists completed, missing, and blocked validation scope.
