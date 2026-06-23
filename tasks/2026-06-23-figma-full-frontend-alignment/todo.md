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
- [ ] Create task docs and initial mapping.
  - Commit: pending
  - Verification: `git diff --stat`
  - Screenshot: n/a

## Batch 0 - Shell

- [ ] Add shell regression tests before implementation.
  - Commit: pending
  - Verification: targeted Vitest expected RED then GREEN
  - Screenshot: n/a
- [ ] Implement route-aware frontend/auth/admin shell ownership.
  - Commit: pending
  - Verification: targeted Vitest + Playwright shell spec
  - Screenshot: `docs/testing/figma-alignment/shell-*.png`
- [ ] Implement text-only brand, Account Menu, mobile bottom tab, and admin drawer.
  - Commit: pending
  - Verification: targeted Vitest + Playwright shell spec
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

