# Batch 20: User Article State

## Goal

Move article read/favorite/ignore/review state to user-owned data.

## Requirements

- Do not write `ContentItem.read`, `ContentItem.bookmarked`, or `ContentItem.ignored` from user actions.
- Use `ArticleFavorite` for favorite state.
- Use `UserContentState` for read and ignored state.
- Add or keep `ArticleReviewState` or equivalent for favorited article review state.
- A user's state never appears for another user.
- Non-owner access to private state returns 404 or an empty own-state result, depending on route semantics.

## Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/review.spec.ts
```
