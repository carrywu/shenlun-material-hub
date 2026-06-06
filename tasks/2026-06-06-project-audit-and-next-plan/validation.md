# Validation

## 2026-06-06

- Command: `git status --short --branch`
- Result: passed
- Evidence: branch `main...origin/main`; untracked audit/task files created for this task only.
- Notes: no pre-existing dirty tracked diff observed.

- Command: `git log --oneline -20`
- Result: passed
- Evidence: current commit `fb33bfa test: full project quality audit with 3 new E2E specs`.

- Command: `node --version && pnpm --version`
- Result: passed
- Evidence: Node `v24.14.0`; pnpm `11.4.0`.
- Notes: pnpm warns that `package.json` field `pnpm.onlyBuiltDependencies` is ignored by pnpm 11.

- Command: route/spec count scan
- Result: passed
- Evidence: 62 API route files, 15 route-local API tests, 21 Playwright spec files, 28 visual snapshot files.

- Command: `pnpm install`
- Result: passed
- Evidence: `Already up to date`; no dependency install changes required.
- Notes: pnpm 11 warning about ignored `pnpm.onlyBuiltDependencies` remains.

- Command: `pnpm lint`
- Result: passed with warnings
- Evidence: ESLint exited 0; 8 warnings, including unused variables in E2E specs and `src/app/api/content-items/reassess/route.ts`.

- Command: `pnpm test`
- Result: passed
- Evidence: 36 test files passed; 249 tests passed.

- Command: `pnpm build`
- Result: passed
- Evidence: Next.js 16.2.6 compiled successfully, TypeScript finished, 78 static pages generated.

- Command: Playwright targeted browser audit script
- Result: completed with findings
- Evidence: 31 screenshots under `docs/audit/screenshots/`; JSON results in `browser-audit-results.json` and `admin-authenticated-results.json`.
- Notes: `/cards` and article detail screenshot marked visible errors; admin authenticated run caught sync-records user-visible IMA failure text and console issues.

- Command: `curl -i -s -X POST http://localhost:3001/api/auth/login ...`
- Result: passed
- Evidence: HTTP 200, `{"success":true,...}` and `Set-Cookie: auth_token=...`.
- Notes: Confirms admin credentials work; form automation/storageState instability is a Playwright setup issue.

- Command: `pnpm exec playwright test --max-failures=20`
- Result: failed
- Evidence: 26 passed / 20 failed / 3 interrupted / 216 did not run.
- Notes: Failures concentrated in admin/AI tests waiting for h1 while screenshots show login page or auth state loss.

- Command: `pnpm exec playwright test e2e/accessibility.spec.ts --workers=1`
- Result: passed
- Evidence: 24 passed.

- Command: `pnpm exec playwright test e2e/visual-regression.spec.ts --workers=1 --max-failures=5`
- Result: failed
- Evidence: 12 passed / 2 failed.
- Notes: `/explore` and `/discover` expected 1280x720 but received full-page heights around 2800/2942 px.

- Command: `pnpm exec playwright test e2e/dead-link.spec.ts --workers=1 --max-failures=10`
- Result: failed
- Evidence: 10 failed / 12 did not run.
- Notes: Primary failure is false positive from `body.textContent()` containing Next dev inline `404` strings.

- Artifacts:
- `docs/audit/project-audit-todolist.md`
- `docs/audit/project-audit-report.md`
- `docs/audit/next-development-plan.md`
- `docs/audit/development-todolist.md`
- `docs/testing/full-project-validation-report.md`
- `docs/audit/screenshots/*.png`
- `test-results/**/trace.zip`
