# we-mp-rss 迁移实施计划

> 需求文档：`docs/superpowers/specs/2026-06-16-we-mp-rss-migration-design.md`
> 日期：2026-06-16
> 状态：待实施

## Context

we-mp-rss 已归档停更，SQLite 不存文章内容。迁移到 we-mp-rss（持久存内容 + 自动补抓）。完全替换，不保留回退。38 项决策全部确认。

## 实施顺序（8 Phase，每步 `pnpm build` 通过）

### Phase 1: 基础设施层

**1.1 替换 Docker 配置**
- 删除 `infra/wechat-rss/we-mp-rss/` 目录（含 data/）
- 新建 `infra/wechat-rss/we-mp-rss/docker-compose.yml`（Q1 确认的配置，含 GATHER_CONTENT=True 等环境变量）
- 更新 `docker-compose.yml`（根）：删 we-mp-rss profile，加 we-mp-rss profile
- 更新 `docker-compose.staging.yml`：替换内联 we-mp-rss 定义为 we-mp-rss

**1.2 环境变量迁移**
- 更新 `.env.example`：删 `WERSS_*`，加 `WE_MP_RSS_BASE_URL` / `WE_MP_RSS_ACCESS_KEY` / `WE_MP_RSS_SECRET_KEY` / `WE_MP_RSS_DB_PATH`
- 更新 `.env.staging.example`：同理

**1.3 删除/更新部署脚本**
- 删除 `scripts/deploy/sync-we-mp-rss-feeds.sh`
- 更新 `scripts/deploy-staging.sh`：we-mp-rss → we-mp-rss
- 更新 `scripts/deploy/server-pull-and-restart.sh`：we-mp-rss → we-mp-rss

### Phase 2: API 客户端层

**2.1 新建 `src/services/integrations/we-mp-rss-api.ts`**
- 替换 `we-mp-rss-api.ts`
- 接口：`WeMpRssFeed`、`WeMpRssArticle`、`WeMpRssTaskResult`
- 函数（全部需 AK-SK 认证）：
  - `checkHealth(baseUrl, accessKey, secretKey)` → GET `/api/mps?limit=1`
  - `listFeeds(baseUrl, accessKey, secretKey, {limit, offset, kw?, status?})` → GET `/api/mps`
  - `getFeedDetail(baseUrl, accessKey, secretKey, mpId)` → GET `/api/mps/{mpId}`
  - `triggerFeedSync(baseUrl, accessKey, secretKey, mpId, {startPage?, endPage?})` → GET `/api/mps/update/{mpId}`
  - `searchFeeds(baseUrl, accessKey, secretKey, kw)` → GET `/api/mps/search/{kw}`
  - `addFeed(baseUrl, accessKey, secretKey, url)` → POST `/api/mps`
  - `deleteFeed(baseUrl, accessKey, secretKey, mpId)` → DELETE `/api/mps/{mpId}`
  - `listArticles(baseUrl, accessKey, secretKey, {mpId, offset, limit, hasContent?})` → GET `/api/articles`
  - `getArticle(baseUrl, accessKey, secretKey, articleId)` → GET `/api/articles/{articleId}`
  - `refreshArticle(baseUrl, accessKey, secretKey, articleId)` → POST `/api/articles/{articleId}/refresh`
  - `getRefreshTaskStatus(baseUrl, accessKey, secretKey, taskId)` → GET `/api/articles/refresh/tasks/{taskId}`
  - `importArticle(baseUrl, accessKey, secretKey, url)` → POST `/api/mps/featured/article`
  - `getImportTaskStatus(baseUrl, accessKey, secretKey, taskId)` → GET `/api/mps/featured/article/tasks/{taskId}`
- AK-SK 认证：`Authorization: AK-SK {accessKey}:{secretKey}`
- 响应校验：`{code: 0, message: "success", data: {...}}`
- WE_MP_RSS_BASE_URL 未配置时抛错（D15/Q17）

**2.2 新建 `src/services/integrations/we-mp-rss-sqlite.ts`**
- 替换 `we-mp-rss-sqlite.ts`
- 默认路径：`infra/wechat-rss/we-mp-rss/data/db.db`
- 读 feeds 表 + articles 表（含 content、content_html、has_content）（D16）
- 只读约束保持（`readonly: true`）
- 按 mp_id 过滤 + 分页读取（Q4）
- 导出：`checkSqliteDb(path)`, `listFeedsFromSqlite(path)`, `listArticlesFromSqlite(path, mpId, {offset, limit})`

**2.3 新建 `src/services/integrations/wechat-rss.ts`**
- 替换 `we-mp-rss.ts` facade
- 导出 `SyncMode` type（auto|api|sqlite|manual），和所有 we-mp-rss-api 导出
- `listFeedsAuto(baseUrl, accessKey, secretKey, syncMode, dbPath)` → API 优先 → SQLite fallback → 都失败报错
- `listArticlesAuto(baseUrl, accessKey, secretKey, syncMode, dbPath, {mpId, offset, limit})` → 同理

**2.4 删除旧文件**
- 删除 `src/services/integrations/we-mp-rss-api.ts`
- 删除 `src/services/integrations/we-mp-rss-sqlite.ts`
- 删除 `src/services/integrations/we-mp-rss.ts`

### Phase 3: 内容管道重构

**3.1 新建 `WechatArticle` 接口**（替换 `WeRssArticle`）
- 放在 `src/services/collectors/wechat/wechat-article-types.ts`
- 字段：id, title, url, content?, rawHtml?, summary?, publishTime?, accountId?, cover?, hasContent?, fixFailCount?
- 删除 `WeRssClient` 类和 `fetchStandardRssArticles`（D8）
- 删除 `WeRssSource` 接口

**3.2 简化 `weRssNormalizer.ts`**
- 删除 `cleanWechatHtml()` → 新增 `extractPlainText(html)` 段落版（Q10）
- 保留 `detectWechatBlockPage()`
- 3 处 `discoveryChannel: "werss"` → `"wechat-api"`（D7）
- `normalizeWeRssArticle()` 改造：
  - 输入从 `WeRssArticle` 改为 `WechatArticle`
  - `hasContent===0` → 标记 `qualityStatus: "blocked"`
  - `hasContent===1` + `detectWechatBlockPage(fullText)` → 也标记 blocked（Q11）
  - fullText 提取：`extractPlainText(article.content)` 替代 `cleanWechatHtml`
  - rawHtml 直接取 `article.rawHtml`（content_html），不再从 HTML 解析
  - `fixFailCount >= 3` → 标记 blocked + filterReason 提示手动刷新

**3.3 删除 `wechatParser.ts`**（D4）
- 删除 `src/services/collectors/wechat/wechatParser.ts`
- 删除 `scripts/repair-wechat-content.ts`（Q19）

### Phase 4: API 路由迁移

**4.1 路由目录重命名**（D13）
- `src/app/api/integrations/we-mp-rss/` → `src/app/api/integrations/wechat-rss/`
- `src/app/api/settings/integrations/we-mp-rss/` → `src/app/api/settings/integrations/wechat-rss/`
- `src/app/admin/integrations/we-mp-rss/` → `src/app/admin/integrations/wechat-rss/`
- 新建 `src/app/integrations/we-mp-rss/page.tsx` → 301 重定向（Q13）
- 新建 `src/app/admin/integrations/we-mp-rss/page.tsx` → 301 重定向（Q13）
- 采集路由 `src/app/api/collectors/wechat/` 不改名

**4.2 集成路由内部改造**

| 路由 | 变化 |
|------|------|
| `wechat-rss/status/route.ts` | 返回 Q12 确认的新结构（authStatus, contentHealth, akskConfigured）；删 WERSS_BASE_URL 通道；调 we-mp-rss-api |
| `wechat-rss/test/route.ts` | 改调 we-mp-rss-api checkHealth |
| `wechat-rss/preview-sync/route.ts` | listFeedsAuto → wechat-rss；provider "we-mp-rss" → "we-mp-rss" |
| `wechat-rss/sync-sources/route.ts` | provider "we-mp-rss"；toDelete 排除 FEATURED_MP_ID（Q15） |
| `wechat-rss/refresh-source/route.ts` | triggerFeedSync → we-mp-rss-api；加后端 60 秒限流（Q9） |
| `wechat-rss/delete-missing-sources/route.ts` | provider "we-mp-rss" |

**4.3 设置路由改造**
- `wechat-rss/route.ts`：provider "we-mp-rss"；config 增加 accessKey/secretKey
- `wechat-rss/test/route.ts`：改调 we-mp-rss-api

**4.4 采集路由改造**

| 路由 | 变化 |
|------|------|
| `wechat/sync/route.ts` | AsyncTaskType "WECHAT_SYNC"；collectorType "wechat-api"；改调 we-mp-rss API；删 refreshFeed + fetchStandardRssArticles |
| `wechat/sync/preview/route.ts` | 删 WeRssClient；改调 we-mp-rss-api listArticles；limit=100（Q7） |
| `wechat/sync/confirm/route.ts` | 再调一次 API 获取文章（Q8）；collectorType "wechat-api" |
| `wechat/import/route.ts` | 删 parseWechatArticle；改调 importArticle + 轮询 getImportTaskStatus；超时 120s（Q6） |

**4.5 类型系统更新**
- `src/lib/async-task.ts`：`"WEWE_RSS_SYNC"` → `"WECHAT_SYNC"`
- `src/app/admin/page.tsx`：label 映射
- `src/app/admin/tasks/page.tsx`：label 和 SelectItem
- Prisma schema 注释更新（Q14：改注释，数据靠 Phase 6 迁移脚本）

### Phase 5: 前端迁移

**5.1 组件重命名**（D18）
- `WeweRssIntegrationPage.tsx` → `WechatIntegrationPage.tsx`
- API 路径 `/api/integrations/we-mp-rss/` → `/api/integrations/wechat-rss/`
- 配置表单：移除 AUTH_CODE，增加 Access Key / Secret Key 输入
- 状态页：展示 authStatus（Q3）、contentHealth（Q12）
- 文案 "we-mp-rss" → "we-mp-rss"

**5.2 WechatImportDialog 改造**（D11/Q6）
- 保持对话框打开，loading 轮询
- 后端返回 taskId，前端每 3 秒轮询
- 120 秒超时，超时后提示"请在 we-mp-rss 管理界面查看结果"

**5.3 SubscriptionsPage 更新**
- provider badge：`"we-mp-rss"` → `"we-mp-rss"`；`"werss-external"` badge 删除（D12）
- "同步 WeWe" 按钮文案更新
- API 路径更新

**5.4 AdminShell 侧边栏**（D19）
- `{ name: "微信集成", href: "/admin/integrations/wechat-rss", icon: Rss }`

**5.5 Settings 页面**
- `src/app/settings/integrations/page.tsx`：we-mp-rss → we-mp-rss；增加 AK/SK 输入

**5.6 刷新按钮防抖**（Q9）
- refresh-source 按钮点击后 disabled 30 秒

### Phase 6: 数据迁移脚本 + 文档更新

**6.1 迁移脚本 `scripts/migrate-wewe-to-we-mp-rss.ts`**（D17/Q18）
- `npx tsx scripts/migrate-wewe-to-we-mp-rss.ts --dry-run`（默认）
- `--apply` 执行
- 操作：
  1. Source.provider: `"we-mp-rss"` → `"we-mp-rss"`
  2. Source.provider: `"werss-external"` → 软删除（设 archivedAt）（Q5）
  3. Source.baseUrl: `{old}:4000/feeds/{id}.rss` → `{new}:8001`
  4. ContentItem.discoveryChannel: `"werss"` → `"wechat-api"`
  5. AsyncTask.type: `"WEWE_RSS_SYNC"` → `"WECHAT_SYNC"`
  6. UserIntegration.provider: `"we-mp-rss"` → `"we-mp-rss"`，config 增加 accessKey/secretKey
  7. CollectorRun.collectorType: `"werss"` → `"wechat-api"`
- 输出：各表更新计数 + werss-external 软删除数 + blocked 文章待刷新提示

**6.2 CLAUDE.md 更新**
- we-mp-rss → we-mp-rss
- 删"外部 WeRSS fallback 必须保留"
- provider 注释更新

### Phase 7: 清理 + 新测试

**7.1 删除旧文件**
- `src/services/integrations/we-mp-rss-api.ts`
- `src/services/integrations/we-mp-rss-sqlite.ts`
- `src/services/integrations/we-mp-rss.ts`
- `src/services/collectors/wechat/weRssClient.ts`
- `src/services/collectors/wechat/wechatParser.ts`
- `scripts/repair-wechat-content.ts`
- `scripts/deploy/sync-we-mp-rss-feeds.sh`
- `infra/wechat-rss/we-mp-rss/` 目录

**7.2 删除旧测试 + 写新测试**

旧测试全部删除：
- `src/services/integrations/__tests__/we-mp-rss.test.ts`
- `src/services/integrations/__tests__/we-mp-rss-sqlite.test.ts`
- `src/services/collectors/wechat/__tests__/wechatParser.test.ts`
- `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`（保留 detectWechatBlockPage 测例）
- `src/app/api/settings/integrations/we-mp-rss/__tests__/route.test.ts`
- `src/app/api/settings/integrations/we-mp-rss/test/__tests__/route.test.ts`
- `src/app/api/collectors/wechat/import/__tests__/route.test.ts`
- `tests/e2e/we-mp-rss.spec.ts`
- `e2e/we-mp-rss.spec.ts`

新测试：
- `src/services/integrations/__tests__/we-mp-rss-api.test.ts`
- `src/services/integrations/__tests__/we-mp-rss-sqlite.test.ts`
- `src/services/integrations/__tests__/wechat-rss.test.ts`
- `src/services/collectors/wechat/__tests__/weRssNormalizer.test.ts`（重写：extractPlainText, detectWechatBlockPage, normalizeWeRssArticle）
- `src/app/api/integrations/wechat-rss/__tests__/`
- `src/app/api/collectors/wechat/import/__tests__/route.test.ts`

### Phase 8: Playwright 验收

**关键页面**：
- `/admin/integrations/wechat-rss` — 微信集成页：状态检查、AK/SK 配置、authStatus 显示、同步来源、预览同步、删除来源
- `/subscriptions` — 订阅列表：provider badge 显示 "we-mp-rss"
- `/sources` — 来源管理：provider 过滤
- `/articles/[id]` — 文章详情：fullText 正常显示
- `/admin/integrations/we-mp-rss` — 301 重定向生效（Q13）

**E2E 测例**：
- 页面加载无 console 错误
- 集成页：配置表单有 Access Key / Secret Key 输入
- 集成页：连接测试按钮（we-mp-rss 不可达时友好提示）
- 集成页：authStatus 显示（Q3）
- 订阅页：provider badge 正确
- 手动导入：粘贴 URL → loading 轮询 → 成功/超时提示
- 同步流程：触发同步 → 任务创建 → 轮询结果
- 刷新按钮：disabled 30 秒防抖（Q9）
- 旧路由：`/admin/integrations/we-mp-rss` 301 重定向

## 验证计划

```bash
# 每 Phase 完成后
pnpm lint && pnpm build

# 全部完成后
pnpm test
pnpm exec playwright test

# 浏览器手动验收
# /admin/integrations/wechat-rss
# /subscriptions
# /sources
# /articles/[id]
# /admin/integrations/we-mp-rss (验证 301 重定向)
```

## 关键文件清单

| Phase | 操作 | 关键文件 |
|-------|------|---------|
| P1 | 删/新建 | `infra/wechat-rss/we-mp-rss/`, `infra/wechat-rss/we-mp-rss/docker-compose.yml`, `docker-compose.yml`, `docker-compose.staging.yml`, `.env.example`, `.env.staging.example` |
| P2 | 新建/删 | `src/services/integrations/we-mp-rss-api.ts`, `we-mp-rss-sqlite.ts`, `wechat-rss.ts`; 删 `we-mp-rss-api.ts`, `we-mp-rss-sqlite.ts`, `we-mp-rss.ts` |
| P3 | 改/删/新建 | `weRssNormalizer.ts`（改 discoveryChannel, 删 cleanWechatHtml, 加 extractPlainText）; 新建 `wechat-article-types.ts`; 删 `wechatParser.ts`, `weRssClient.ts`, `repair-wechat-content.ts` |
| P4 | 改/移/新建 | 移 `api/integrations/we-mp-rss/` → `wechat-rss/`; 改 `settings/integrations/we-mp-rss/` → `wechat-rss/`; 改 `wechat/sync/` 路由; 改 `async-task.ts`, `admin/page.tsx`, `admin/tasks/page.tsx`; 新建重定向页 |
| P5 | 改/移 | `WeweRssIntegrationPage.tsx` → `WechatIntegrationPage.tsx`; `WechatImportDialog.tsx`; `SubscriptionsPage.tsx`; `AdminShell.tsx`; `settings/integrations/page.tsx` |
| P6 | 新建/改 | `scripts/migrate-wewe-to-we-mp-rss.ts`; 改 `CLAUDE.md` |
| P7 | 删/新建 | 旧测试; 新测试文件 |
| P8 | 新建 | Playwright E2E 测例 |

## 交接文档

> ⚠️ 此文档专供 session 切换时使用。当本次 session 因上下文溢出或其他原因终止时，下一个 session 读此文档即可无缝继续。

### 快速恢复指南

**1. 读哪里？**
- 需求文档：`docs/superpowers/specs/2026-06-16-we-mp-rss-migration-design.md`（38 项决策 + API 端点 + 字段映射 + 关键常量）
- 实施文档：`docs/superpowers/plans/2026-06-16-we-mp-rss-migration.md`（本文件，8 Phase 计划）
- Plan 文件：`~/.claude/plans/a-dry-run-frolicking-wand.md`（含本交接文档的完整版）

**2. 做到哪里了？**
- 查看 TaskList（`/tasks` 命令）获取最新进度
- Task #9-#41 共 33 个精细任务已创建，含完整依赖关系
- Phase 1 (P1.1-P1.6) 为入口任务，无阻塞，可立即开始
- 每个 Phase 完成后必须 `pnpm lint && pnpm build`

**3. 从哪里继续？**
- 找到 TaskList 中 status=pending 且 blockedBy 为空的任务
- 按 Task ID 顺序执行（ID 小的优先）
- 每完成一个 Task，更新其状态为 completed，并检查是否有新任务解除阻塞

**4. 不能做什么？**
- 见下方「关键约束」6 条
- 不要跳 Phase 执行（依赖关系是严格的）
- 不要在 Phase 6 之前跑迁移脚本的 `--apply`
- 不要删除旧文件直到 Phase 7 明确要求

### 关键约束
1. **不硬编码 localhost** — WE_MP_RSS_BASE_URL 必须配置，运行时校验（D15/Q17）
2. **AK-SK 认证** — `Authorization: AK-SK {accessKey}:{secretKey}`（Q2）
3. **werss-external 软删除** — 设 archivedAt，不删文章（Q5）
4. **FEATURED_MP_ID 保护** — `"MP_WXS_FEATURED_ARTICLES"` 排除 from toDelete（Q15）
5. **只读 SQLite** — 禁止写入 we-mp-rss.db
6. **we-mp-rss 不嵌入本项目** — 通过 API/SQLite fallback 消费数据

### 关键常量速查
| 常量 | 值 | 用途 |
|------|----|------|
| SYNC_ARTICLE_LIMIT | 100 | 每次同步最多拉取文章数（Q7） |
| IMPORT_POLL_TIMEOUT | 120000 | 手动导入轮询超时 ms（Q6） |
| IMPORT_POLL_INTERVAL | 3000 | 轮询间隔 ms |
| REFRESH_DEBOUNCE_MS | 30000 | 前端刷新防抖（Q9） |
| REFRESH_RATE_LIMIT_S | 60 | 后端同来源刷新限流秒数（Q9） |
| FEATURED_MP_ID | "MP_WXS_FEATURED_ARTICLES" | 精选文章虚拟公众号 ID（Q15） |
| AUTH_EXPIRED_RATIO | 0.5 | content missing 比例超此值则标记授权过期（Q3） |

### Task ID 与 Phase 映射速查
| Phase | Task IDs | 说明 |
|-------|----------|------|
| P1 | #9-#14 | 基础设施层（无阻塞，入口任务） |
| P2 | #15-#18 | API 客户端层 |
| P3 | #19-#21 | 内容管道重构 |
| P4 | #22-#30 | API 路由迁移 |
| P5 | #31-#35 | 前端迁移 |
| P6 | #36-#37 | 数据迁移脚本 + 文档 |
| P7 | #38-#40 | 清理 + 新测试 |
| P8 | #41 | Playwright E2E |
