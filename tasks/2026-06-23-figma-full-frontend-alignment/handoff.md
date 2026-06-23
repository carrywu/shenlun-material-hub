# Handoff

## Status

Started. Scope is locked to Figma-verifiable Shell + Article Reader alignment. The current Figma cover/approval gate explicitly approves Batch 1 Shell/navigation and Batch 4 Article Reader only. Missing final Figma frames for the rest of the requested routes are recorded as blockers, not implementation targets.

## Current Branch

`feat/figma-full-frontend-alignment`

## Completed

- Cleaned authorized `.mcp.json` local MCP config change.
- Created feature branch from current `main`.
- Re-read approved Figma nodes with official Figma MCP.
- Re-read current Figma cover metadata (`0:1`) and confirmed the approval scope is Batch 1 + Batch 4 only.
- Added a dedicated no-DB Playwright config/spec for the public authentication pages and saved mobile screenshots.
- Created task directory and initial planning/mapping/validation docs.
- Brought in route-aware Shell implementation from the prior Batch 0 branch.
- Added and passed Shell regression tests for text-only brand, mobile active state, and admin brand contract.
- Removed the stale green admin palette and made Admin/Auth shell surfaces inherit the global brand tokens.
- Audited legacy `wewe-rss`, `subscriptions`, and `sync-records` route pages.
- Added route redirect regression tests for the compatibility routes.
- Re-read Figma reader nodes `14:20`, `14:103`, and `15:20`.
- Added reader layout/role regression tests and aligned the implemented reader regions to the 760px reading column / 320px learning sidebar target.
- Added mobile reader action bar and restored explicit ignore control.
- Gated article IMA sync controls to `VERIFIED_USER` and `ADMIN`.

## In Progress

- Draft PR is open. Remaining full-scope work is blocked by approval-limited Figma scope and unavailable local PostgreSQL for authenticated browser validation.

## Next Step

Provide approved final Figma frame IDs for additional route batches and a PostgreSQL-backed E2E environment, then rerun Playwright/axe/screenshots and update PR #10 before requesting review.

## Risks

- Full-route design implementation cannot be honestly completed from current Figma file because its cover/approval gate only approves Batch 1 and Batch 4.
- Article reader is a large client component; changes must preserve export, annotation, card generation, IMA, and role behavior.
- Browser validation and screenshots are currently blocked by unavailable local PostgreSQL on `localhost:5432`; Playwright global setup cannot seed/login roles without it. Local PostgreSQL CLI binaries (`postgres`, `initdb`, `pg_ctl`, `psql`, `createdb`) are not available on PATH, so a safe temporary local cluster cannot be created here.
- A no-DB browser harness covers `/login`, `/register`, and `/admin/login`. It does not cover `/articles/[id]` because middleware correctly redirects protected article pages to `/login` without a valid DB-backed session.
- Full-route Figma implementation is intentionally not claimed: current Figma file only exposes final Shell + Reader frames from the requested route set.

## Latest Verification

- `pnpm lint`: passed with existing warnings.
- `pnpm test`: passed, 94 files / 862 tests.
- `pnpm build`: passed after removing generated `.next/server/.DS_Store`.
- `pnpm exec playwright test e2e/figma-approved-no-db.spec.ts --config e2e/figma-no-db.playwright.config.ts`: passed, 3 auth-page no-DB tests.
- `pnpm exec eslint e2e/figma-approved-no-db.spec.ts e2e/figma-no-db.playwright.config.ts`: passed.
- `pnpm exec playwright test e2e/batch-0-shell.spec.ts --project=anonymous --project=verified --project=admin`: blocked before assertions by unavailable local PostgreSQL.

## Branch / PR

- Branch: `feat/figma-full-frontend-alignment`
- Remote: `origin/feat/figma-full-frontend-alignment`
- Draft PR: `https://github.com/carrywu/shenlun-material-hub/pull/10`
- Merge status: not merged.
