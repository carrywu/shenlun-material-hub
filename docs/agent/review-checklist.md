# Review Checklist

## P0 Checks

- Auth bypass.
- `/api/articles` accessible without login.
- USER can create or generate material cards.
- Non-owner can read MaterialCard.
- Non-owner can read SyncRecord.
- User A can sync User B card.
- ADMIN can sync other users' cards to own IMA.
- reject/downlist article accessible by non-admin.
- reject/downlist related cards visible to non-admin.
- AI or IMA fallback to env/global config.
- Secret leakage.

## P1 Checks

- User article state still written to `ContentItem.read`, `ContentItem.bookmarked`, or `ContentItem.ignored` from user actions.
- Missing `ArticleReviewState` or equivalent.
- Missing A/B user isolation tests.
- Missing route tests.
- Missing Playwright coverage.
- Archived cards included in list, search, review, or IMA sync.
- downlist restore loses review, sync, tag, or non-archived card visibility state.
- Manual source or external WeRSS fallback removed.
- we-mp-rss sidecar boundary violated.

## Required Evidence

Every finding must include:

- file path
- function or route
- risk
- expected behavior
- suggested test

## Reporting Rule

Lead with findings ordered by severity. If there are no findings, say that clearly and list any residual test gaps.
