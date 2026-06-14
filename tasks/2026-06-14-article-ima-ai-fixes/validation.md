# Validation Log

## Initial State

- `git status --short` showed only the two previously generated docs before workflow artifacts were added:
  - `docs/superpowers/plans/2026-06-14-article-ima-ai-fixes.md`
  - `docs/superpowers/specs/2026-06-14-article-ima-ai-requirements.md`

## Commands

Record each command as:

```text
Command:
Result:
Key output:
Follow-up:
```

```text
Command: pnpm test src/lib/__tests__/display-labels.test.ts
Result: FAIL as expected
Key output: getAiDecisionLabel is not a function; getSyncStatusLabel is not a function
Follow-up: Implement shared label helpers in src/lib/display-labels.ts
```

```text
Command: pnpm test src/lib/__tests__/display-labels.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 15 passed
Follow-up: Scan targeted UI files for lowercase IMA and direct AI decision display.
```

```text
Command: rg -n "同步到 ima|ima 知识库|AI 状态：\{|decisionLabel = article\.aiDecision|accepted|rejected|unknown" 'src/app/articles/[id]/page.tsx' src/components/SyncToIma.tsx src/components/sync/SyncRecordsPage.tsx src/app/cards/page.tsx
Result: PASS
Key output: Only helper-based AI 状态 line remains in article detail.
Follow-up: Commit Task 1 slice.
```

```text
Command: pnpm test src/app/api/content-items/reassess/__tests__/route.test.ts
Result: FAIL as expected
Key output: Verified user was not rejected and reassess failure did not persist latest AI error metadata.
Follow-up: Restrict reassess to admin and persist aiLastError / aiLastFailedAt without clearing old result.
```

```text
Command: pnpm test src/lib/__tests__/display-labels.test.ts
Result: FAIL as expected
Key output: getAiAssessmentSourceLabel is not a function.
Follow-up: Add shared AI assessment source label helper.
```

```text
Command: pnpm test src/lib/__tests__/display-labels.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 16 passed
Follow-up: Continue route-level provenance tests.
```

```text
Command: pnpm test 'src/app/api/content-items/[id]/__tests__/route.test.ts'
Result: PASS
Key output: Test Files 1 passed; Tests 7 passed
Follow-up: Confirm detail response preserves AI provenance metadata.
```

```text
Command: pnpm test src/app/api/content-items/reassess/__tests__/route.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 2 passed
Follow-up: Verify batch assessment route still passes.
```

```text
Command: pnpm test src/app/api/content-items/assess/__tests__/route.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 3 passed
Follow-up: Run type check and Prisma generate.
```

```text
Command: pnpm exec tsc --noEmit
Result: FAIL
Key output: tests/e2e/permissions.spec.ts(78,21): TS2774 existing function-reference condition always returns true.
Follow-up: Record as pre-existing unrelated typecheck blocker; continue targeted verification for current slice.
```

```text
Command: pnpm db:generate
Result: PASS
Key output: Generated Prisma Client (7.8.0) to ./src/generated/prisma
Follow-up: Commit Task 2 slice.
```

```text
Command: pnpm exec eslint 'src/app/articles/[id]/page.tsx' src/lib/display-labels.ts src/app/api/content-items/assess/route.ts src/app/api/content-items/reassess/route.ts
Result: PASS
Key output: No lint errors reported.
Follow-up: Run combined targeted tests after TSX hash-display adjustment.
```

```text
Command: pnpm test src/lib/__tests__/display-labels.test.ts 'src/app/api/content-items/[id]/__tests__/route.test.ts' src/app/api/content-items/reassess/__tests__/route.test.ts src/app/api/content-items/assess/__tests__/route.test.ts
Result: PASS
Key output: Test Files 4 passed; Tests 28 passed
Follow-up: Commit Task 2 slice.
```

```text
Command: pnpm test src/components/articles/__tests__/ArticleContentRenderer.test.tsx
Result: FAIL as expected
Key output: Failed to resolve import ../ArticleContentRenderer.
Follow-up: Implement ArticleContentRenderer.
```

```text
Command: pnpm test src/components/articles/__tests__/ArticleContentRenderer.test.tsx
Result: FAIL
Key output: Paragraph newline assertion used toHaveTextContent, which normalizes whitespace.
Follow-up: Change assertion to inspect textContent directly.
```

```text
Command: pnpm test src/components/articles/__tests__/ArticleContentRenderer.test.tsx
Result: PASS
Key output: Test Files 1 passed; Tests 4 passed
Follow-up: Run target lint for renderer and article detail integration.
```

```text
Command: pnpm exec eslint src/components/articles/ArticleContentRenderer.tsx src/components/articles/__tests__/ArticleContentRenderer.test.tsx 'src/app/articles/[id]/page.tsx'
Result: PASS
Key output: No lint errors reported.
Follow-up: Commit Task 3 slice.
```

```text
Command: pnpm test src/services/__tests__/ima-sync.test.ts
Result: FAIL as expected
Key output: ImaService was undefined; current service did not expose unified structured operations.
Follow-up: Implement ImaService with structured item results, duplicate skip, batch summary, and health check.
```

```text
Command: pnpm test src/services/__tests__/ima-sync.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 5 passed
Follow-up: Add API route tests for /api/sync and /api/ima/health.
```

```text
Command: pnpm test src/app/api/sync/__tests__/route.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 2 passed
Follow-up: Verify health route.
```

```text
Command: pnpm test src/app/api/ima/health/__tests__/route.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 2 passed
Follow-up: Run target lint.
```

```text
Command: pnpm exec eslint src/services/ima-sync.ts src/services/__tests__/ima-sync.test.ts src/app/api/sync/route.ts src/app/api/sync/__tests__/route.test.ts src/app/api/ima/health/route.ts src/app/api/ima/health/__tests__/route.test.ts
Result: PASS
Key output: No lint errors reported.
Follow-up: Commit Task 4 backend service/API slice.
```

```text
Command: pnpm test src/components/__tests__/SyncToIma.test.tsx
Result: PASS
Key output: Test Files 1 passed; Tests 2 passed
Follow-up: Run target lint for batch sync UI.
```

```text
Command: pnpm exec eslint src/components/SyncToIma.tsx src/components/__tests__/SyncToIma.test.tsx src/app/cards/page.tsx
Result: PASS
Key output: No lint errors reported.
Follow-up: Commit Task 5 batch sync UI slice.
```

```text
Command: pnpm db:generate
Result: PASS
Key output: Generated Prisma Client (7.8.0) to ./src/generated/prisma
Follow-up: Run article sync route tests.
```

```text
Command: pnpm test 'src/app/api/articles/[id]/sync-to-ima/__tests__/route.test.ts'
Result: PASS
Key output: Test Files 1 passed; Tests 3 passed
Follow-up: Run IMA service regression tests.
```

```text
Command: pnpm test src/services/__tests__/ima-sync.test.ts
Result: PASS
Key output: Test Files 1 passed; Tests 5 passed
Follow-up: Run target lint.
```

```text
Command: pnpm exec eslint src/services/ima-sync.ts 'src/app/api/articles/[id]/sync-to-ima/route.ts' 'src/app/api/articles/[id]/sync-to-ima/__tests__/route.test.ts' 'src/app/articles/[id]/page.tsx'
Result: PASS
Key output: No lint errors reported.
Follow-up: Commit Task 6 article detail sync slice.
```

```text
Command: pnpm exec eslint src/app/settings/ima/page.tsx
Result: PASS
Key output: No lint errors reported.
Follow-up: Commit Task 7 health UI slice; Playwright coverage remains pending.
```

```text
Command: pnpm exec playwright test -c tests/e2e/playwright.config.ts --project=admin tests/e2e/article-detail.spec.ts tests/e2e/article-ima-sync.spec.ts tests/e2e/material-card-batch-sync.spec.ts tests/e2e/ima-health.spec.ts
Result: FAIL
Key output: App served stale build before production rebuild; article detail sync button and new routes were not present in the running app.
Follow-up: Run production build before rerunning Playwright.
```

```text
Command: pnpm build
Result: PASS
Key output: Compiled successfully; type checking completed; Next route list generated.
Follow-up: Apply pending non-destructive Prisma migrations before E2E.
```

```text
Command: DATABASE_URL='postgresql://shenlun:shenlun_dev@localhost:5432/shenlun_material_hub?schema=public' pnpm db:migrate
Result: PASS
Key output: Applied migrations 20260614185100_article_ai_provenance and 20260614192000_sync_record_article_fallback.
Follow-up: Rerun targeted Playwright.
```

```text
Command: pnpm exec playwright test -c tests/e2e/playwright.config.ts --project=admin tests/e2e/article-detail.spec.ts tests/e2e/article-ima-sync.spec.ts tests/e2e/material-card-batch-sync.spec.ts tests/e2e/ima-health.spec.ts
Result: FAIL
Key output: 11 passed, 2 failed; strict text locator on AI status matched multiple nodes; sync-success loading assertion was too fast for immediate mocked response.
Follow-up: Narrow status locator with first() and add a short mocked response delay to observe loading state.
```

```text
Command: pnpm exec playwright test -c tests/e2e/playwright.config.ts --project=admin tests/e2e/article-detail.spec.ts tests/e2e/article-ima-sync.spec.ts tests/e2e/material-card-batch-sync.spec.ts tests/e2e/ima-health.spec.ts
Result: PASS
Key output: 13 passed (32.6s).
Follow-up: Commit E2E coverage slice, then run broader final validation.
```

```text
Command: pnpm exec eslint tests/e2e/article-detail.spec.ts tests/e2e/article-ima-sync.spec.ts tests/e2e/material-card-batch-sync.spec.ts tests/e2e/ima-health.spec.ts tests/e2e/helpers/test-data.ts
Result: PASS
Key output: No lint errors reported for changed E2E files.
Follow-up: Run project-level lint/test.
```

```text
Command: pnpm lint
Result: PASS with warnings
Key output: 0 errors, 27 warnings. Warnings are unused variables in existing e2e/source/test files and not blocking under the current ESLint config.
Follow-up: Run full unit/integration test suite.
```

```text
Command: pnpm test
Result: PASS
Key output: Test Files 62 passed; Tests 410 passed.
Follow-up: Run broader Playwright admin-project validation.
```

```text
Command: pnpm exec playwright test -c tests/e2e/playwright.config.ts --project=admin
Result: PASS
Key output: 119 passed, 1 skipped (2.2m).
Follow-up: Commit E2E coverage slice.
```
