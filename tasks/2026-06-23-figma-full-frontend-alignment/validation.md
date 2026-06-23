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

- Command: `pnpm exec vitest run src/app/__tests__/legacy-route-redirects.test.ts`
- Result: passed
- Evidence: 1 test file / 4 tests passed.
- Notes: covers `/integrations/wewe-rss`, `/admin/integrations/wewe-rss`, `/subscriptions`, and `/sync-records` compatibility redirects.

- Command: `pnpm exec eslint src/app/__tests__/legacy-route-redirects.test.ts src/app/integrations/wewe-rss/page.tsx src/app/admin/integrations/wewe-rss/page.tsx src/app/subscriptions/page.tsx src/app/sync-records/page.tsx`
- Result: passed
- Evidence: command exited 0.
- Notes: targeted lint for route audit test and redirect pages.

## Pending

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Targeted Playwright (blocked by unavailable PostgreSQL)
- axe
- Screenshots
