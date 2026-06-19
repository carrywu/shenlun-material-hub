# Batch 30: Review Loop and reject/downlist Visibility

## Goal

Complete review loop and enforce reject/downlist visibility.

## Requirements

- USER reviews own favorited articles.
- VERIFIED_USER reviews own favorited articles and own material cards.
- reject/downlist articles are inaccessible to non-admin users.
- Related cards are retained but hidden from non-admin users.
- Related cards are excluded from list, search, review, and IMA sync.
- downlist restore to approved restores non-archived cards.
- Archived cards remain archived after restore.
- Review state, sync records, and tags are preserved across downlist and restore.

## Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/article-detail.spec.ts
pnpm exec playwright test e2e/cards.spec.ts
pnpm exec playwright test e2e/review.spec.ts
```
