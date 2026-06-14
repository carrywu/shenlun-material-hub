# Handoff

## Current State

Task 7 IMA health UI is implemented and targeted lint passes. The current unblocked next slice is Playwright E2E coverage and final validation.

## Completed

- Requirements and implementation plan were created under `docs/superpowers/`.
- Carry workflow artifacts were created under `tasks/2026-06-14-article-ima-ai-fixes/`.
- Added shared AI decision and sync status label helpers.
- Updated article detail AI status, SyncToIma text, and sync records status display to use Chinese/shared labels.
- Added nullable AI provenance fields to `ContentItem` and a migration.
- Updated batch AI assessment and single reassessment to write `aiAssessmentSource`, model, prompt version, content hash, and latest failure metadata.
- Restricted single article reassessment to admin.
- Updated article detail AI panel to show unassessed, stale, and latest failure states.
- Added AI provenance debug info for admin/development; content hashes are only shown to admins.
- Added `ArticleContentRenderer` to centralize article body rendering.
- The renderer sanitizes HTML, preserves paragraphs/lists/tables/images, converts relative URLs with `sourceUrl`, proxies WeChat images, and falls back to paragraphized plain text.
- Article detail now uses the renderer instead of inline HTML sanitization; existing annotation highlights are preserved for annotated plain-text articles.
- Added `ImaService` in `src/services/ima-sync.ts` with structured single-card sync, batch sync, duplicate-success skip, health check, and operation logging.
- Updated `/api/sync` to call `ImaService` and return batch `items` with success/failed/skipped status details.
- Added admin-only `/api/ima/health` for IMA health checks.
- Updated material card batch sync UI to keep a visible batch sync action in the page header.
- Empty selection now shows `请先选择要同步的素材卡` instead of silently doing nothing.
- Batch sync UI now consumes the new `items` result shape and displays success, failed, skipped, and failure reasons.
- Added `/api/articles/[id]/sync-to-ima` for article detail sync.
- Added `ImaService.syncArticle`, which syncs confirmed material cards first and falls back to approved article body content when no confirmed card exists.
- Made `SyncRecord.materialCardId` nullable so article-only sync records can be stored.
- Added the article detail `同步到 IMA` button beside `查看原文` with loading and toast feedback.
- Added IMA settings health status card with `未配置 / 已配置但不可达 / 鉴权失败 / 正常 / 待检查` states and a `检查连接` action.

## IMA Call Chain Conclusion

- Configuration source: `ImaTarget` rows scoped to the current logged-in user; no environment fallback is used for user sync.
- Service: `ImaService.syncMaterialCard`, `ImaService.batchSyncMaterialCards`, and `ImaService.healthCheck`.
- Single material-card sync: `/api/sync` validates ownership/confirmation, then calls `ImaService.syncMaterialCard`.
- Batch material-card sync: `/api/sync` validates all selected cards, then calls `ImaService.batchSyncMaterialCards`.
- Health check: `/api/ima/health` requires admin and calls `ImaService.healthCheck`.
- Article detail sync: `/api/articles/[id]/sync-to-ima` validates article access and calls `ImaService.syncArticle`.
- Duplicate behavior: an existing successful sync record for the same user/card/document role is returned as `skipped` and does not create another IMA document.
- Error handling: service returns `errorCode` and `errorMessage`; failed remote calls update `SyncRecord` when a pending record exists.

## AI Evaluation Source Conclusion

- New successful AI assessments are marked as `aiAssessmentSource = "ai-runtime"` and stored in the database with model, prompt version, evaluated content hash, and assessment time.
- Existing historical rows without provenance are displayed as `历史数据库记录 / 来源未知`, not as real runtime assessments.
- Reassessment failures now preserve the old successful AI result while recording `aiLastError` and `aiLastFailedAt`.
- Seed/mock rows can be distinguished by setting `aiAssessmentSource` to `seed` or `mock`; this slice does not retroactively guess historical row origins.

## Changed Files

- `docs/superpowers/specs/2026-06-14-article-ima-ai-requirements.md`
- `docs/superpowers/plans/2026-06-14-article-ima-ai-fixes.md`
- `tasks/2026-06-14-article-ima-ai-fixes/prd.md`
- `tasks/2026-06-14-article-ima-ai-fixes/plan.md`
- `tasks/2026-06-14-article-ima-ai-fixes/todolist.md`
- `tasks/2026-06-14-article-ima-ai-fixes/validation.md`
- `tasks/2026-06-14-article-ima-ai-fixes/handoff.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260614185100_article_ai_provenance/migration.sql`
- `src/app/api/content-items/[id]/__tests__/route.test.ts`
- `src/app/api/content-items/assess/route.ts`
- `src/app/api/content-items/reassess/route.ts`
- `src/app/api/content-items/reassess/__tests__/route.test.ts`
- `src/app/articles/[id]/page.tsx`
- `src/lib/__tests__/display-labels.test.ts`
- `src/lib/display-labels.ts`
- `src/components/articles/ArticleContentRenderer.tsx`
- `src/components/articles/__tests__/ArticleContentRenderer.test.tsx`
- `src/services/ima-sync.ts`
- `src/services/__tests__/ima-sync.test.ts`
- `src/app/api/sync/route.ts`
- `src/app/api/sync/__tests__/route.test.ts`
- `src/app/api/ima/health/route.ts`
- `src/app/api/ima/health/__tests__/route.test.ts`
- `src/components/SyncToIma.tsx`
- `src/components/__tests__/SyncToIma.test.tsx`
- `src/app/cards/page.tsx`
- `prisma/migrations/20260614192000_sync_record_article_fallback/migration.sql`
- `src/app/api/articles/[id]/sync-to-ima/route.ts`
- `src/app/api/articles/[id]/sync-to-ima/__tests__/route.test.ts`
- `src/app/settings/ima/page.tsx`

## Verification

- `pnpm test src/lib/__tests__/display-labels.test.ts` passed with 16 tests.
- Targeted `rg` scan found no remaining lowercase `同步到 ima` or direct decision-label construction in touched files.
- `pnpm test 'src/app/api/content-items/[id]/__tests__/route.test.ts'` passed with 7 tests.
- `pnpm test src/app/api/content-items/reassess/__tests__/route.test.ts` passed with 2 tests.
- `pnpm test src/app/api/content-items/assess/__tests__/route.test.ts` passed with 3 tests.
- `pnpm db:generate` passed and regenerated Prisma Client.
- `pnpm exec tsc --noEmit` is blocked by an existing unrelated TS2774 error in `tests/e2e/permissions.spec.ts:78`.
- `pnpm test src/components/articles/__tests__/ArticleContentRenderer.test.tsx` passed with 4 tests.
- `pnpm exec eslint src/components/articles/ArticleContentRenderer.tsx src/components/articles/__tests__/ArticleContentRenderer.test.tsx 'src/app/articles/[id]/page.tsx'` passed.
- `pnpm test src/services/__tests__/ima-sync.test.ts` passed with 5 tests.
- `pnpm test src/app/api/sync/__tests__/route.test.ts` passed with 2 tests.
- `pnpm test src/app/api/ima/health/__tests__/route.test.ts` passed with 2 tests.
- `pnpm exec eslint src/services/ima-sync.ts src/services/__tests__/ima-sync.test.ts src/app/api/sync/route.ts src/app/api/sync/__tests__/route.test.ts src/app/api/ima/health/route.ts src/app/api/ima/health/__tests__/route.test.ts` passed.
- `pnpm test src/components/__tests__/SyncToIma.test.tsx` passed with 2 tests.
- `pnpm exec eslint src/components/SyncToIma.tsx src/components/__tests__/SyncToIma.test.tsx src/app/cards/page.tsx` passed.
- `pnpm test 'src/app/api/articles/[id]/sync-to-ima/__tests__/route.test.ts'` passed with 3 tests.
- `pnpm exec eslint src/services/ima-sync.ts 'src/app/api/articles/[id]/sync-to-ima/route.ts' 'src/app/api/articles/[id]/sync-to-ima/__tests__/route.test.ts' 'src/app/articles/[id]/page.tsx'` passed.
- `pnpm exec eslint src/app/settings/ima/page.tsx` passed.

## Next Action

Commit Task 7 health UI slice, then add Playwright E2E coverage and run final validation.
