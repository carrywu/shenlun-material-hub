# Delete Unusable Content Items Design

Date: 2026-06-19
Status: Draft for user review

## Context

The production database contains article rows that are not useful as 申论 study material. The user wants to delete all of the following categories from production:

1. Articles with no usable正文.
2. WeChat blocked / verification-page articles.
3. Articles whose正文 is too short for the current 300-character quality gate.
4. Articles rejected by the AI relevance assessment as not suitable for 申论.

The user also confirmed that cascading deletion of related records is acceptable. This means deleting a matching `ContentItem` may also delete associated `MaterialCard`, `ArticleFavorite`, `UserContentState`, `ArticleReviewState`, `SyncRecord`, and `ArticleAnnotation` rows through existing foreign-key cascade behavior.

Because this is a production destructive data operation, the implementation must default to preview-only behavior and require an explicit backup confirmation plus a second confirmation token before any deletion.

## Goals

- Add a dedicated maintenance script for deleting unusable `ContentItem` rows.
- Make dry-run the default and safest mode.
- Show exactly what would be deleted before apply:
  - candidate counts by reason,
  - samples by reason,
  - dependent-row counts that would cascade,
  - final confirmation token.
- Require explicit `--apply`, `--backup-confirmed`, and `--confirm <token>` before production deletion.
- Execute deletion in a transaction and report post-delete remaining candidate counts.

## Non-Goals

- Do not delete `Source` rows.
- Do not modify the we-mp-rss sidecar database.
- Do not resync articles.
- Do not call AI reassessment.
- Do not run or automate `pg_dump`; the user will confirm backup completion externally.
- Do not change app UI or API behavior.

## Proposed Script

Add:

```bash
scripts/ops/delete-unusable-content-items.ts
```

Expected usage:

```bash
# Preview only; no writes
DATABASE_URL="postgresql://..." pnpm tsx scripts/ops/delete-unusable-content-items.ts --dry-run

# Apply after backup and dry-run review
DATABASE_URL="postgresql://..." pnpm tsx scripts/ops/delete-unusable-content-items.ts \
  --apply \
  --backup-confirmed \
  --confirm DELETE_UNUSABLE_<count>
```

`--dry-run` is optional because dry-run is the default. The script must refuse to delete unless all apply gates are present.

## Candidate Classification

The script should classify each candidate into one primary deletion reason. If a row matches multiple reasons, use this priority order:

1. `blocked_wechat_verification`
2. `no_content`
3. `too_short`
4. `ai_unsuitable_for_shenlun`

### 1. Blocked WeChat / verification page

Match rows that are already blocked or visibly contain WeChat verification-page content:

- `platform = 'wechat'` and `processingStatus = 'blocked'` or `qualityStatus = 'blocked'`.
- `filterReason` contains `微信封禁`, `验证页面`, or `文章内容缺失`.
- Historical verification false positives:
  - `filterReason LIKE '全文过短%（26 字）%'`
  - `fullText LIKE '%环境异常%'`
- Short text containing known verification keywords:
  - `环境异常`
  - `验证后即可继续`
  - `完成验证后即可继续访问`
  - `当前环境异常`
  - `频繁访问`
  - `请先验证`
  - `为你的访问安全`

This mirrors the logic in `src/services/collectors/wechat/weRssNormalizer.ts` and the existing historical cleanup predicate in `scripts/ops/cleanup-collector-noise.sql`.

### 2. No content

Match rows with no usable stored正文:

- `fullText IS NULL`
- `btrim(fullText) = ''`
- `fullTextStored = false`
- `effectiveTextLength = 0`
- `filterReason` contains `无全文内容` or `文章内容缺失`

Constrain status where practical to already bad rows, such as `processingStatus IN ('filtered', 'blocked')` or `qualityStatus IN ('filtered', 'blocked')`, to avoid deleting rows that are merely pending import before正文 extraction.

### 3. Too short

Match rows under the existing 300-character quality gate:

- `effectiveTextLength < 300`
- `filterReason LIKE '%全文过短%'`
- `filterReason LIKE '%内容过短%'`

Constrain status to `processingStatus = 'filtered'` and `qualityStatus = 'filtered'` where practical. Verification-page rows should be classified by the blocked rule first.

### 4. AI unsuitable for 申论

Match rows rejected by AI relevance assessment:

- `aiDecision = 'reject'`
- `filterReason LIKE 'AI 拒绝:%'`
- fallback: `qualityStatus = 'filtered' AND adminReviewStatus = 'rejected' AND aiReason IS NOT NULL`

This matches behavior in the AI assessment and reassessment routes, where rejected rows become filtered and rejected for admin review.

## Dry-Run Output

Dry-run should print:

1. Database target warning without printing secrets.
2. Total candidate count.
3. Count by deletion reason.
4. Count by `processingStatus / qualityStatus / adminReviewStatus`.
5. Count by source.
6. Top filter reasons.
7. Sample rows per deletion reason, including:
   - `id`
   - source name
   - title
   - original URL
   - statuses
   - filter reason
   - effective text length
   - AI decision / reason when present
8. Dependent-row counts that would cascade:
   - `MaterialCard`
   - `ArticleFavorite`
   - `UserContentState`
   - `ArticleReviewState`
   - `SyncRecord`
   - `ArticleAnnotation`
9. Confirmation command using a deterministic token based on candidate count, e.g. `DELETE_UNUSABLE_<count>`.

## Apply Behavior

Apply mode must:

1. Require `--apply`.
2. Require `--backup-confirmed`.
3. Require `--confirm DELETE_UNUSABLE_<currentCandidateCount>`.
4. Recompute candidates immediately before deletion.
5. Refuse to proceed if the confirm token does not match current candidate count.
6. Delete matching `ContentItem` rows inside a transaction.
7. Rely on existing foreign-key cascades for dependent rows.
8. Print deletion count and post-delete candidate count.
9. Exit non-zero on any failure.

## Safety and Rollback

- The user must complete a production `pg_dump` backup before apply.
- The script must not print credentials or `.env` content.
- If apply fails before commit, the transaction should roll back.
- If apply succeeds but the result is wrong, rollback is by restoring the production backup.
- The dry-run output is the review artifact for the final confirmation.

## Testing and Validation

Implementation should add or update tests for the classification logic if the logic is factored into testable functions. At minimum, validation should include:

```bash
pnpm lint
pnpm test
pnpm build
```

For script behavior:

```bash
pnpm tsx scripts/ops/delete-unusable-content-items.ts --dry-run
```

Production execution sequence:

1. User confirms `pg_dump` backup is complete.
2. Run dry-run against production `DATABASE_URL`.
3. User reviews candidate counts, samples, and cascade counts.
4. Run apply only with `--backup-confirmed` and the exact confirmation token from the dry-run.
5. Record final counts and any skipped/failure state in the handoff/todolist docs.

## Files Expected to Change

- `scripts/ops/delete-unusable-content-items.ts` — new maintenance script.
- Optional test file if classification is extracted into a pure helper.
- `docs/audit/development-todolist.md` — record the maintenance task status and validation.
- `docs/audit/development-handoff.md` — record production deletion state, dry-run/apply results, and next action.

No UI/API files should change for this task.