# Batch 0 Validation

Date: 2026-06-21

## Status

Implementation and local validation are complete. Push and Draft PR creation remain.

## Evidence Log

| Command or check | Result | Notes |
| --- | --- | --- |
| Figma MCP identity and approved-node audit | PASS | Six approved nodes exist; no V2/V3 or Auth Shell frame found. |
| Branch baseline | PASS | Created from current `origin/main` after fast-forward verification. |
| Navigation-config test before implementation | EXPECTED FAIL | `navigation-config` module was absent; this established the RED state. |
| AppShell test before implementation | EXPECTED FAIL | `AppShell` module was absent; this established the RED state. |
| `pnpm exec vitest run src/components/layout/__tests__/AppShell.test.tsx src/components/navigation/__tests__/navigation-config.test.ts` | PASS | 2 files, 19 tests passed. |
| Targeted ESLint for layout, auth shell, navigation config, and tests | PASS | Exit code 0. |
| RootNav and MobileBottomTab tests before implementation | EXPECTED FAIL | Missing `aria-current`, mobile navigation name, and safe-area class established the RED state. |
| AccountMenu semantic-query correction | EXPECTED FAIL | Base UI exposes link items as ARIA `menuitem`; tests were corrected to assert menu semantics and hrefs. |
| `pnpm exec vitest run src/components/navigation/__tests__` | PASS | 4 files, 21 tests passed. |
| Targeted ESLint for frontend navigation and AccountMenu | PASS | Exit code 0. |
| Admin navigation test before implementation | EXPECTED FAIL | `admin-navigation` module was absent; this established the grouped-navigation RED state. |
| `pnpm exec vitest run src/components/admin/__tests__/AdminShell.test.tsx src/components/admin/__tests__/admin-navigation.test.ts` | PASS | 2 files, 6 tests passed. |
| Targeted ESLint for admin shell, navigation config, and tests | PASS | Exit code 0. |
| `pnpm exec tsc --noEmit` | FAIL (BASELINE) | Existing errors in archived/current E2E, API route tests, and WeRSS tests; none reference Batch 0 files. The required Next.js build subsequently passed. |
| First focused Batch 0 Playwright run | FAIL, FIXED | 11 passed; two fuzzy navigation locators and one CSS serialization assertion were corrected without reducing behavior coverage. |
| Drawer palette regression test | EXPECTED FAIL, FIXED | Portal content inherited frontend purple; applying `.admin-shell-theme` to the Drawer restored the approved admin green tokens. |
| `pnpm exec playwright test e2e/batch-0-shell.spec.ts --project=admin --workers=1` | PASS | 14 tests; role gates, shell ownership, Drawer behavior, responsive overflow, axe, theme tokens, and screenshots. |
| `pnpm exec playwright test e2e/auth.spec.ts --project=admin --workers=1` | PASS | 19 tests. Initial selector/account-action failures were fixed and the complete suite reran cleanly. |
| Middleware regression (`anonymous`, one worker) | PASS | 14 tests. Anonymous project is required so request fixtures do not inherit admin cookies. |
| Remaining critical regressions (`admin`, one worker) | PASS WITH BASELINE SKIPS | 83 passed, 2 existing fixture-gated article tests skipped. No new skip was added. |
| `pnpm lint` | PASS | Exit 0; 68 existing warnings, 0 errors. |
| `pnpm test` | PASS | 92 files, 854 tests. |
| Isolated current-tree `next build` | PASS | TypeScript completed and 91 pages generated; isolated build avoided an unrelated dev server owning the workspace `.next`. |
| Visual review | PASS | 14 implementation PNGs; developer overlay excluded from evidence only. |

## Required Final Matrix

| Validation | Status |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm test` | PASS |
| `pnpm build` | PASS |
| Focused Playwright | PASS |
| Critical Playwright regressions | PASS WITH 2 BASELINE SKIPS |
| axe | PASS (0 serious/critical) |
| Visual screenshots | PASS (14 PNGs) |
| 390x844 | PASS |
| 768x1024 | PASS |
| 1440x900 | PASS |
| Light | PASS |
| Dark | PASS |

## First-Failure Record

- The first existing auth run exposed fuzzy `首页` matching and an obsolete frontend-account logout path while the page was in `AdminShell`; selectors now follow the accessible UI actually under test.
- The first combined critical run exposed two exact-text selector issues, an overly broad material-card prefix selector, an image-fixture assumption, and a missing async wait. Each was corrected by strengthening the precondition or locator.
- The first combined middleware run used the wrong Playwright project and inherited admin cookies. The complete middleware spec passed under its intended anonymous project.
- Account-menu trace evidence showed the SSR trigger lacked `aria-expanded` until Base UI hydration, so an early click could be swallowed. Waiting for `aria-expanded="false"` removed the race; the final full Batch 0 run passed 14/14 without retry.
