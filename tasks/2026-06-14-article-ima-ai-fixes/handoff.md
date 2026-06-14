# Handoff

## Current State

Task 4 unified IMA service backend/API slice is implemented and targeted tests pass. The current unblocked next slice is Task 5 material card batch sync UI.

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

## IMA Call Chain Conclusion

- Configuration source: `ImaTarget` rows scoped to the current logged-in user; no environment fallback is used for user sync.
- Service: `ImaService.syncMaterialCard`, `ImaService.batchSyncMaterialCards`, and `ImaService.healthCheck`.
- Single material-card sync: `/api/sync` validates ownership/confirmation, then calls `ImaService.syncMaterialCard`.
- Batch material-card sync: `/api/sync` validates all selected cards, then calls `ImaService.batchSyncMaterialCards`.
- Health check: `/api/ima/health` requires admin and calls `ImaService.healthCheck`.
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

## Next Action

Commit Task 4 backend service/API slice, then start Task 5 batch sync UI.
