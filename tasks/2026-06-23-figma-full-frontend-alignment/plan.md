# Figma Full Frontend Alignment Plan

Date: 2026-06-23
Branch: `feat/figma-full-frontend-alignment`
Figma file: https://www.figma.com/design/eDNdcn58oWO1xagFvJf68b

## Problem Summary

The requested end state is full frontend alignment with the approved Figma redesign. A fresh Figma MCP scan shows the file contains verified final frames for foundations, shared components, Batch 1 shell, and Batch 4 article reader. It does not contain final high-fidelity frames for the rest of the full route list.

## Current Behavior

- `main` renders `RootNav` and `MobileBottomTab` from the root layout for every route, so admin and auth routes can inherit frontend chrome.
- `RootNav` still displays role, username, admin link, and logout as flat top-level controls.
- `/admin/login` is excluded from `AdminShell`, but root frontend chrome still comes from `src/app/layout.tsx`.
- The article reader route is implemented by `src/app/articles/[id]/page.tsx`, not legacy `src/components/ArticleDetail.tsx`.
- `/integrations/wewe-rss` and `/admin/integrations/wewe-rss` exist and need route audit.

## Expected Behavior

- Implement only the Figma-verifiable scope first: foundations/shell plus article reader.
- Create a design-to-code map for all requested routes; mark routes without final Figma frames as `有阻塞`.
- Preserve API, Prisma, RBAC, data isolation, authentication, AI, IMA, export, annotations, and existing business contracts.
- Keep auth pages without app navigation, admin pages without frontend navigation, and `/admin/login` without `AdminShell`.
- Use text-only brand `申论素材`; no left brand icon block.
- Use Lucide icons, shadcn/Base UI primitives, Tailwind CSS variables, and no new dependencies.

## Suspected Root Cause

The repository has prior incremental UI work but the current `main` branch does not include the route-aware shell architecture from `feat/batch-0-shell-implementation`. The approved Figma file was originally prepared for Batch 1 and Batch 4, not for every route named in the full delivery prompt.

## Files To Inspect

- `src/app/layout.tsx`
- `src/app/admin/layout.tsx`
- `src/components/RootNav.tsx`
- `src/components/MobileBottomTab.tsx`
- `src/components/admin/AdminShell.tsx`
- `src/app/articles/[id]/page.tsx`
- `src/components/articles/ArticleContentRenderer.tsx`
- `src/components/articles/ArticleExportMenu.tsx`
- `src/proxy.ts`
- `e2e/batch-0-shell.spec.ts`
- `e2e/article-detail.spec.ts`
- `e2e/accessibility.spec.ts`
- `e2e/mobile-responsive.spec.ts`

## Planned Changes

1. Add task docs, Figma map, gap report, and validation log.
2. Lock shell behavior with tests, then implement route-aware `AppShell`, `AuthShell`, Account Menu, text-only RootNav, safe-area mobile tab, and admin drawer/sidebar shell.
3. Align shell tokens with Figma variables while preserving project CSS variable semantics.
4. Lock article reader capability coverage with tests, then align desktop/mobile layout to the Figma reader frames.
5. Audit `wewe-rss` routes and remove or redirect them to the supported `wechat-rss` admin integration path if no current contract depends on them.
6. Run targeted and standard validation, collect screenshots, update task docs, commit in small slices, push branch, and open Draft PR.

## Tests To Add

- Shell route classification and chrome exclusivity tests.
- Role-aware frontend navigation and account menu tests.
- Admin shell mobile drawer and sidebar tests.
- Reader layout and capability regression tests for export, annotations, role-specific actions, and no horizontal overflow.
- Route audit tests for removed or redirected `wewe-rss` paths.

## Validation Commands

```bash
pnpm exec vitest run src/components/navigation/__tests__ src/components/layout/__tests__ src/components/admin/__tests__
pnpm exec playwright test e2e/batch-0-shell.spec.ts --project=admin --workers=1
pnpm exec playwright test e2e/article-detail.spec.ts e2e/accessibility.spec.ts e2e/mobile-responsive.spec.ts --project=admin --workers=1
pnpm lint
pnpm test
pnpm build
```

## Risks / Rollback Plan

- Risk: Figma file does not contain final full-page designs for every requested route. Mitigation: do not infer missing pages; mark as `有阻塞`.
- Risk: shell refactor can break auth/admin route boundaries. Mitigation: write tests before production changes and run Playwright.
- Risk: article reader has many capabilities in one component. Mitigation: preserve existing behavior and change layout incrementally.
- Rollback: each slice is committed separately; revert the smallest failing commit.

