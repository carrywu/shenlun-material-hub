# 微信文章采集 Bug 修复设计文档

> 日期：2026-06-17
> 状态：已确认

## 1. 背景

用户报告采集结果异常：
- **浙江宣传**：发现 12，导入 0
- **观潮的螃蟹**：发现 26，导入 8，跳过 18

另有新需求：来源管理预览中，URL 重复的文章（旧内容 404/过时）无法被新采集覆盖。

## 2. 根因分析

### 2.1 浙江宣传：12 发现，0 导入

**根因**：refreshedCount 未展示。12 篇文章实际已通过刷新路径成功更新（`processingStatus: "fetched"`, `effectiveTextLength > 2000`），但 `refreshed` 计数未被 API 返回、CollectorRun 未存储、UI 未展示，用户只能看到"导入 0"。

**时序**：
1. 修复 `mapArticleFromApi` 之前：snake_case Bug → hasContent=undefined → 全部走"无全文内容" → `qualityStatus: "filtered"`, `filterReason: "无全文内容"`
2. 修复后再次采集：hasContent 正确映射 → getArticle 获取到内容 → URL 重复检测走 Branch B 刷新路径 → 更新为 `processingStatus: "fetched"` → `refreshed++`
3. API/CollectorRun 不返回 refreshedCount → 用户看到"导入 0"

### 2.2 观潮的螃蟹：26 发现，8 导入，18 跳过

**跳过 18 篇分解**：
- **12 篇**：导航内容过滤器误杀（`filterReason: "疑似导航页面"`）
- **3 篇**：we-mp-rss 未获取到内容（`filterReason: "无全文内容"`）
- **3 篇**：URL 重复跳过

**导航过滤器误杀分析**：

`checkNavigationContentFilter()` 逻辑：`lines.length > 10 && shortLineCount/lines.length > 0.7` → 疑似导航。

但微信文章按 `p, div, section, h1-h6, li, blockquote, pre` 分段后，天然产生大量短行（图片说明、小标题、引用句、列表项、署名）。12 篇误杀文章的有效文本长度 2039-4801 字，显然不是导航页。

### 2.3 URL 重复阻止可刷新文章重新导入

**根因三层**：

| 层面 | 问题 | 文件 |
|------|------|------|
| A | `computeArticlePreview()` 只取 `id`，不区分"硬重复"vs"可刷新" | `weRssNormalizer.ts:143-146` |
| B | `normalizeWeRssArticle()` Branch B 刷新条件不覆盖"疑似导航页面" | `weRssNormalizer.ts:349-350` |
| C | 用户在预览勾选重复文章后确认导入，仍走 Branch C 跳过 | 同上 |

预览函数一律标记 `isDuplicate: true`, `filterReason: "URL 已存在（重复）"`。被导航过滤器误杀的 12 篇文章 filterReason 不含"无全文内容"/"全文过短"，无法走刷新路径。

### 2.4 计数逻辑缺陷

`normalizeWeRssArticles()` 计数规则：
- `created && !filtered` → imported
- filterReason 含"封禁"/"缺失"/"补抓失败" → blocked
- `!created && !filtered && !filterReason` → refreshed
- 其余 → skipped

**问题**：
1. "无全文内容"不含"缺失"，走 skipped 而非 blocked
2. Branch A "still blocked" 子路径返回 `{ created: false, item }` 无 filtered/filterReason → 被误计为 refreshed（实际是 no-op 跳过）
3. API 不返回 refreshedCount，CollectorRun 不存储

## 3. 修复方案

### Bug 1：导航内容过滤器误杀 ✅ 用户确认：1500 字门槛

**文件**：`src/services/content-filter.ts`

`checkNavigationContentFilter()` 增加字数门槛：effectiveTextLength >= 1500 直接返回 `{ filtered: false }`。

```ts
export function checkNavigationContentFilter(fullText: string | null): FilterResult {
  if (!fullText) return { filtered: false };
  const effectiveLength = fullText.replace(/\s+/g, "").trim().length;
  if (effectiveLength >= 1500) return { filtered: false };
  // ... 原有逻辑不变
}
```

### Bug 2：URL 重复阻止可刷新文章重新导入

**文件**：
- `src/services/collectors/wechat/weRssNormalizer.ts`
- `src/components/ArticlePreviewDialog.tsx`

**3.2.1 扩展 normalizeWeRssArticle Branch B 刷新条件**

增加 `existing.filterReason?.includes("疑似导航页面")`，让误杀文章能通过重新采集自动刷新。

**3.2.2 预览函数区分"硬重复"vs"可刷新"**

- `computeArticlePreview()` 的 `findUnique` 增加 `select: { id, qualityStatus, filterReason, effectiveTextLength }`
- `PreviewArticle` 接口增加 `isRefreshable: boolean`
- 判定逻辑：
  - `qualityStatus === "blocked"` → `isRefreshable: true`
  - `qualityStatus === "filtered"` 且 filterReason 含"无全文内容"/"全文过短"/"疑似导航页面" → `isRefreshable: true`
  - 其他 → `isRefreshable: false`

**3.2.3 ArticlePreviewDialog UI 更新**（✅ 用户确认：绿"可刷新"Badge + 红"重复"Badge）

- `isRefreshable: true` → 绿色"可刷新"Badge
- `isDuplicate && !isRefreshable` → 红色"重复"Badge
- 可刷新文章默认勾选

### Bug 3：API/CollectorRun 缺少 refreshedCount

**文件**：
- `prisma/schema.prisma`
- `src/app/api/collectors/wechat/sync/route.ts`
- `src/app/api/collectors/wechat/sync/confirm/route.ts`
- `src/app/api/integrations/wechat-rss/refresh-source/route.ts`

CollectorRun schema 增加 `refreshedCount`, `skippedCount`, `blockedCount`。API 响应同步返回。

### Bug 4：UI 采集结果展示

**文件**：`src/components/subscriptions/SubscriptionsPage.tsx`

采集结果卡片显示完整计数：导入 N、刷新 N、跳过 N、封禁 N。

## 4. 关键文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/services/content-filter.ts` | 修改 | 导航过滤器增加 1500 字门槛 |
| `src/services/content-filter.test.ts` | 修改 | 新增测试用例 |
| `src/services/collectors/wechat/weRssNormalizer.ts` | 修改 | Branch B 扩展 + computeArticlePreview 扩展 |
| `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts` | 修改 | 新增测试用例 |
| `src/components/ArticlePreviewDialog.tsx` | 修改 | isRefreshable Badge + 默认勾选 |
| `prisma/schema.prisma` | 修改 | CollectorRun 增加计数字段 |
| `src/app/api/collectors/wechat/sync/route.ts` | 修改 | 返回完整计数 |
| `src/app/api/collectors/wechat/sync/confirm/route.ts` | 修改 | 返回完整计数 |
| `src/app/api/integrations/wechat-rss/refresh-source/route.ts` | 修改 | 返回完整计数 |
| `src/components/subscriptions/SubscriptionsPage.tsx` | 修改 | UI 采集结果展示 |

## 5. 不做的事项

- **不删除旧文章数据**：用户明确"这次先不删旧数据，先把新采集覆盖旧数据的功能做好"
- **不修改 detectWechatBlockPage 逻辑**：该函数逻辑正确，无需改动
- **不修改 extractPlainText 逻辑**：分段逻辑合理，问题在过滤器阈值

## 6. 验证方法

1. `pnpm lint && pnpm test && pnpm build` 全部通过
2. 导航过滤器单元测试：1500 字以上文章不被判为导航页
3. normalizeWeRssArticle 单元测试："疑似导航页面"误杀文章可通过重新采集刷新
4. 预览页面：可刷新文章显示绿色"可刷新"Badge，硬重复显示红色"重复"Badge
5. 勾选可刷新文章后确认导入，文章内容成功更新
6. 采集结果：显示"刷新 N 篇"而非"导入 0"
7. DB 修复：误杀文章恢复为 fetched 状态
