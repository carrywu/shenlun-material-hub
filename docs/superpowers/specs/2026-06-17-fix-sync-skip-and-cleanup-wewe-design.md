# 修复同步跳过 Bug + 清理 we-mp-rss 旧引用

> 日期：2026-06-17
> 状态：Approved

---

## 1. 背景与动机

用户报告两个问题：

1. **采集全跳过**：浙江宣传（found 10, imported 0, skipped 10）、观潮的螃蟹（found 25, imported 0, skipped 25）——全部文章被跳过，无法正常导入。
2. **旧引用残留**：来源管理 UI 卡片中 Source.baseUrl 显示 `http://localhost:8001`（we-mp-rss 旧值），代码中残留大量 we-mp-rss 旧命名（`we-mp-rss`、`we-mp-rss`、`WE_MP_RSS`、`localhost:8001`）。

---

## 2. Bug 修复：同步路由缺少 `getArticle()` 内容补全

### 2.1 根因分析

`src/app/api/collectors/wechat/sync/route.ts` 第 57-65 行：

```ts
const articlesData = await listArticles(baseUrl, accessKey, secretKey, {
  mpId: feedId,
  limit: SYNC_ARTICLE_LIMIT,
});
const wechatArticles = articlesData.list.map((a) =>
  fromWeMpRssArticle(a, source.name)
);
```

- `listArticles()` API 返回 `ArticleBase`（不含 `content`/`contentHtml`）
- 同步路由**没有调用 `getArticle()` 补全内容**
- 文章 `content` 为 null → `extractPlainText(null)` → `fullText = ""` → `effectiveTextLength = 0`
- normalizer 判定"无全文内容（采集器未获取到正文）" → `filtered: true`
- 统计时 `filterReason` 不含"封禁/缺失/补抓失败" → 计入 `skipped`

### 2.2 对比

**confirm** 和 **preview** 路由已有补全逻辑（第 70-83 行）：

```ts
const enrichedArticles = await Promise.all(
  articlesData.list.map(async (a) => {
    if (a.hasContent === 1 && !a.content) {
      try {
        const detail = await getArticle(baseUrl, accessKey, secretKey, a.id);
        return { ...a, content: detail.content, contentHtml: detail.contentHtml };
      } catch { return a; }
    }
    return a;
  })
);
```

sync 路由遗漏了这步。

### 2.3 修复方案

在 `sync/route.ts` 中增加同样的 `getArticle()` 批量补全逻辑，与 confirm/preview 路由一致：

1. 增加 `getArticle` import
2. 在 `listArticles` 之后、`fromWeMpRssArticle` 之前，增加批量补全逻辑
3. 将补全后的 `enrichedArticles` 传给 `fromWeMpRssArticle`

### 2.4 性能评估

N+1 查询可接受：单次同步限 `SYNC_ARTICLE_LIMIT`（100）篇，we-mp-rss 是本地 sidecar（localhost:8001），延迟极低。

---

## 3. 清理 we-mp-rss 旧引用

### 3.1 P1：运行时源代码

| 文件 | 修改 |
|------|------|
| `src/app/integrations/we-mp-rss/page.tsx` | 函数名 `WeweRssRedirectPage` → `WechatRssRedirectPage`（保留目录名，因为它是 URL 路由段） |
| `src/app/admin/integrations/we-mp-rss/page.tsx` | 函数名 `AdminWeweRssRedirectPage` → `AdminWechatRssRedirectPage` |
| `src/components/subscriptions/SubscriptionsPage.tsx` | `weweDeleteDialogOpen` → `wechatDeleteDialogOpen`（2处：useState + Dialog prop） |
| `src/test/mocks/handlers/we-mp-rss.ts` → 重命名 `wechat-rss.ts` | 文件名 + export `we-mp-rssHandlers` → `wechatRssHandlers` |
| `src/test/mocks/handlers/index.ts` | re-export 路径和名称更新 |
| `src/test/mocks/server.ts` | import 路径和名称更新 |

### 3.2 P2：测试代码

| 文件 | 修改 |
|------|------|
| `e2e/error-states.spec.ts:469-475` | 测试名/注释 `we-mp-rss` → `we-mp-rss` |

注：`e2e/wechat-rss.spec.ts:413-417` 测试旧路径重定向，**有意保留**。

### 3.3 P3：配置/部署文档

| 文件 | 修改 |
|------|------|
| `README.md:57-58` | `we-mp-rss` → `we-mp-rss`，`WE_MP_RSS_BASE_URL="localhost:8001"` → `WE_MP_RSS_BASE_URL` |
| `README.md:131` | 路由表 `we-mp-rss 集成` → `we-mp-rss 集成` |
| `DEPLOY.md:66-72` | 整个节标题+命令 `we-mp-rss` → `we-mp-rss` |
| `AGENTS.md:14,32` | `we-mp-rss` → `we-mp-rss`，路由更新 |
| `AGENT_HANDOFF.md` | 全文替换旧名称+端口 |
| `scripts/deploy/server-pull-and-restart.sh:126` | 注释更新 |

### 3.4 P4：删除旧基础设施

| 操作 | 说明 |
|------|------|
| 删除 `infra/wechat-rss/we-mp-rss/` 目录 | 仅含旧 db 文件，无用 |

### 3.5 P5：迁移脚本（保留）

`scripts/migrate-wewe-to-we-mp-rss.ts` 中的旧值引用是**迁移所需**，暂保留。

### 3.6 P6：历史文档（批量替换）

`docs/` 下文件执行批量 `we-mp-rss` → `we-mp-rss` / `we-mp-rss` → `we-mp-rss` / `localhost:8001` → `WE_MP_RSS_BASE_URL` 替换。

---

## 4. 数据库旧记录更新

Source 表中 `baseUrl` 为 `http://localhost:8001` 的旧记录需要更新为实际 we-mp-rss 服务地址。使用环境变量 `WE_MP_RSS_BASE_URL` 的值更新：

```sql
UPDATE "Source"
SET "baseUrl" = '{WE_MP_RSS_BASE_URL 的值}'
WHERE "baseUrl" LIKE '%localhost:8001%';
```

将编写一个迁移脚本来完成此操作。

---

## 5. 验证方法

1. **同步 Bug 验证**：对浙江宣传/观潮的螃蟹执行"开始采集"，确认 imported > 0
2. **旧引用验证**：`grep -r "we-mp-rss\|we-mp-rss\|WE_MP_RSS\|localhost:8001" src/ e2e/ README.md DEPLOY.md AGENTS.md` 返回 0 结果（排除迁移脚本和重定向测试）
3. **构建验证**：`pnpm lint && pnpm test && pnpm build` 全部通过
4. **UI 验证**：来源管理页面 baseUrl 字段显示正确的 we-mp-rss 地址

---

## 6. 风险

| 风险 | 缓解 |
|------|------|
| getArticle N+1 查询 | we-mp-rss 本地 sidecar，单次限 100 篇，延迟可接受 |
| 重定向目录名 `we-mp-rss` 不能改 | 保留目录名（URL 路由段），仅更新函数名 |
| 数据库更新需要确认实际地址 | 使用 .env 中 WE_MP_RSS_BASE_URL 值 |
