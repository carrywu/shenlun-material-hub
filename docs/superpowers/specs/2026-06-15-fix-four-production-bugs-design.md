# 修复 4 个线上 Bug

**日期**：2026-06-15
**状态**：待实施

## Context

生产环境中用户报告 4 个 bug：
1. 来源管理同步 we-mp-rss 后，之前封禁的文章仍显示"封禁"（we-mp-rss 已有正确内容）
2. `/admin/articles` 点击搜索跳转到 `/articles`，空搜索也触发跳转
3. we-mp-rss "打开后台"按钮跳转到 `localhost:8001` 而非配置的地址
4. 文章管理页缺少"封禁"状态筛选选项

用户决策：同步 we-mp-rss 时自动刷新封禁文章——不需要额外按钮，点"同步 WeWe"即可。

---

## Bug 1：封禁文章无法重新采集（核心问题）

### 根因

`weRssNormalizer.ts:255-266`：URL 去重是无条件跳过——只要 `originalUrl` 已存在就 `return { created: false, item: existing }`，不管 `qualityStatus` 是否为 `"blocked"`。

数据流：
```
首次采集 → 微信封禁 → 入库 qualityStatus="blocked" + 封禁页面内容
微信解封 → we-mp-rss 已有正确内容
再次采集 → URL 已存在 → 跳过 → 封禁文章永远保持封禁
```

### 修复

**修改 `src/services/collectors/wechat/weRssNormalizer.ts`** `normalizeWeRssArticle()` 的去重逻辑：

当 `existing.qualityStatus === "blocked"` 时：
1. 清洗新文章内容
2. 如果新内容**仍被封禁**（`detectWechatBlockPage(fullText)` 为 true）→ 保持跳过，不更新
3. 如果新内容**正常** → 更新旧记录：保留 `id`/`bookmarked`/`read`/`ignored`，替换 `fullText`/`rawHtml`/`excerpt`/`contentHash`，重置 `qualityStatus` 为 `"pending"`、`processingStatus` 为 `"fetched"`，清除旧 AI 评估结果（`aiDecision`/`aiReason`/`aiAssessedAt` 等）

在 `normalizeWeRssArticles()` 的统计中，区分"新建"和"刷新封禁"：当 `created: false` 但记录从 `blocked` 更新为正常内容时，计入 `refreshed` 而非 `skipped`。更新返回值增加 `refreshed` 字段。

**不需要额外 API 或参数**——正常采集流程已能刷新封禁记录。

### 统计透传

`normalizeWeRssArticles()` 返回值增加 `refreshed` 字段后，需透传至前端：

- `src/app/api/collectors/wechat/sync/route.ts`：`runWechatSyncTask` 返回值加 `refreshedCount`，API 响应加 `refreshedCount`
- `src/components/CollectDialog.tsx`：`CollectResult` 接口加 `refreshedCount?: number`，结果展示加"刷新 N 条封禁"

**注意**：`sync/route.ts` 第 63 行调用 `normalizeWeRssArticles`，需要从 `result.refreshed` 取值。`CollectDialog` 第 199-211 行解析 task result，需要读取 `refreshedCount`。

---

## Bug 2：/admin/articles 搜索跳转到 /articles

### 根因

`ArticlesPage.tsx` 中 4 处硬编码 `/articles` 路径：

| 行 | 函数 | 代码 |
|----|------|------|
| 276 | `syncUrl()` | `` router.replace(`/articles${...}`) `` |
| 307 | `handleReset()` | `router.replace("/articles")` |
| 925 | 行点击 | `` router.push(`/articles/${item.id}`) `` |
| 957 | 标题点击 | `` router.push(`/articles/${item.id}`) `` |

空搜索也跳转：`handleSearch()` 不验证输入直接调用 `syncUrl()`。

### 修复

1. 组件顶部：`const basePath = managementMode ? "/admin/articles" : "/articles";`
2. 4 处全部改用 `basePath`
3. `handleSearch()`：当 keyword 为空且所有 filter 为默认值时，不调用 `syncUrl()`

---

## Bug 3：we-mp-rss "打开后台"跳转到 localhost:8001

### 根因

`WeweRssIntegrationPage.tsx:289`：
```tsx
<a href="http://localhost:8001" target="_blank">打开 WeWe 后台</a>
```
组件已有 `baseUrl` 状态变量（第 68 行），但 `<a>` 标签硬编码 localhost。

### 修复

将 `href="http://localhost:8001"` 改为 `href={baseUrl}`。

---

## Bug 4：文章管理页缺少"封禁"状态筛选

### 根因

1. `src/types/index.ts`：`QUALITY_STATUSES` 缺少 `"blocked"`
2. `ArticlesPage.tsx:85-91`：`QUALITY_STATUS_OPTIONS` 没有"封禁"选项

### 修复

1. `src/types/index.ts`：`QUALITY_STATUSES` 加入 `"blocked"`；`PROCESSING_STATUSES` 加入 `"blocked"`
2. `ArticlesPage.tsx`：`QUALITY_STATUS_OPTIONS` 加入 `{ value: "blocked", label: "封禁" }`

---

## 修改文件清单

| 文件 | 修改 |
|------|------|
| `src/services/collectors/wechat/weRssNormalizer.ts` | 封禁文章去重逻辑改为更新（核心修复） |
| `src/app/api/collectors/wechat/sync/route.ts` | 透传 `refreshedCount` 到 API 响应 |
| `src/components/CollectDialog.tsx` | 展示"刷新 N 条封禁"统计 |
| `src/components/articles/ArticlesPage.tsx` | 4 处路径改 `basePath`；空搜索不跳转；加封禁 filter |
| `src/components/integrations/WeweRssIntegrationPage.tsx` | "打开后台" href 改用 `baseUrl` |
| `src/types/index.ts` | `QualityStatus`/`ProcessingStatus` 加入 `"blocked"` |

---

## 验证

1. `pnpm lint && pnpm test && pnpm build`
2. 浏览器：`/admin/articles` 搜索 → 留在 `/admin/articles?keyword=xxx`
3. 浏览器：空搜索 → 不跳转
4. 浏览器：`/admin/articles` 点击文章行 → `/admin/articles/{id}`
5. 浏览器：we-mp-rss 集成页 → "打开后台"用配置的 baseUrl
6. 文章管理页 → 质量状态筛选有"封禁"选项
7. 数据库 `qualityStatus="blocked"` 记录 → 同步后更新为正常内容
