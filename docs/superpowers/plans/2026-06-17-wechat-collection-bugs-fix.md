# 微信文章采集 Bug 修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复微信文章采集的 4 个 Bug：导航过滤器误杀、URL 重复阻止可刷新文章导入、API 缺少 refreshedCount、UI 缺少完整计数展示

**Architecture:** 分层修复——内容过滤器层增加字数门槛防误杀；normalizer 层扩展刷新路径覆盖"疑似导航页面"；预览层区分"硬重复"vs"可刷新"；数据层/ API 层补全计数；UI 层展示完整结果

**Tech Stack:** Next.js 16 + Prisma 7 + PostgreSQL + React 19 + Tailwind CSS + Vitest

**Design Doc:** `docs/superpowers/specs/2026-06-17-wechat-collection-bugs-fix-design.md`

---

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/services/content-filter.ts` | 导航过滤器增加 1500 字门槛 |
| 创建 | `src/services/__tests__/content-filter.test.ts` | 导航过滤器单元测试（文件不存在） |
| 修改 | `src/services/collectors/wechat/weRssNormalizer.ts` | Branch B 扩展 + computeArticlePreview 扩展 + 计数修复 |
| 修改 | `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts` | 新增刷新路径/预览/计数测试 |
| 修改 | `src/components/ArticlePreviewDialog.tsx` | isRefreshable Badge + 默认勾选 |
| 修改 | `prisma/schema.prisma` | CollectorRun 增加计数字段 |
| 修改 | `src/app/api/collectors/wechat/sync/route.ts` | 返回 refreshedCount + CollectorRun 写入 |
| 修改 | `src/app/api/collectors/wechat/sync/confirm/route.ts` | 返回 refreshedCount + CollectorRun 写入 |
| 修改 | `src/app/api/integrations/wechat-rss/refresh-source/route.ts` | 返回 refreshedCount |
| 修改 | `src/components/subscriptions/SubscriptionsPage.tsx` | alert 文案展示刷新计数 |
| 修改 | `src/components/CollectDialog.tsx` | 刷新计数展示标签改为"刷新"（去掉"封禁"） |

---

## Task 1：修复导航内容过滤器误杀（最高优先级）

**Files:**
- Modify: `src/services/content-filter.ts:134-155`
- Create: `src/services/__tests__/content-filter.test.ts`

当前 `checkNavigationContentFilter()` 只看短行比例，不考虑总字数。微信文章分段后天然多短行，2000-4800 字的文章也被误杀。

- [ ] **Step 1: 写失败测试**

创建 `src/services/__tests__/content-filter.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { checkNavigationContentFilter } from "../content-filter";

describe("checkNavigationContentFilter", () => {
  it("短文本 + 高短行比应被判为导航页", () => {
    const lines = Array.from({ length: 20 }, () => "链接");
    const text = lines.join("\n");
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(true);
    expect(result.reason).toContain("疑似导航页面");
  });

  it("空文本不应被判为导航页", () => {
    const result = checkNavigationContentFilter(null);
    expect(result.filtered).toBe(false);
  });

  it("有效文本 >= 1500 字的微信文章不应被判为导航页", () => {
    // 模拟微信文章：大量短行 + 足够总字数
    const shortLines = Array.from({ length: 200 }, () => "▲戳蓝色字关注我们");
    const contentLines = Array.from({ length: 50 }, (_, i) => `这是第${i + 1}段正文内容，每段有足够的字数来确保总字数超过一千五百字的门槛要求，这样就不会被误判为导航页面了。`);
    const text = [...shortLines, ...contentLines].join("\n");
    // 确认总字数 >= 1500
    const effectiveLen = text.replace(/\s+/g, "").trim().length;
    expect(effectiveLen).toBeGreaterThanOrEqual(1500);
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(false);
  });

  it("有效文本 < 1500 字且高短行比仍被判为导航页", () => {
    const shortLines = Array.from({ length: 30 }, () => "链接文字");
    const text = shortLines.join("\n");
    const effectiveLen = text.replace(/\s+/g, "").trim().length;
    expect(effectiveLen).toBeLessThan(1500);
    const result = checkNavigationContentFilter(text);
    expect(result.filtered).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/__tests__/content-filter.test.ts`
Expected: "有效文本 >= 1500 字" 测试失败（当前逻辑不看总字数，只看短行比）

- [ ] **Step 3: 修改 `checkNavigationContentFilter` 增加字数门槛**

在 `src/services/content-filter.ts:134-155` 修改：

```ts
export function checkNavigationContentFilter(fullText: string | null): FilterResult {
  if (!fullText) return { filtered: false };

  // 新增：有效正文字数 >= 1500 的文章不可能是导航页
  const effectiveLength = fullText.replace(/\s+/g, "").trim().length;
  if (effectiveLength >= 1500) return { filtered: false };

  const lines = fullText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // If most lines are very short (< 20 chars), it's likely navigation
  if (lines.length > 10) {
    const shortLineCount = lines.filter((l) => l.length < 20).length;
    const ratio = shortLineCount / lines.length;
    if (ratio > 0.7) {
      return {
        filtered: true,
        reason: `疑似导航页面（${(ratio * 100).toFixed(0)}% 行为短文本，共 ${lines.length} 行）`,
      };
    }
  }

  return { filtered: false };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/__tests__/content-filter.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: 运行全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add src/services/content-filter.ts src/services/__tests__/content-filter.test.ts
git commit -m "fix(content-filter): add 1500-char threshold to navigation filter to prevent WeChat article false positives"
```

---

## Task 2：扩展 normalizeWeRssArticle 刷新路径（覆盖"疑似导航页面"误杀）

**Files:**
- Modify: `src/services/collectors/wechat/weRssNormalizer.ts:349-350`
- Modify: `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`

Branch B 当前条件：`existing.filterReason?.includes("无全文内容") || existing.filterReason?.includes("全文过短")`。不覆盖"疑似导航页面"误杀的记录。

- [ ] **Step 1: 写失败测试**

在 `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts` 的 `normalizeWeRssArticle -- blocked record refresh` describe block末尾添加：

```ts
describe("filtered record with 疑似导航页面", () => {
  it("should update filtered record with 疑似导航页面 when new content is sufficient", async () => {
    const existing = await db.contentItem.create({
      data: {
        ...baseContentItemData,
        qualityStatus: "filtered",
        filterReason: "疑似导航页面（81% 行为短文本，共 275 行）",
        processingStatus: "filtered",
        fullText: "short\nlines\nonly",
        effectiveTextLength: 14,
        fullTextStored: true,
      },
    });

    const result = await normalizeWeRssArticle(
      {
        ...baseArticleData,
        hasContent: 1,
        content: "a".repeat(2000), // 2000 chars, above 1500 threshold
      },
      { sourceId: "test-source" }
    );

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(false);
    expect(result.item.id).toBe(existing.id);

    const updated = await db.contentItem.findUnique({ where: { id: existing.id } });
    expect(updated?.qualityStatus).toBe("pending");
    expect(updated?.filterReason).toBeNull();
    expect(updated?.processingStatus).toBe("fetched");
  });

  it("should NOT update filtered record with 疑似导航页面 when new content is still too short", async () => {
    const existing = await db.contentItem.create({
      data: {
        ...baseContentItemData,
        qualityStatus: "filtered",
        filterReason: "疑似导航页面（81% 行为短文本，共 275 行）",
        processingStatus: "filtered",
        fullText: "short\nlines\nonly",
        effectiveTextLength: 14,
        fullTextStored: true,
      },
    });

    const result = await normalizeWeRssArticle(
      {
        ...baseArticleData,
        hasContent: 1,
        content: "a".repeat(100), // only 100 chars, still too short
      },
      { sourceId: "test-source" }
    );

    expect(result.created).toBe(false);
    expect(result.filtered).toBe(true);
    expect(result.filterReason).toContain("疑似导航页面");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts -t "疑似导航页面"`
Expected: "should update filtered record with 疑似导航页面" FAIL（Branch B 不覆盖"疑似导航页面"）

- [ ] **Step 3: 修改 Branch B 条件**

在 `src/services/collectors/wechat/weRssNormalizer.ts:349-350` 修改：

```ts
// 修改前：
if (existing.qualityStatus === "filtered" &&
    (existing.filterReason?.includes("无全文内容") || existing.filterReason?.includes("全文过短"))) {

// 修改后：
if (existing.qualityStatus === "filtered" &&
    (existing.filterReason?.includes("无全文内容") || existing.filterReason?.includes("全文过短") || existing.filterReason?.includes("疑似导航页面"))) {
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts -t "疑似导航页面"`
Expected: 全部 PASS

- [ ] **Step 5: 运行全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add src/services/collectors/wechat/weRssNormalizer.ts src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts
git commit -m "fix(normalizer): extend Branch B refresh path to cover 疑似导航页面 false positives"
```

---

## Task 3：预览函数区分"硬重复"vs"可刷新" + ArticlePreviewDialog Badge 更新

**Files:**
- Modify: `src/services/collectors/wechat/weRssNormalizer.ts:23-35, 143-254`（PreviewArticle 接口 + computeArticlePreview 函数）
- Modify: `src/components/ArticlePreviewDialog.tsx:17-29, 49-55, 160-169`

### 3a. 扩展 PreviewArticle 接口和 computeArticlePreview

- [ ] **Step 1: 在 PreviewArticle 接口增加 isRefreshable 字段**

`src/services/collectors/wechat/weRssNormalizer.ts:23-35` 修改：

```ts
export interface PreviewArticle {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishTime?: string;
  cover?: string;
  effectiveTextLength: number;
  filtered: boolean;
  filterReason?: string;
  contentPreview: string;
  isDuplicate: boolean;
  isRefreshable: boolean;  // 新增：可刷新的已有记录
}
```

- [ ] **Step 2: 扩展 computeArticlePreview 的 findUnique select**

`src/services/collectors/wechat/weRssNormalizer.ts:143-147` 修改：

```ts
// 修改前：
const existing = await db.contentItem.findUnique({
  where: { originalUrl },
  select: { id: true },
});
const isDuplicate = !!existing;

// 修改后：
const existing = await db.contentItem.findUnique({
  where: { originalUrl },
  select: { id: true, qualityStatus: true, filterReason: true, effectiveTextLength: true },
});
const isDuplicate = !!existing;
const isRefreshable = !!existing && (
  existing.qualityStatus === "blocked" ||
  (existing.qualityStatus === "filtered" && (
    existing.filterReason?.includes("无全文内容") ||
    existing.filterReason?.includes("全文过短") ||
    existing.filterReason?.includes("疑似导航页面")
  ))
);
```

- [ ] **Step 3: 更新所有 return 语句增加 isRefreshable 字段**

`computeArticlePreview` 有 5 个 return 点，每个都需要增加 `isRefreshable` 字段：

1. URL 缺失（~line 131-139）→ `isRefreshable: false`
2. 封禁/验证页（~line 173-186）→ `isRefreshable: isRefreshable`（已有记录是 blocked 时可刷新）
3. 补抓失败（~line 189-203）→ `isRefreshable: isRefreshable`
4. 质量门控（~line 206-222）→ `isRefreshable: isRefreshable`
5. 正常返回（~line 240-254）→ `isRefreshable: isRefreshable`

其中最后一个 return 点还需要调整 `filtered` 和 `filterReason` 逻辑：

```ts
// 修改前（~line 248-253）：
filtered: isDuplicate || filterResult.filtered,
filterReason: isDuplicate
  ? "URL 已存在（重复）"
  : filterResult.reason,
isDuplicate,

// 修改后：
filtered: (isDuplicate && !isRefreshable) || filterResult.filtered,
filterReason: isDuplicate && !isRefreshable
  ? "URL 已存在（重复）"
  : isRefreshable
    ? `可刷新（${existing?.filterReason ?? "内容过期"}）`
    : filterResult.reason,
isDuplicate,
isRefreshable,
```

- [ ] **Step 4: 更新 ArticlePreviewDialog.tsx 的 PreviewArticle 接口**

`src/components/ArticlePreviewDialog.tsx:17-29` 修改：

```ts
export interface PreviewArticle {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishTime?: string;
  cover?: string;
  effectiveTextLength: number;
  filtered: boolean;
  filterReason?: string;
  contentPreview: string;
  isDuplicate: boolean;
  isRefreshable: boolean;  // 新增
}
```

- [ ] **Step 5: 更新默认选中逻辑**

`src/components/ArticlePreviewDialog.tsx:49-55` 修改：

```ts
// 修改前：
const s = new Set<string>();
for (const a of articles) {
  if (!a.filtered) s.add(a.url);
}
return s;

// 修改后：
const s = new Set<string>();
for (const a of articles) {
  if (!a.filtered || a.isRefreshable) s.add(a.url);
}
return s;
```

同样更新 articles 变化时的重置逻辑（~line 62-66）：

```ts
const s = new Set<string>();
for (const a of articles) {
  if (!a.filtered || a.isRefreshable) s.add(a.url);
}
setSelected(s);
```

- [ ] **Step 6: 更新 Badge 渲染逻辑**

`src/components/ArticlePreviewDialog.tsx:160-169` 修改：

```tsx
// 修改前：
{article.filtered && (
  <Badge variant="destructive" className="text-xs shrink-0">
    过滤
  </Badge>
)}
{article.isDuplicate && (
  <Badge variant="outline" className="text-xs shrink-0">
    重复
  </Badge>
)}

// 修改后：
{article.isRefreshable && (
  <Badge variant="outline" className="text-xs shrink-0 border-green-300 text-green-700">
    可刷新
  </Badge>
)}
{article.isDuplicate && !article.isRefreshable && (
  <Badge variant="destructive" className="text-xs shrink-0">
    重复
  </Badge>
)}
{article.filtered && !article.isRefreshable && (
  <Badge variant="destructive" className="text-xs shrink-0">
    过滤
  </Badge>
)}
```

- [ ] **Step 7: 运行全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 8: Commit**

```bash
git add src/services/collectors/wechat/weRssNormalizer.ts src/components/ArticlePreviewDialog.tsx
git commit -m "feat(preview): distinguish hard duplicates from refreshable articles, add green 可刷新 Badge"
```

---

## Task 4：CollectorRun 增加 refreshedCount / skippedCount / blockedCount 字段

**Files:**
- Modify: `prisma/schema.prisma:334-351`

- [ ] **Step 1: 修改 CollectorRun model**

`prisma/schema.prisma` CollectorRun model 修改：

```prisma
model CollectorRun {
  id              String   @id @default(cuid())
  sourceId        String
  collectorType   String                 // 采集器类型
  startedAt       DateTime @default(now())
  finishedAt      DateTime?              // 完成时间
  status          String   @default("running") // running / success / partial / failed
  discoveredCount Int      @default(0)   // 发现数量
  importedCount   Int      @default(0)   // 导入数量
  refreshedCount  Int      @default(0)   // 刷新数量（新增）
  skippedCount    Int      @default(0)   // 跳过数量（新增）
  blockedCount    Int      @default(0)   // 封禁数量（新增）
  errorSummary    String?                // 错误摘要
  evidencePath    String?                // 证据路径

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@index([sourceId])
  @@index([status])
  @@index([startedAt])
}
```

- [ ] **Step 2: 生成并应用 migration**

Run: `pnpm db:migrate`
Expected: 生成 migration 文件并成功应用到数据库

- [ ] **Step 3: 生成 Prisma client**

Run: `pnpm prisma generate`
Expected: 成功

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add refreshedCount, skippedCount, blockedCount to CollectorRun"
```

---

## Task 5：sync/confirm/refresh-source route 返回完整计数 + 写入 CollectorRun

**Files:**
- Modify: `src/app/api/collectors/wechat/sync/route.ts:89-97, 118-126`
- Modify: `src/app/api/collectors/wechat/sync/confirm/route.ts:118-128, 139-146`
- Modify: `src/app/api/integrations/wechat-rss/refresh-source/route.ts:94-101`

### 5a. sync route

- [ ] **Step 1: 更新 CollectorRun update 写入完整计数**

`src/app/api/collectors/wechat/sync/route.ts:89-97` 修改：

```ts
// 修改后：
await db.collectorRun.update({
  where: { id: runRecord.id },
  data: {
    status: result.errors.length > 0 ? "partial" : "success",
    finishedAt: new Date(),
    discoveredCount: result.discovered,
    importedCount: result.imported,
    refreshedCount: result.refreshed,  // 新增
    skippedCount: result.skipped,      // 新增
    blockedCount: result.blocked,      // 新增
    errorSummary: result.errors.length > 0 ? result.errors.join("\n") : null,
  },
});
```

- [ ] **Step 2: 更新 task 返回值**

`src/app/api/collectors/wechat/sync/route.ts:118-126` 修改：

```ts
// 修改后：
return {
  success: result.errors.length === 0,
  discoveredCount: result.discovered,
  importedCount: result.imported,
  refreshedCount: result.refreshed,  // 新增
  skippedCount: result.skipped,
  blockedCount: result.blocked,
  errors: result.errors.length > 0 ? result.errors : undefined,
  sourceName: source.name,
};
```

### 5b. confirm route

- [ ] **Step 3: 更新 CollectorRun update 写入完整计数**

`src/app/api/collectors/wechat/sync/confirm/route.ts:118-128` 修改：

```ts
// 修改后：
await db.collectorRun.update({
  where: { id: runRecord.id },
  data: {
    status: result.errors.length > 0 ? "partial" : "success",
    finishedAt: new Date(),
    discoveredCount: result.discovered,
    importedCount: result.imported,
    refreshedCount: result.refreshed,  // 新增
    skippedCount: result.skipped,      // 新增
    blockedCount: result.blocked,      // 新增
    errorSummary: result.errors.length > 0 ? result.errors.join("\n") : null,
  },
});
```

- [ ] **Step 4: 更新 JSON 响应**

`src/app/api/collectors/wechat/sync/confirm/route.ts:139-146` 修改：

```ts
// 修改后：
return NextResponse.json({
  success: result.errors.length === 0,
  discoveredCount: result.discovered,
  importedCount: result.imported,
  refreshedCount: result.refreshed,  // 新增
  skippedCount: result.skipped,
  blockedCount: result.blocked,
  errors: result.errors.length > 0 ? result.errors : undefined,
});
```

### 5c. refresh-source route

- [ ] **Step 5: 更新 JSON 响应**

`src/app/api/integrations/wechat-rss/refresh-source/route.ts:94-101` 修改：

```ts
// 修改后：
return NextResponse.json({
  success: result.errors.length === 0,
  discoveredCount: result.discovered,
  importedCount: result.imported,
  refreshedCount: result.refreshed,  // 新增
  skippedCount: result.skipped,
  blockedCount: result.blocked,
  errors: result.errors.length > 0 ? result.errors : undefined,
});
```

- [ ] **Step 6: 运行全量测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
git add src/app/api/collectors/wechat/sync/route.ts src/app/api/collectors/wechat/sync/confirm/route.ts src/app/api/integrations/wechat-rss/refresh-source/route.ts
git commit -m "fix(api): return refreshedCount in all sync routes and persist full counts to CollectorRun"
```

---

## Task 6：UI 采集结果展示增加完整计数

**Files:**
- Modify: `src/components/subscriptions/SubscriptionsPage.tsx:510-516, 541-548`
- Modify: `src/components/CollectDialog.tsx:291-295, 319`

### 6a. SubscriptionsPage alert 文案

- [ ] **Step 1: 更新非 WeChat 单源采集 alert**

`src/components/subscriptions/SubscriptionsPage.tsx:510-516` 修改：

```tsx
// 修改前：
const skipped = result?.skippedCount ?? 0;
alert(
  `采集完成：发现 ${result?.discoveredCount ?? 0} 条，导入 ${result?.importedCount ?? 0} 条` +
    (skipped > 0 ? `，跳过 ${skipped} 条` : "")
);

// 修改后：
const skipped = result?.skippedCount ?? 0;
const blocked = result?.blockedCount ?? 0;
const refreshed = result?.refreshedCount ?? 0;
alert(
  `采集完成：发现 ${result?.discoveredCount ?? 0} 条，导入 ${result?.importedCount ?? 0} 条` +
    (refreshed > 0 ? `，刷新 ${refreshed} 条` : "") +
    (blocked > 0 ? `，封禁 ${blocked} 条` : "") +
    (skipped > 0 ? `，跳过 ${skipped} 条` : "")
);
```

- [ ] **Step 2: 更新 WeChat confirm 采集 alert**

`src/components/subscriptions/SubscriptionsPage.tsx:541-548` 修改：

```tsx
// 修改前：
const skipped = data.skippedCount ?? 0;
const blocked = data.blockedCount ?? 0;
const refreshed = data.refreshedCount ?? 0;
alert(
  `导入完成：发现 ${data.discoveredCount ?? 0} 条，导入 ${data.importedCount ?? 0} 条` +
    (blocked > 0 ? `，封禁 ${blocked}` : "") +
    (refreshed > 0 ? `，刷新封禁 ${refreshed}` : "") +
    (skipped > 0 ? `，跳过 ${skipped} 条` : "")
);

// 修改后：
const skipped = data.skippedCount ?? 0;
const blocked = data.blockedCount ?? 0;
const refreshed = data.refreshedCount ?? 0;
alert(
  `导入完成：发现 ${data.discoveredCount ?? 0} 条，导入 ${data.importedCount ?? 0} 条` +
    (refreshed > 0 ? `，刷新 ${refreshed} 条` : "") +
    (blocked > 0 ? `，封禁 ${blocked} 条` : "") +
    (skipped > 0 ? `，跳过 ${skipped} 条` : "")
);
```

### 6b. CollectDialog "刷新封禁" → "刷新"

- [ ] **Step 3: 更新 CollectDialog 摘要标签**

`src/components/CollectDialog.tsx:291-295` 修改：

```tsx
// 修改前：
{totalRefreshed > 0 && (
  <div className="flex items-center gap-1.5">
    <RefreshCw className="h-4 w-4 text-blue-500" />
    <span className="text-sm font-medium text-blue-600">{totalRefreshed} 刷新封禁</span>
  </div>
)}

// 修改后：
{totalRefreshed > 0 && (
  <div className="flex items-center gap-1.5">
    <RefreshCw className="h-4 w-4 text-blue-500" />
    <span className="text-sm font-medium text-blue-600">{totalRefreshed} 刷新</span>
  </div>
)}
```

- [ ] **Step 4: 更新 CollectDialog 单源结果行**

`src/components/CollectDialog.tsx:319` 修改：

```tsx
// 修改前：
`发现 ${r.discoveredCount ?? 0}，导入 ${r.importedCount ?? 0}${(r.blockedCount ?? 0) > 0 ? `，封禁 ${r.blockedCount}` : ""}${(r.refreshedCount ?? 0) > 0 ? `，刷新封禁 ${r.refreshedCount}` : ""}${(r.skippedCount ?? 0) > 0 ? `，跳过 ${r.skippedCount}` : ""}`

// 修改后：
`发现 ${r.discoveredCount ?? 0}，导入 ${r.importedCount ?? 0}${(r.refreshedCount ?? 0) > 0 ? `，刷新 ${r.refreshedCount}` : ""}${(r.blockedCount ?? 0) > 0 ? `，封禁 ${r.blockedCount}` : ""}${(r.skippedCount ?? 0) > 0 ? `，跳过 ${r.skippedCount}` : ""}`
```

- [ ] **Step 5: Commit**

```bash
git add src/components/subscriptions/SubscriptionsPage.tsx src/components/CollectDialog.tsx
git commit -m "fix(ui): show refreshed count separately from blocked, change label from 刷新封禁 to 刷新"
```

---

## Task 7：修复已有误杀数据

**Files:**
- 无代码修改，通过 DB 脚本执行

- [ ] **Step 1: 编写并执行 DB 修复脚本**

需要通过 Prisma 执行（Prisma 7 需要 PrismaPg adapter）。创建临时脚本 `scripts/fix-navigation-false-positives.ts`：

```ts
/**
 * 修复被导航过滤器误杀的微信文章。
 * 将 qualityStatus="filtered" 且 filterReason 包含"疑似导航页面"的 ContentItem
 * 恢复为 processingStatus="fetched", qualityStatus="pending", filterReason=null
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const items = await prisma.contentItem.findMany({
    where: {
      qualityStatus: "filtered",
      filterReason: { contains: "疑似导航页面" },
    },
    select: { id: true, title: true, effectiveTextLength: true },
  });

  console.log(`Found ${items.length} navigation-filtered items`);

  if (items.length === 0) {
    console.log("No items to fix");
    return;
  }

  for (const item of items) {
    // 只修复有效文本 >= 1500 字的（确认不是真正导航页）
    if (item.effectiveTextLength >= 1500) {
      await prisma.contentItem.update({
        where: { id: item.id },
        data: {
          processingStatus: "fetched",
          qualityStatus: "pending",
          filterReason: null,
        },
      });
      console.log(`✓ Fixed: ${item.title} (${item.effectiveTextLength} chars)`);
    } else {
      console.log(`⊘ Skipped (too short): ${item.title} (${item.effectiveTextLength} chars)`);
    }
  }

  console.log("Done");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
```

Run: `npx tsx scripts/fix-navigation-false-positives.ts`
Expected: 输出修复的记录数和详情

- [ ] **Step 2: 验证修复后数据正确**

查询 DB 确认：
- 修复后的记录 `qualityStatus = "pending"`, `filterReason = null`, `processingStatus = "fetched"`
- 有效文本 < 1500 字的记录保持不变

- [ ] **Step 3: 删除临时脚本并 Commit**

```bash
rm scripts/fix-navigation-false-positives.ts
git add -A
git commit -m "fix(data): repair navigation-filter false positive records in DB (12 items for 观潮的螃蟹)"
```

---

## Task 依赖关系

```
Task 1 (导航过滤器) → Task 2 (Branch B 扩展) → Task 3 (预览/Badge)
                   → Task 7 (DB 修复，依赖 Task 1 的 1500 门槛判断)
Task 4 (Schema) → Task 5 (API 路由)
Task 6 (UI) 依赖 Task 5 (API 返回 refreshedCount)
Task 3 和 Task 4-6 无互相依赖，可并行
```

## 验证方法

1. **代码验证**：`pnpm lint && pnpm test && pnpm build` 全部通过
2. **单元测试**：导航过滤器 1500 字门槛测试通过
3. **单元测试**：normalizeWeRssArticle Branch B 覆盖"疑似导航页面"通过
4. **单元测试**：computeArticlePreview 正确区分 isRefreshable
5. **功能验证**：重新采集观潮的螃蟹，12 篇不再被导航过滤器误杀
6. **功能验证**：预览页面中，可刷新文章显示绿色"可刷新"Badge，硬重复显示红色"重复"Badge
7. **功能验证**：可刷新文章默认勾选，勾选后确认导入，文章内容成功更新
8. **功能验证**：重新采集浙江宣传，确认显示"刷新 12 条"而非"导入 0"
9. **DB 验证**：误杀文章恢复为 pending/fetched 状态
10. **E2E 验证**：`pnpm exec playwright test wechat-rss --reporter=list` 全部通过
