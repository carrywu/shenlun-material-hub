# Todo

Status values: `todo`, `doing`, `blocked`, `done`.

## Setup

- [x] Clean authorized `.mcp.json` local Figma MCP change.
  - Commit: n/a
  - Verification: `git status --short --branch`
  - Screenshot: n/a
- [x] Create branch `feat/figma-full-frontend-alignment` from `main`.
  - Commit: n/a
  - Verification: `git switch main && git pull --ff-only origin main && git switch -c feat/figma-full-frontend-alignment`
  - Screenshot: n/a
- [x] Re-read Figma approved nodes.
  - Commit: n/a
  - Verification: Figma MCP `use_figma` read-only node scan
  - Screenshot: pending
- [x] Re-read current Figma cover and approval gate.
  - Commit: this commit (`Record current Figma approval boundary`)
  - Verification: Figma MCP `get_metadata` for `0:1`; `rg -n "Approval Scope|No approved" tasks/2026-06-23-figma-full-frontend-alignment/figma-code-map.md`
  - Screenshot: n/a
- [x] Create task docs and initial mapping.
  - Commit: `2d695be`
  - Verification: `git diff --stat`, `git status --short --branch`
  - Screenshot: n/a

## Batch 0 - Shell

- [x] Add shell regression tests before implementation.
  - Commit: this commit (`Keep app chrome aligned with the approved text-only shell`)
  - Verification: `pnpm exec vitest run src/components/navigation/__tests__/RootNav.test.tsx src/components/navigation/__tests__/MobileBottomTab.test.tsx src/components/admin/__tests__/AdminShell.test.tsx` expected RED, then GREEN
  - Screenshot: n/a
- [x] Implement route-aware frontend/auth/admin shell ownership.
  - Commit: `aa84a15`, this commit (`Keep app chrome aligned with the approved text-only shell`)
  - Verification: `pnpm exec vitest run src/components/layout/__tests__/AppShell.test.tsx src/components/navigation/__tests__ src/components/admin/__tests__`; Playwright pending
  - Screenshot: `docs/testing/figma-alignment/shell-*.png`
- [x] Implement text-only brand, Account Menu, mobile bottom tab, and admin drawer.
  - Commit: `25032db`, `c7b6c99`, this commit (`Keep app chrome aligned with the approved text-only shell`)
  - Verification: `pnpm exec vitest run src/components/layout/__tests__/AppShell.test.tsx src/components/navigation/__tests__ src/components/admin/__tests__`; Playwright pending
  - Screenshot: `docs/testing/figma-alignment/account-menu-open-*.png`

## Batch 4 - Article Reader

- [x] Add reader capability regression tests before layout changes.
  - Commit: this commit (`Align reader layout regions with Figma while preserving capabilities`)
  - Verification: `pnpm exec vitest run 'src/app/articles/[id]/__tests__/page.test.tsx'` expected RED, then GREEN
  - Screenshot: n/a
- [x] Align desktop reader layout to Figma.
  - Commit: this commit (`Align reader layout regions with Figma while preserving capabilities`)
  - Verification: `pnpm exec vitest run 'src/app/articles/[id]/__tests__/page.test.tsx' src/components/articles/__tests__/ArticleContentRenderer.test.tsx src/components/articles/__tests__/ArticleExportMenu.test.tsx src/components/articles/__tests__/ArticlePrintableContent.test.tsx`; Playwright blocked by PostgreSQL
  - Screenshot: `docs/testing/figma-alignment/article-reader-desktop-*.png`
- [x] Align mobile reader layout and action surfaces.
  - Commit: this commit (`Align reader layout regions with Figma while preserving capabilities`)
  - Verification: `pnpm exec eslint 'src/app/articles/[id]/page.tsx' 'src/app/articles/[id]/__tests__/page.test.tsx' src/components/articles/ArticleContentRenderer.tsx src/components/articles/ArticleExportMenu.tsx`; Playwright blocked by PostgreSQL
  - Screenshot: `docs/testing/figma-alignment/article-reader-mobile-*.png`

## Route Audit

- [x] Audit `/integrations/wewe-rss` and `/admin/integrations/wewe-rss`.
  - Commit: this commit (`Keep legacy integration routes as explicit redirects`)
  - Verification: `sed -n` route inspection; `rg --files src/app | rg 'wewe-rss|wechat-rss|integrations|subscriptions|sync-records'`
  - Screenshot: n/a
- [x] Implement remove or redirect behavior to `/admin/integrations/wechat-rss`.
  - Commit: this commit (`Keep legacy integration routes as explicit redirects`)
  - Verification: `pnpm exec vitest run src/app/__tests__/legacy-route-redirects.test.ts`; `pnpm exec eslint src/app/__tests__/legacy-route-redirects.test.ts src/app/integrations/wewe-rss/page.tsx src/app/admin/integrations/wewe-rss/page.tsx src/app/subscriptions/page.tsx src/app/sync-records/page.tsx`
  - Screenshot: n/a

## Finalization

- [x] Run lint/test/build.
  - Commit: `9290130`
  - Verification: `pnpm lint`; `pnpm test`; `pnpm build`
  - Screenshot: n/a
- [ ] Run targeted Playwright, axe, and responsive checks.
  - Commit: partial no-DB auth evidence pending
  - Verification: `pnpm exec playwright test e2e/figma-approved-no-db.spec.ts --config e2e/figma-no-db.playwright.config.ts` passed for `/login`, `/register`, `/admin/login`; authenticated shell/reader/admin checks remain blocked by unavailable local PostgreSQL on `localhost:5432`
  - Screenshot: `docs/testing/figma-alignment/auth-*-mobile-light-no-db.png`
- [ ] Save required screenshots.
  - Commit: partial no-DB auth evidence pending
  - Verification: no-DB auth screenshots saved; authenticated role/admin/reader screenshots remain blocked by unavailable local PostgreSQL on `localhost:5432`
  - Screenshot: `docs/testing/figma-alignment/auth-login-mobile-light-no-db.png`, `docs/testing/figma-alignment/auth-register-mobile-light-no-db.png`, `docs/testing/figma-alignment/auth-admin-login-mobile-light-no-db.png`
- [x] Update validation and handoff.
  - Commit: `9290130`, this commit (`Document Draft PR handoff state`)
  - Verification: task docs updated
  - Screenshot: n/a
- [x] Push branch and create Draft PR linked to Issue #8.
  - Commit: this commit (`Document Draft PR handoff state`)
  - Verification: `git push -u origin feat/figma-full-frontend-alignment`; `gh pr create --draft --base main --head feat/figma-full-frontend-alignment`
  - Screenshot: n/a
