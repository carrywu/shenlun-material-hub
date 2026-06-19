# Full Audit and Full Test

## Mode

Read-only audit and test. Do not modify files.

## Read First

- `AGENTS.md`
- `docs/agent/final-requirements.md`
- `docs/agent/validation-matrix.md`
- `docs/testing.md`
- `package.json`
- `prisma/schema.prisma`

## Audit Scope

Check:

1. `/api/articles` requires login.
2. USER cannot create or generate material cards.
3. Material cards are owner-private.
4. SyncRecord is owner-private.
5. IMA sync only syncs current user's own cards.
6. ADMIN cannot sync other users' cards into own IMA.
7. reject/downlist hides articles from non-admin users.
8. reject/downlist keeps private cards but hides them from non-admin users.
9. ArticleReviewState or equivalent exists.
10. Tests cover USER, VERIFIED_USER, and ADMIN.
11. Manual sources and we-mp-rss sidecar boundaries are preserved.
12. Secret fields are not printed in logs, audit records, or reports.

## Run

```bash
git status --short
git diff --stat
pnpm lint
pnpm test
pnpm build
pnpm db:generate
pnpm db:setup:dry
pnpm exec playwright test e2e/auth.spec.ts
pnpm exec playwright test e2e/middleware.spec.ts
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/article-detail.spec.ts
pnpm exec playwright test e2e/cards.spec.ts
pnpm exec playwright test e2e/review.spec.ts
pnpm exec playwright test e2e/sync-records.spec.ts
pnpm exec playwright test
```

Run `pnpm test:ai` only if `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` exist.

## Output

```markdown
# Full Audit Report

## Verdict

PASS / PARTIAL / FAIL

## P0 Issues

## P1 Issues

## Requirement Conflicts

## Database Risks

## Test Results

## Playwright Results

## Not Tested

## Recommended Fix Order

## Next Agent Prompt
```
