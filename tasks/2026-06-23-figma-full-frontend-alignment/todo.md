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

- [ ] Add reader capability regression tests before layout changes.
  - Commit: pending
  - Verification: targeted Vitest/Playwright expected RED where applicable, then GREEN
  - Screenshot: n/a
- [ ] Align desktop reader layout to Figma.
  - Commit: pending
  - Verification: `e2e/article-detail.spec.ts`
  - Screenshot: `docs/testing/figma-alignment/article-reader-desktop-*.png`
- [ ] Align mobile reader layout and action surfaces.
  - Commit: pending
  - Verification: `e2e/mobile-responsive.spec.ts`
  - Screenshot: `docs/testing/figma-alignment/article-reader-mobile-*.png`

## Route Audit

- [ ] Audit `/integrations/wewe-rss` and `/admin/integrations/wewe-rss`.
  - Commit: pending
  - Verification: route smoke/middleware tests
  - Screenshot: n/a
- [ ] Implement remove or redirect behavior to `/admin/integrations/wechat-rss`.
  - Commit: pending
  - Verification: route smoke/middleware tests
  - Screenshot: n/a

## Finalization

- [ ] Run lint/test/build.
- [ ] Run targeted Playwright, axe, and responsive checks.
- [ ] Save required screenshots.
- [ ] Update validation and handoff.
- [ ] Push branch and create Draft PR linked to Issue #8.
