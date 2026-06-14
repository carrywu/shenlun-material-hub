# Article Detail, AI Evaluation, and IMA Sync Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix article detail localization, AI evaluation provenance, article content rendering, material-card IMA sync, article-detail IMA sync, and IMA health checks with full regression coverage.

**Architecture:** Use shared display-label helpers for all user-visible status text, persist AI provenance metadata on `ContentItem`, render article body through a single safe renderer, and route all IMA operations through one service. UI actions call permission-checked API routes, which return structured success, failure, and skipped results.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL, DOMPurify, Vitest, Playwright, sonner toast.

---

## File Structure

- Modify `src/lib/display-labels.ts`: shared Chinese labels for AI decisions, review/status values, sync statuses, and source labels.
- Modify `src/lib/__tests__/display-labels.test.ts`: unit tests for label mappings.
- Modify `prisma/schema.prisma`: AI provenance fields and SyncRecord support for article-only sync.
- Create Prisma migration under `prisma/migrations/<timestamp>_article_ima_ai_metadata/migration.sql`.
- Modify `src/services/ai.ts`: write AI model, prompt version, source, content hash, and latest error metadata.
- Modify `src/app/api/content-items/assess/route.ts`: write AI provenance metadata.
- Modify `src/app/api/content-items/reassess/route.ts`: restrict to admin and preserve old evaluation on failure.
- Create `src/components/articles/ArticleContentRenderer.tsx`: safe HTML/plain-text article renderer.
- Create `src/components/articles/__tests__/ArticleContentRenderer.test.tsx`: renderer regression tests.
- Modify `src/app/articles/[id]/page.tsx`: use shared labels, AI provenance panel, renderer, and article-detail IMA sync UI.
- Modify `src/services/ima-sync.ts`: refactor to `ImaService`-style operations for card sync, batch sync, article sync, duplicate skip, and health check.
- Modify `src/app/api/sync/route.ts`: keep compatibility while delegating to unified service.
- Create `src/app/api/articles/[id]/sync-to-ima/route.ts`: article detail sync endpoint.
- Create `src/app/api/ima/health/route.ts`: IMA health endpoint.
- Modify `src/components/SyncToIma.tsx`: Chinese text, skipped state, no silent failures, no repeated submit.
- Modify `src/app/cards/page.tsx`: batch sync feedback when nothing is selected.
- Modify `src/app/settings/ima/page.tsx`: display health status and “检查连接”.
- Add or modify service/API tests near the changed routes and service files.
- Add Playwright specs under `e2e/`: article detail, article IMA sync, material-card batch sync, IMA health.

## Task 1: Shared Chinese Display Labels

**Files:**
- Modify: `src/lib/display-labels.ts`
- Modify: `src/lib/__tests__/display-labels.test.ts`

- [ ] Add failing tests for AI decision labels:

```ts
expect(getAiDecisionLabel("accept")).toBe("已通过");
expect(getAiDecisionLabel("reject")).toBe("已拒绝");
expect(getAiDecisionLabel("pending")).toBe("待评估");
expect(getAiDecisionLabel(null)).toBe("尚未评估");
expect(getAiDecisionLabel("unexpected")).toBe("未知");
```

- [ ] Add failing tests for sync status labels:

```ts
expect(getSyncStatusLabel("success")).toBe("成功");
expect(getSyncStatusLabel("failed")).toBe("失败");
expect(getSyncStatusLabel("skipped")).toBe("已跳过");
expect(getSyncStatusLabel("pending")).toBe("待同步");
```

- [ ] Implement exported mappings and helper functions:

```ts
export const AI_DECISION_LABELS = {
  accept: "已通过",
  accepted: "已通过",
  reject: "已拒绝",
  rejected: "已拒绝",
  pending: "待评估",
  unknown: "未知",
  unevaluated: "尚未评估",
} as const;

export function getAiDecisionLabel(value: string | null | undefined): string {
  if (!value) return AI_DECISION_LABELS.unevaluated;
  return AI_DECISION_LABELS[value as keyof typeof AI_DECISION_LABELS] ?? AI_DECISION_LABELS.unknown;
}
```

- [ ] Run:

```bash
pnpm test src/lib/__tests__/display-labels.test.ts
```

- [ ] Commit:

```bash
git add src/lib/display-labels.ts src/lib/__tests__/display-labels.test.ts
git commit -m "Localize article and sync status labels"
```

## Task 2: AI Evaluation Provenance

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_article_ai_provenance/migration.sql`
- Modify: `src/services/ai.ts`
- Modify: `src/app/api/content-items/assess/route.ts`
- Modify: `src/app/api/content-items/reassess/route.ts`
- Add/modify route/service tests.

- [ ] Add schema fields to `ContentItem`:

```prisma
aiAssessmentSource  String?   // ai-runtime / database / seed / mock / unknown
aiAssessmentModel   String?
aiPromptVersion     String?
aiContentHash       String?
aiLastError         String?
aiLastFailedAt      DateTime?
```

- [ ] Create a non-destructive migration that only adds nullable columns and indexes where useful.
- [ ] Add failing tests that:
  - Real assessment writes `aiAssessmentSource = "ai-runtime"`.
  - Reassess requires admin.
  - Failed reassess preserves existing AI fields and writes `aiLastError`.
  - Historical records with null source display as “历史数据库记录 / 来源未知”.
- [ ] Update assessment writes to store source/model/prompt version/content hash.
- [ ] Update reassess route to require admin.
- [ ] Preserve old evaluation on reassess failure.
- [ ] Run targeted tests:

```bash
pnpm test src/app/api/content-items/assess/__tests__/route.test.ts src/app/api/content-items/reassess
```

- [ ] Commit:

```bash
git add prisma src/services/ai.ts src/app/api/content-items/assess src/app/api/content-items/reassess
git commit -m "Clarify article AI evaluation provenance"
```

## Task 3: Safe Article Content Renderer

**Files:**
- Create: `src/components/articles/ArticleContentRenderer.tsx`
- Create: `src/components/articles/__tests__/ArticleContentRenderer.test.tsx`
- Modify: `src/app/articles/[id]/page.tsx`

- [ ] Write failing renderer tests:
  - Plain text with blank lines renders more than one paragraph.
  - HTML preserves `p`, `ul`, `li`, `table`, and `img`.
  - `script` and event attributes are removed.
  - Relative image URLs are resolved against `originalUrl`.
- [ ] Implement renderer props:

```ts
interface ArticleContentRendererProps {
  rawHtml?: string | null;
  fullText?: string | null;
  originalUrl: string;
  platform?: string | null;
  showDiagnostics?: boolean;
  onTextSelection?: () => void;
  onImagePreview?: (src: string) => void;
}
```

- [ ] Use DOMPurify for HTML and paragraph fallback for text.
- [ ] Replace inline rendering in article detail page with `ArticleContentRenderer`.
- [ ] Run:

```bash
pnpm test src/components/articles/__tests__/ArticleContentRenderer.test.tsx
```

- [ ] Commit:

```bash
git add src/components/articles src/app/articles/[id]/page.tsx
git commit -m "Preserve article content formatting safely"
```

## Task 4: Unified IMA Service and APIs

**Files:**
- Modify: `prisma/schema.prisma`
- Create migration for nullable `SyncRecord.materialCardId` and sync metadata.
- Modify: `src/services/ima-sync.ts`
- Modify: `src/app/api/sync/route.ts`
- Create: `src/app/api/articles/[id]/sync-to-ima/route.ts`
- Create: `src/app/api/ima/health/route.ts`
- Add service/API tests.

- [ ] Add failing tests for:
  - Config missing returns structured error.
  - Normal material-card sync returns success.
  - Repeated sync for same user/card returns skipped and does not call IMA.
  - Repeated sync for different user/public card is allowed.
  - Article sync rejects non-approved articles.
  - Batch sync returns success/failed/skipped counts.
  - Health check reports configured, reachable, authValid.
- [ ] Make `materialCardId` nullable for article sync records.
- [ ] Add sync metadata fields such as operation/source/status detail if needed.
- [ ] Implement service functions:

```ts
syncMaterialCard(cardId: string, userId: string)
batchSyncMaterialCards(cardIds: string[], userId: string)
syncArticle(articleId: string, userId: string)
healthCheck(userId: string)
```

- [ ] Enforce permissions and ownership:
  - Non-admin users only own cards.
  - Admins can sync own cards and system public cards, not other users’ private cards.
  - Article sync only approved articles.
- [ ] Add structured logs with requestId, operation, userId, articleId/cardId, status, duration, and error details.
- [ ] Run targeted tests:

```bash
pnpm test src/services src/app/api/sync src/app/api/articles src/app/api/ima
```

- [ ] Commit:

```bash
git add prisma src/services/ima-sync.ts src/app/api/sync src/app/api/articles src/app/api/ima
git commit -m "Unify IMA sync service and health check"
```

## Task 5: Material Card Batch Sync UI

**Files:**
- Modify: `src/app/cards/page.tsx`
- Modify: `src/components/SyncToIma.tsx`
- Add/update component tests if present.

- [ ] Add failing UI tests or E2E for:
  - Clicking batch sync without selection shows “请先选择要同步的素材卡”.
  - During sync, button shows loading and is disabled.
  - Partial result shows success, failed, and skipped counts.
- [ ] Keep batch sync action visible enough to produce feedback when no rows are selected.
- [ ] Update result card to display:
  - `成功 X 条`
  - `失败 Y 条`
  - `跳过 Z 条`
  - Failure and skipped reasons.
- [ ] Prevent repeated click submission.
- [ ] Run targeted tests.
- [ ] Commit:

```bash
git add src/app/cards/page.tsx src/components/SyncToIma.tsx
git commit -m "Implement material card batch IMA sync feedback"
```

## Task 6: Article Detail Sync to IMA UI

**Files:**
- Modify: `src/app/articles/[id]/page.tsx`
- Reuse: `src/app/api/articles/[id]/sync-to-ima/route.ts`

- [ ] Add E2E coverage for:
  - Button exists next to “查看原文”.
  - Existing material cards require user selection.
  - Unconfirmed cards are disabled.
  - No selection shows “请先选择要同步的素材卡”.
  - No material cards path asks for article-body sync confirmation.
  - Success, failed, skipped states are visible.
- [ ] Implement button and selector modal/section.
- [ ] Use current user’s IMA config only.
- [ ] Show config missing and IMA failure as Chinese toast/inline feedback.
- [ ] Commit:

```bash
git add src/app/articles/[id]/page.tsx e2e
git commit -m "Add article detail IMA sync action"
```

## Task 7: IMA Health Status on Settings Page

**Files:**
- Modify: `src/app/settings/ima/page.tsx`
- Reuse: `src/app/api/ima/health/route.ts`
- Add E2E: `e2e/ima-health.spec.ts`

- [ ] Add E2E for:
  - Page shows “IMA 状态”.
  - “检查连接” success shows normal/available state.
  - Auth failure shows “鉴权失败” or equivalent.
  - Missing config shows “IMA 未配置”.
- [ ] Add health status card.
- [ ] Add “检查连接” button with loading state.
- [ ] Show structured health result in Chinese.
- [ ] Commit:

```bash
git add src/app/settings/ima/page.tsx src/app/api/ima e2e/ima-health.spec.ts
git commit -m "Add IMA health check status"
```

## Task 8: Playwright E2E Consolidation

**Files:**
- Add/update under `e2e/`
- Reuse helpers under `e2e/helpers`

- [ ] Ensure new specs live in root Playwright `e2e/` directory:
  - `e2e/article-detail.spec.ts`
  - `e2e/article-ima-sync.spec.ts`
  - `e2e/material-card-batch-sync.spec.ts`
  - `e2e/ima-health.spec.ts`
- [ ] Add reusable helpers for:
  - Login.
  - Seed article without AI evaluation.
  - Seed article with formatted content.
  - Seed article with unsafe HTML.
  - Mock IMA success/failure/health responses.
- [ ] Ensure failure artifacts remain enabled:
  - trace retain on failure.
  - screenshot only on failure.
  - video retain on failure.
- [ ] Run:

```bash
pnpm exec playwright test --project=admin
```

- [ ] Commit:

```bash
git add e2e playwright.config.ts
git commit -m "Cover IMA and article detail flows with Playwright"
```

## Task 9: Final Validation and Handoff

**Files:**
- Update or create handoff/changelog under `docs/handoff/` or task docs if required.

- [ ] Run:

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

- [ ] Record failures with:
  - Failed command.
  - Error summary.
  - Whether failure is task-related or environment-related.
  - Trace/screenshot/video/report paths for Playwright.
- [ ] Prepare final report with:
  - Changed files.
  - AI evaluation source conclusion.
  - IMA call chain conclusion.
  - Test results.
  - Commit hashes.
  - Remaining risks.

## Rollback Plan

- UI-only changes can be reverted by reverting the corresponding commits.
- Schema changes are additive except making `SyncRecord.materialCardId` nullable; rollback requires confirming no article-only sync records exist or migrating them first.
- IMA service refactor should preserve `/api/sync` compatibility; if needed, revert API/service commit while keeping UI disabled.

## Known Risks

- External IMA API update semantics may differ from assumptions; this plan avoids automatic update/overwrite and defaults to skipped duplicates.
- Existing E2E fixtures may not contain all required states; helpers should seed deterministic test data.
- Prisma generated files may need regeneration after schema changes; do not manually edit generated client files.
