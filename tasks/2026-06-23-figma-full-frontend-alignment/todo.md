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

- [ ] Run lint/test/build.
- [ ] Run targeted Playwright, axe, and responsive checks.
- [ ] Save required screenshots.
- [ ] Update validation and handoff.
- [ ] Push branch and create Draft PR linked to Issue #8.
