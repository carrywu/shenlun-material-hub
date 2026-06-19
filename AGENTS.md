# AGENTS.md

## Project

`shenlun-material-hub` is a Next.js / React / TypeScript / Prisma / PostgreSQL application for 申论素材采集、AI 评估、素材卡生成、复习和 IMA 同步。

Project-specific module details and sidecar boundaries are also documented in `CLAUDE.md`. Keep this file, `CLAUDE.md`, and `docs/agent/*` aligned when shared agent rules change.

## Required Reading

Before making any non-trivial change, read:

1. `docs/agent/final-requirements.md`
2. `docs/agent/validation-matrix.md`
3. `docs/testing.md`
4. The current task file under `tasks/shared/` or `tasks/harness/`

If available, also read:

1. `docs/audit/requirements-confirmation.md`
2. `docs/audit/development-todolist.md`
3. `docs/audit/development-handoff.md`

## Requirement Priority

If requirements conflict, follow this order:

```text
Direct user instruction for the current task
> User-confirmed current requirements
> docs/agent/final-requirements.md
> docs/audit/requirements-confirmation.md
> docs/testing.md
> code comments
> current code behavior
```

Mark unresolved mismatches as `Requirement Conflict` in reports. Do not silently choose old behavior when it conflicts with the final requirements.

## Hard Rules

- Do not edit code before producing a TodoList for medium or large tasks.
- Do not make broad rewrites.
- Do not fix unrelated issues.
- Do not skip failing tests.
- Do not change test assertions to fit broken behavior.
- Do not claim tests passed unless commands were actually run.
- Do not expose secrets in logs or reports.
- Full audit/test mode is read-only unless the user explicitly asks for fixes.
- Database-destructive operations must have dry-run or preview behavior.

## Core Requirements

1. `/api/articles` must require login.
2. `USER` cannot create or generate material cards.
3. Material card capability is only for `VERIFIED_USER` and `ADMIN`.
4. `ADMIN` using IMA can only sync their own material cards to their own IMA.
5. `reject` and `downlist` are separate states.
6. `reject` means review rejected and never entered the public learning library.
7. `downlist` means an approved article was later removed by an admin.
8. After `reject` or `downlist`, non-admin users cannot access the article.
9. Related private material cards are kept but hidden from non-admin users.
10. Related cards are excluded from normal list, search, review, and IMA sync.
11. Restoring `downlist` to `approved` restores visibility for non-archived private cards.
12. Cards with `archivedAt != null` remain archived.
13. Add or keep `ArticleReviewState` or an equivalent article review state.

## Project Constraints

1. `we-mp-rss` is a sidecar. Do not embed it into this project and do not write its database.
2. Do not implement WeChat reverse engineering or bypass login, captcha, or risk controls.
3. Manual sources and external WeRSS fallback must remain available.
4. Article content cleaning rules: `fullText` is clean text, `rawHtml` is not displayed as body text, and `summary` must not come from `head` or `doctype`.
5. Private data ownership must be enforced for MaterialCard, ArticleFavorite, UserContentState, ArticleReviewState, SyncRecord, AI config, and IMA target paths.

## Standard Validation

```bash
pnpm lint
pnpm test
pnpm build
```

## Database Validation

```bash
pnpm db:generate
pnpm db:setup:dry
```

## Critical Playwright Specs

```bash
pnpm exec playwright test e2e/auth.spec.ts
pnpm exec playwright test e2e/middleware.spec.ts
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/article-detail.spec.ts
pnpm exec playwright test e2e/cards.spec.ts
pnpm exec playwright test e2e/review.spec.ts
pnpm exec playwright test e2e/sync-records.spec.ts
```

## Critical Pages

Browser acceptance should cover:

- `/admin/integrations/wechat-rss`
- `/subscriptions`
- `/articles/[id]`
- `/cards`
- `/sources`

## Sensitive Files

Never commit or print secrets from:

```text
.env
*.db / *.sqlite / *.sqlite3
prisma/*.db
test-results/
playwright-report/
```

## Reporting

Every task must end with:

```markdown
## Summary

## Files Changed

## Tests Run

## Results

## Not Tested

## Risks

## Next Step
```
