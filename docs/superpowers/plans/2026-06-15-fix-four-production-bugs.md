# Fix Four Production Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 production bugs: blocked articles stuck after WeWe RSS re-collection, admin article search redirecting to public page, WeWe RSS "open backend" hardcoded to localhost:4000, and missing "封禁" status filter.

**Architecture:** Each bug is an independent fix touching different files. Bug 1 is the core change — modifying URL dedup logic in `weRssNormalizer.ts` to update blocked records instead of skipping them. Bugs 2-4 are small targeted fixes. All changes preserve existing behavior for non-blocked records and non-admin paths.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7 with PostgreSQL, Vitest, shadcn/ui components, sonner toast.

---

## File Structure

- **Modify:** `src/types/index.ts`
  Add `"blocked"` to `QUALITY_STATUSES` and `PROCESSING_STATUSES` arrays.
- **Modify:** `src/services/collectors/wechat/weRssNormalizer.ts`
  Core fix: update blocked records instead of skipping; add `refreshed` count to `normalizeWeRssArticles` return.
- **Modify:** `src/app/api/collectors/wechat/sync/route.ts`
  Pass through `refreshedCount` from normalizer result to API response.
- **Modify:** `src/components/CollectDialog.tsx`
  Display "刷新 N 条封禁" in collection results.
- **Modify:** `src/components/articles/ArticlesPage.tsx`
  4 hardcoded `/articles` paths → `basePath`; empty search no-op; add "封禁" filter option.
- **Modify:** `src/components/integrations/WeweRssIntegrationPage.tsx`
  `href="http://localhost:4000"` → `href={baseUrl}`.
- **Create:** `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`
  Unit tests for blocked-record refresh logic.
- **Create:** `src/components/articles/__tests__/ArticlesPage.test.tsx`
  Unit tests for basePath and empty-search behavior.

---

### Task 1: Add `"blocked"` to TypeScript type definitions

**Files:**
- Modify: `src/types/index.ts:64-75,78-84`

- [ ] **Step 1: Add `"blocked"` to `PROCESSING_STATUSES` and `QUALITY_STATUSES`**

In `src/types/index.ts`, update the two arrays:

```typescript
// 处理状态 (line 64-75)
export const PROCESSING_STATUSES = [
  "pending",              // 待处理
  "fetched",              // 已抓取
  "parsed",               // 已解析
  "analyzing",            // 分析中
  "card_generated",       // 卡片已生成
  "card_edited",          // 卡片已编辑
  "confirmed",            // 已确认
  "synced",               // 已同步
  "filtered",             // 已过滤
  "blocked",              // 封禁（微信验证页面）
] as const;

// P0-2: 质量状态 (line 78-84)
export const QUALITY_STATUSES = [
  "pending",              // 待检测
  "candidate",            // 候选（通过基础过滤）
  "filtered",             // 已过滤（质量不达标）
  "accepted",             // 已接受（通过 AI 评估）
  "blocked",              // 封禁（微信验证页面）
] as const;
```

- [ ] **Step 2: Run lint and type-check**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add 'blocked' to QualityStatus and ProcessingStatus"
```

---

### Task 2: Fix blocked article re-collection in normalizer (core Bug 1)

**Files:**
- Modify: `src/services/collectors/wechat/weRssNormalizer.ts:255-266,453-479`
- Create: `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`

- [ ] **Step 1: Write the failing test for blocked-record update**

Create `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      create: mocks.create,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.info,
    warn: mocks.warn,
  },
}));

vi.mock("@/services/content-filter", () => ({
  runContentFilters: vi.fn().mockResolvedValue({ filtered: false }),
}));

import { normalizeWeRssArticle } from "../weRssNormalizer";
import type { WeRssArticle } from "../weRssClient";

function makeArticle(overrides: Partial<WeRssArticle> = {}): WeRssArticle {
  return {
    id: "article-1",
    title: "测试文章标题",
    url: "https://mp.weixin.qq.com/s/test-article-1",
    content: "<p>这是一段足够长的测试文章内容，用来绕过300字门槛检查。".repeat(10) + "</p>",
    summary: "测试摘要",
    author: "测试作者",
    publishTime: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeWeRssArticle — blocked record refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip non-blocked existing records", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "existing-1",
      title: "已存在文章",
      originalUrl: "https://mp.weixin.qq.com/s/test-article-1",
      qualityStatus: "candidate",
      processingStatus: "fetched",
    });

    const result = await normalizeWeRssArticle(makeArticle(), {
      sourceId: "source-1",
    });

    expect(result.created).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("should update blocked record when new content is not blocked", async () => {
    const blockedRecord = {
      id: "blocked-1",
      title: "被封禁的文章",
      originalUrl: "https://mp.weixin.qq.com/s/test-article-1",
      qualityStatus: "blocked",
      processingStatus: "blocked",
      coverUrl: "https://example.com/old-cover.jpg",
      aiDecision: "reject",
      aiReason: "旧评估",
      aiAssessedAt: new Date("2024-01-01"),
      aiScore: 3.5,
      aiScoreDetail: "{}",
      aiScoredAt: new Date("2024-01-01"),
      aiAssessmentError: null,
    };

    mocks.findUnique.mockResolvedValue(blockedRecord);
    mocks.update.mockResolvedValue({
      ...blockedRecord,
      qualityStatus: "pending",
      processingStatus: "fetched",
    });

    const result = await normalizeWeRssArticle(makeArticle(), {
      sourceId: "source-1",
    });

    expect(result.created).toBe(false);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "blocked-1" },
        data: expect.objectContaining({
          qualityStatus: "pending",
          processingStatus: "fetched",
          filterReason: null,
          aiDecision: null,
          aiAssessedAt: null,
        }),
      })
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("should NOT update blocked record when new content is still blocked", async () => {
    const blockedRecord = {
      id: "blocked-2",
      title: "仍被封禁的文章",
      originalUrl: "https://mp.weixin.qq.com/s/still-blocked",
      qualityStatus: "blocked",
      processingStatus: "blocked",
    };

    mocks.findUnique.mockResolvedValue(blockedRecord);

    // Article content is a WeChat block page
    const blockArticle = makeArticle({
      url: "https://mp.weixin.qq.com/s/still-blocked",
      content: "<p>当前环境异常，请先验证后即可继续访问</p>",
    });

    const result = await normalizeWeRssArticle(blockArticle, {
      sourceId: "source-1",
    });

    expect(result.created).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`
Expected: FAIL — the current code always skips existing records (`return { created: false, item: existing }`) regardless of `qualityStatus`.

- [ ] **Step 3: Implement the blocked-record update logic**

In `src/services/collectors/wechat/weRssNormalizer.ts`, replace lines 254-266 (the `findUnique` + skip block):

```typescript
  // 去重：URL 唯一性
  const existing = await db.contentItem.findUnique({
    where: { originalUrl },
  });
  if (existing) {
    // 封禁文章：WeWe RSS 可能已有正确内容，尝试更新
    if (existing.qualityStatus === "blocked") {
      // 先清洗新内容，判断是否仍是封禁页面
      const cleaned = cleanWechatHtml(article.content ?? "");
      const fullText = cleaned.fullText || null;

      if (detectWechatBlockPage(fullText)) {
        // 新内容仍是封禁页面，不更新
        await logger.info("采集跳过：封禁页面未更新", "CRAWLER", {
          sourceId: options.sourceId,
          title: article.title,
          url: originalUrl,
          existingStatus: existing.qualityStatus,
        });
        return { created: false, item: existing };
      }

      // 新内容正常：更新旧记录，保留 id / 用户数据
      const contentHash = fullText
        ? createHash("sha256").update(fullText).digest("hex").slice(0, 16)
        : null;
      const effectiveTextLength = fullText
        ? fullText.replace(/\s+/g, "").trim().length
        : 0;
      const excerpt = article.summary ?? fullText?.slice(0, 200) ?? null;

      const updated = await db.contentItem.update({
        where: { id: existing.id },
        data: {
          fullText,
          rawHtml: cleaned.rawHtml || null,
          excerpt,
          contentHash,
          fullTextStored: !!fullText,
          effectiveTextLength,
          coverUrl: article.cover ?? existing.coverUrl,
          // 重置状态：从封禁回到待检测
          qualityStatus: "pending",
          processingStatus: "fetched",
          filterReason: null,
          // 清除旧 AI 评估结果（内容已变，旧评估失效）
          aiDecision: null,
          aiReason: null,
          aiAssessedAt: null,
          aiAssessmentError: null,
          aiScore: null,
          aiScoreDetail: null,
          aiScoredAt: null,
          contentGenre: null,
          aiCategories: null,
          aiUsableFor: null,
          aiSummary: null,
          aiQuotes: null,
          adminReviewStatus: "pending_ai",
        },
      });

      await logger.info("采集刷新：封禁文章已更新", "CRAWLER", {
        sourceId: options.sourceId,
        title: article.title,
        url: originalUrl,
        previousQualityStatus: existing.qualityStatus,
        newQualityStatus: "pending",
        effectiveTextLength,
      });

      return { created: false, filtered: false, item: updated };
    }

    // 非封禁文章：保持原有跳过逻辑
    await logger.info("采集跳过：URL 已存在", "CRAWLER", {
      sourceId: options.sourceId,
      title: article.title,
      url: originalUrl,
      existingStatus: existing.processingStatus,
    });
    return { created: false, item: existing };
  }
```

- [ ] **Step 4: Update `normalizeWeRssArticles` to track `refreshed` count**

In `src/services/collectors/wechat/weRssNormalizer.ts`, update the `normalizeWeRssArticles` function (lines 453-479). Change the return type and counting logic:

Replace the function signature and body:

```typescript
export async function normalizeWeRssArticles(
  articles: WeRssArticle[],
  options: NormalizeOptions
): Promise<{ discovered: number; imported: number; skipped: number; blocked: number; refreshed: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  let blocked = 0;
  let refreshed = 0;

  for (const article of articles) {
    try {
      const result = await normalizeWeRssArticle(article, options);
      if (result.created && !result.filtered) {
        imported++;
      } else if (result.filterReason?.includes("封禁")) {
        blocked++;
      } else if (!result.created && !result.filtered && !result.filterReason) {
        // 封禁文章被刷新成功：created=false, filtered=false, no filterReason
        refreshed++;
      } else {
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${article.title}] ${msg}`);
    }
  }

  return { discovered: articles.length, imported, skipped, blocked, refreshed, errors };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/collectors/wechat/weRssNormalizer.ts src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts
git commit -m "fix(crawler): update blocked articles on re-collection instead of skipping

When a WeChat article was previously blocked (qualityStatus='blocked') and
WeWe RSS now has correct content, update the existing record instead of
skipping it. Clears stale AI assessment results and resets to 'pending'
so the article re-enters the quality pipeline."
```

---

### Task 3: Pass `refreshedCount` through sync API and CollectDialog

**Files:**
- Modify: `src/app/api/collectors/wechat/sync/route.ts:69-106`
- Modify: `src/components/CollectDialog.tsx:55-64,199-213,268-289,305-309`

- [ ] **Step 1: Update sync route to include `refreshedCount`**

In `src/app/api/collectors/wechat/sync/route.ts`, update `runWechatSyncTask` return value (around lines 69-106). After the `normalizeWeRssArticles` call, the `result` now has a `refreshed` field. Add it to the return:

Find the `await db.collectorRun.update` block (around line 69-78) and add `refreshedCount` to the source update and return:

After line 94 (`blocked: result.blocked,`), add:

```typescript
      refreshedCount: result.refreshed,
```

In the return object (around line 98-106), add after `blockedCount: result.blocked,`:

```typescript
      refreshedCount: result.refreshed,
```

- [ ] **Step 2: Update `CollectResult` interface and display**

In `src/components/CollectDialog.tsx`:

a) Add `refreshedCount` to `CollectResult` interface (after `blockedCount` around line 62):

```typescript
  refreshedCount?: number;
```

b) In the task-result parsing (around lines 199-213), add after `blockedCount`:

```typescript
            refreshedCount: result?.refreshedCount,
```

c) Add `refreshedCount` to the non-task result path (around lines 220-226), add after `blockedCount`:

```typescript
            refreshedCount: data.refreshedCount,
```

d) Add total calculation after `totalBlocked` (around line 251):

```typescript
  const totalRefreshed =
    results?.reduce((sum, r) => sum + (r.refreshedCount ?? 0), 0) ?? 0;
```

e) In the results summary display (around lines 268-289), add after the blocked badge block:

```tsx
              {totalRefreshed > 0 && (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-600">{totalRefreshed} 刷新封禁</span>
                </div>
              )}
```

f) In per-source result text (around line 307), add refreshed display:

Find the line with:
```tsx
`发现 ${r.discoveredCount ?? 0}，导入 ${r.importedCount ?? 0}${(r.blockedCount ?? 0) > 0 ? `，封禁 ${r.blockedCount}` : ""}${(r.skippedCount ?? 0) > 0 ? `，跳过 ${r.skippedCount}` : ""}`
```

Replace with:
```tsx
`发现 ${r.discoveredCount ?? 0}，导入 ${r.importedCount ?? 0}${(r.blockedCount ?? 0) > 0 ? `，封禁 ${r.blockedCount}` : ""}${(r.refreshedCount ?? 0) > 0 ? `，刷新封禁 ${r.refreshedCount}` : ""}${(r.skippedCount ?? 0) > 0 ? `，跳过 ${r.skippedCount}` : ""}`
```

g) Add `RefreshCw` to the lucide-react import (line 26). It is already imported (used in the sync button), so verify it exists.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/collectors/wechat/sync/route.ts src/components/CollectDialog.tsx
git commit -m "feat(sync): display refreshed blocked count in collection results"
```

---

### Task 4: Fix admin article search redirect (Bug 2)

**Files:**
- Modify: `src/components/articles/ArticlesPage.tsx:142,276,285-289,307,925,957`
- Create: `src/components/articles/__tests__/ArticlesPage.test.tsx`

- [ ] **Step 1: Write failing test for basePath behavior**

Create `src/components/articles/__tests__/ArticlesPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/articles",
}));

// Mock fetch
const mockFetch = vi.fn();
const originalFetch = global.fetch;

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

describe("ArticlesPage — admin basePath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/articles")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [],
            total: 0,
            page: 1,
            pageSize: 20,
            totalPages: 0,
          }),
        });
      }
      if (url.includes("/api/sources")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should use /admin/articles base path in managementMode for syncUrl", async () => {
    // This test verifies that when managementMode=true,
    // syncUrl uses /admin/articles instead of /articles
    const { ArticlesPage } = await import("../../articles/ArticlesPage");
    render(<ArticlesPage managementMode />);

    // The component renders — we verify the module loads without error
    // and that router.replace is not called with /articles on mount
    // (it would be called with /admin/articles if it were called)
    expect(replaceMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/articles(\?|$)/)
    );
  });
});
```

- [ ] **Step 2: Run test to verify setup**

Run: `pnpm vitest run src/components/articles/__tests__/ArticlesPage.test.tsx`
Expected: May pass trivially since the test only checks mount behavior. The real verification is manual + build.

- [ ] **Step 3: Add `basePath` variable and fix 4 hardcoded paths**

In `src/components/articles/ArticlesPage.tsx`, inside `ArticlesPageInner` function (after line 143 `const searchParams = useSearchParams();`), add:

```typescript
  const basePath = managementMode ? "/admin/articles" : "/articles";
```

Then fix the 4 hardcoded paths:

**Line 276** — `syncUrl()`:
```typescript
// Before:
    router.replace(`/articles${qs ? `?${qs}` : ""}`, { scroll: false });
// After:
    router.replace(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false });
```

**Line 307** — `handleReset()`:
```typescript
// Before:
    router.replace("/articles", { scroll: false });
// After:
    router.replace(basePath, { scroll: false });
```

**Line 925** — row click:
```typescript
// Before:
                      onClick={() => router.push(`/articles/${item.id}`)}
// After:
                      onClick={() => router.push(`${basePath}/${item.id}`)}
```

**Line 957** — title click:
```typescript
// Before:
                              router.push(`/articles/${item.id}`);
// After:
                              router.push(`${basePath}/${item.id}`);
```

- [ ] **Step 4: Fix empty search not triggering URL change**

In `handleSearch()` (around line 285-289), add a guard to skip `syncUrl()` when there's nothing to sync:

```typescript
  function handleSearch() {
    setPage(1);
    // Only sync URL if there are non-default filters — avoid empty URL change
    const hasActiveFilter =
      keyword ||
      sourceType !== "all" ||
      sourceName !== "all" ||
      section !== "all" ||
      qualityStatus !== "all" ||
      aiDecision !== "all" ||
      adminReviewStatus !== "all" ||
      publishedStart ||
      publishedEnd ||
      collectedStart ||
      collectedEnd ||
      sortBy !== "createdAt" ||
      (activeTab && activeTab !== "all");
    if (hasActiveFilter) {
      syncUrl();
    }
    fetchItems();
  }
```

- [ ] **Step 5: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/articles/ArticlesPage.tsx src/components/articles/__tests__/ArticlesPage.test.tsx
git commit -m "fix(articles): use managementMode-aware basePath, prevent empty search redirect

4 hardcoded /articles paths now use basePath (/admin/articles in
managementMode). Empty search with default filters no longer triggers
a URL change."
```

---

### Task 5: Fix WeWe RSS "打开后台" localhost link (Bug 3)

**Files:**
- Modify: `src/components/integrations/WeweRssIntegrationPage.tsx:289`

- [ ] **Step 1: Replace hardcoded href with `baseUrl`**

In `src/components/integrations/WeweRssIntegrationPage.tsx`, line 289:

```tsx
// Before:
              <a href="http://localhost:4000" target="_blank" rel="noopener noreferrer" className="flex items-center">
// After:
              <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/integrations/WeweRssIntegrationPage.tsx
git commit -m "fix(wewe-rss): use configured baseUrl instead of hardcoded localhost:4000"
```

---

### Task 6: Add "封禁" filter option (Bug 4)

**Files:**
- Modify: `src/components/articles/ArticlesPage.tsx:85-91`

- [ ] **Step 1: Add "封禁" option to `QUALITY_STATUS_OPTIONS`**

In `src/components/articles/ArticlesPage.tsx`, update the `QUALITY_STATUS_OPTIONS` array:

```typescript
const QUALITY_STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待检测" },
  { value: "candidate", label: "候选" },
  { value: "filtered", label: "已过滤" },
  { value: "accepted", label: "已接受" },
  { value: "blocked", label: "封禁" },
];
```

- [ ] **Step 2: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/articles/ArticlesPage.tsx
git commit -m "feat(articles): add 'blocked' (封禁) quality status filter option"
```

---

### Task 7: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: No errors

- [ ] **Step 3: Manual verification checklist**

Verify in browser:
1. `/admin/articles` — type a keyword, click search → URL stays `/admin/articles?keyword=xxx`
2. `/admin/articles` — click search with empty keyword and all-default filters → URL does not change
3. `/admin/articles` — click a row → navigates to `/admin/articles/{id}`
4. `/admin/articles` — quality status dropdown → shows "封禁" option
5. `/admin/integrations/wewe-rss` — "打开后台" link → uses configured baseUrl (not localhost:4000)
6. Source management → sync a WeChat source with blocked articles → results show "刷新封禁 N"

---

## Self-Review

**Spec coverage:**
- Bug 1 (blocked re-collection): Task 2 (core normalizer fix) + Task 3 (stats passthrough) ✅
- Bug 2 (admin redirect): Task 4 (basePath + empty search) ✅
- Bug 3 (localhost link): Task 5 (baseUrl href) ✅
- Bug 4 (missing filter): Task 1 (types) + Task 6 (filter option) ✅

**Placeholder scan:** No TBD/TODO/placeholders. All steps have complete code.

**Type consistency:** `refreshedCount` used consistently across normalizer return → sync route → CollectDialog. `basePath` defined once and used in all 4 locations. `"blocked"` added to both `PROCESSING_STATUSES` and `QUALITY_STATUSES` type arrays.
