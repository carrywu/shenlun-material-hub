# Validation Matrix

## Standard

```bash
pnpm lint
pnpm test
pnpm build
```

## Database

```bash
pnpm db:generate
pnpm db:setup:dry
```

## API / Auth / RBAC / Owner Isolation

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/auth.spec.ts
pnpm exec playwright test e2e/middleware.spec.ts
```

## Articles

```bash
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/article-detail.spec.ts
```

## Material Cards

```bash
pnpm exec playwright test e2e/cards.spec.ts
```

## Review

```bash
pnpm exec playwright test e2e/review.spec.ts
```

## IMA Sync

```bash
pnpm exec playwright test e2e/sync-records.spec.ts
```

## Full E2E

```bash
pnpm exec playwright test
```

## AI / Promptfoo

Only run when `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` exist:

```bash
pnpm test:ai
```

## Rules

- Do not claim pass unless commands were run.
- If not run, report `Not tested` with reason.
- Do not skip failing tests.
- Do not update snapshots unless explicitly requested.
- For document-only shared agent structure changes, `git status --short` and `git diff --stat` are sufficient unless the task also changes validation behavior or executable scripts.
