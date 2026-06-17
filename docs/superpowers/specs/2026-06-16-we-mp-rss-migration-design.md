# we-mp-rss 迁移需求文档

> 日期：2026-06-16
> 状态：需求已确认，待实施

## Context

we-mp-rss（cooderl/we-mp-rss）已于 2026-05-11 归档停更。其 SQLite `articles` 表仅存储元数据，不保存文章内容。内容仅在 RSS feed 请求时按需获取，若被微信风控拦截则内容永久丢失。

迁移目标：切换到 [we-mp-rss](https://github.com/rachelos/we-mp-rss)（rachelos/we-mp-rss），该项目的 `articles` 表包含 `content` 和 `content_html` 列，持久存储文章正文，并有自动补抓机制（`content_auto_check` + `fix_fail_count`）。

**迁移方式**：完全替换 we-mp-rss，不保留回退能力（D1）。

---

## 已确认决策（19 + 19 = 38 项）

### 原始需求决策（D1-D19）

| # | 决策 | 内容 |
|---|------|------|
| D1 | 迁移方式 | 完全替换 we-mp-rss，不保留回退 |
| D2 | 同步策略 | API-First，不再依赖 RSS feed 解析 |
| D3 | HTML 清洗 | we-mp-rss 负责（`clean_html: True`），本项目不做完整清洗 |
| D4 | wechatParser.ts | 移除，手动导入走 we-mp-rss API |
| D5 | 部署方式 | 支持本地和远程两种部署 |
| D6 | Source.baseUrl | 统一存 API base URL，不再存 RSS feed URL |
| D7 | discoveryChannel | 新数据 `"wechat-api"`，历史 `"werss"` 数据迁移脚本更新 |
| D8 | WeRssClient | 全部删除，WeRSS SaaS 已废弃 |
| D9 | AsyncTask type | `"WEWE_RSS_SYNC"` → `"WECHAT_SYNC"` |
| D10 | cleanWechatHtml | 删除，新写 `extractPlainText(html)`，保留 `detectWechatBlockPage` |
| D11 | WechatImportDialog | 保持对话框打开，轮询等待结果 |
| D12 | Source.provider | 只保留 `"we-mp-rss"` 和 `null`（手动） |
| D13 | 前端路由 | `/admin/integrations/wechat-rss`，API 路由 `/api/integrations/wechat-rss/` |
| D14 | UserIntegration.config | 新增 accessKey/secretKey，移除旧 apiKey |
| D15 | WE_MP_RSS_BASE_URL | 去掉硬编码默认值，必须配置 |
| D16 | SQLite fallback | 读 feeds 列表 + 文章内容 |
| D17 | 迁移脚本 | 一个脚本，`--dry-run` / `--apply` |
| D18 | 前端组件 | `WechatIntegrationPage.tsx`（去掉 Rss 后缀） |
| D19 | 侧边栏 | 保持 `name: "微信集成"`，只改 href |

### 需求核对新增决策（Q1-Q19）

| # | 决策 | 内容 |
|---|------|------|
| Q1 | Docker 镜像 | `ghcr.io/rachelos/we-mp-rss:latest`，Playwright 已内置（BROWSER_TYPE=webkit） |
| Q2 | AK-SK 创建 | 在 we-mp-rss 管理界面创建，不硬编码 localhost |
| Q3 | 授权状态检测 | 集成页增加 authStatus 检测，授权过期时显示警告 |
| Q4 | SQLite 文章读取 | 按 mp_id 过滤 + 分页读取，和 API 行为一致 |
| Q5 | werss-external 来源 | 软删除（设 archivedAt），文章保留 |
| Q6 | 手动导入超时 | 120 秒轮询超时 |
| Q7 | 同步文章数量 | 只拉最近 100 篇 |
| Q8 | 同步确认流程 | 确认时再调一次 API 重新获取文章列表 |
| Q9 | refresh-source 限流 | 前端防抖 30 秒 + 后端同来源 60 秒限流 |
| Q10 | extractPlainText | 段落版，按 `<p>`/`<br>`/`<div>` 分段 |
| Q11 | 封禁页检测 | 都检查：`has_content=0` → blocked，`has_content=1` 仍跑 `detectWechatBlockPage` |
| Q12 | 状态检查返回 | 新增 authStatus / contentHealth / akskConfigured，删 weressFallback |
| Q13 | 旧路由兼容 | 301 重定向到新路由 |
| Q14 | Prisma 注释 | Phase 4 改注释，Phase 6 跑迁移脚本更新数据 |
| Q15 | toDelete 保护 | 排除 `MP_WXS_FEATURED_ARTICLES` 来源不被误删 |
| Q16 | 代码命名分层 | 内部 `we-mp-rss-*`，外部 facade `wechat-rss.ts` |
| Q17 | 环境变量校验 | 运行时首次使用校验，不影响构建 |
| Q18 | 迁移脚本执行 | `npx tsx scripts/migrate-wewe-to-we-mp-rss.ts --dry-run`，用 Prisma client |
| Q19 | 旧修复脚本 | 删掉 `repair-wechat-content.ts`，不替代 |

---

## we-mp-rss Docker 配置（Q1 确认）

```yaml
# infra/wechat-rss/we-mp-rss/docker-compose.yml
services:
  we-mp-rss:
    image: ghcr.io/rachelos/we-mp-rss:latest
    container_name: we-mp-rss
    restart: unless-stopped
    ports:
      - "${WE_MP_RSS_PORT:-8001}:8001"
    environment:
      - DB=sqlite:///data/we_mp_rss.db
      - GATHER_CONTENT=True
      - GATHER_CONTENT_AUTO_CHECK=True
      - GATHER_CLEAN_HTML=True
      - GATHER_CONTENT_MODE=web
      - RSS_FULL_CONTEXT=True
      - RSS_ADD_COVER=True
      - RSS_PAGE_SIZE=30
    volumes:
      - ./data:/app/data
```

---

## we-mp-rss API 端点（源码确认）

| 功能 | 方法 | 端点 | 认证 | 备注 |
|------|------|------|------|------|
| 公众号列表 | GET | `/api/mps?limit=&offset=&kw=&status=` | AK-SK | 响应 `{code, message, data: {list, page, total}}` |
| 公众号详情 | GET | `/api/mps/{mp_id}` | AK-SK | |
| 触发同步 | GET | `/api/mps/update/{mp_id}?start_page=&end_page=` | AK-SK | 有频率限制 |
| 搜索公众号 | GET | `/api/mps/search/{kw}` | AK-SK | |
| 添加公众号 | POST | `/api/mps` | AK-SK | |
| 删除公众号 | DELETE | `/api/mps/{mp_id}` | AK-SK | |
| 文章列表 | GET/POST | `/api/articles?mp_id=&offset=&limit=&has_content=` | AK-SK | |
| 文章详情 | GET | `/api/articles/{article_id}` | AK-SK | |
| 刷新文章 | POST | `/api/articles/{article_id}/refresh` | AK-SK | 异步，返回 task_id |
| 刷新任务状态 | GET | `/api/articles/refresh/tasks/{task_id}` | AK-SK | |
| 手动导入文章 | POST | `/api/mps/featured/article` | AK-SK | Body: `{url}`, 异步返回 task_id |
| 导入任务状态 | GET | `/api/mps/featured/article/tasks/{task_id}` | AK-SK | |

### AK-SK 认证格式
```
Authorization: AK-SK {access_key}:{secret_key}
```

### 响应格式（统一）
```json
{ "code": 0, "message": "success", "data": {...} }
```

### 文章字段映射

| we-mp-rss 字段 | WeRssArticle 字段 | 说明 |
|----------------|-------------------|------|
| id | id | |
| title | title | |
| url | url | 永久链接 |
| content | content | 已清洗 HTML |
| content_html | rawHtml (新增) | 原始 HTML |
| description | summary | |
| publish_time | publishTime | 时间戳→ISO |
| mp_id | accountId | |
| pic_url | cover | |
| has_content | hasContent (新增) | 0/1 |
| fix_fail_count | fixFailCount (新增) | |

### SQLite Schema（we-mp-rss）

**feeds 表**: id, mp_name, mp_intro, mp_cover, status, sync_time, update_time, created_at, updated_at, faker_id

**articles 表**: id, mp_id, title, pic_url, url, description, extinfo, status, publish_time, create_time, content, content_html, has_content, fix_fail_count, ...

### 特殊标识
- `FEATURED_MP_ID = "MP_WXS_FEATURED_ARTICLES"` — 手动导入文章的虚拟公众号

---

## 环境变量映射

| 旧变量 | 新变量 | 说明 |
|--------|--------|------|
| WE_MP_RSS_BASE_URL | WE_MP_RSS_BASE_URL | 必须配置，无默认值，运行时校验 |
| WERSS_BASE_URL | 删除 | SaaS 已废弃 |
| WERSS_ACCESS_KEY | WE_MP_RSS_ACCESS_KEY | |
| WERSS_SECRET_KEY | WE_MP_RSS_SECRET_KEY | |
| (新增) | WE_MP_RSS_DB_PATH | SQLite fallback 路径 |

---

## 数据库字段变更汇总

| 表 | 字段 | 旧值 | 新值 |
|----|------|------|------|
| Source | provider | "we-mp-rss" | "we-mp-rss" |
| Source | provider | "werss-external" | 软删除（设 archivedAt） |
| Source | baseUrl | `{old}:4000/feeds/{id}.rss` | `{new}:8001` |
| ContentItem | discoveryChannel | "werss" | "wechat-api" |
| AsyncTask | type | "WEWE_RSS_SYNC" | "WECHAT_SYNC" |
| UserIntegration | provider | "we-mp-rss" | "we-mp-rss" |
| UserIntegration | config | {baseUrl, dbPath, syncMode} | {baseUrl, dbPath, accessKey, secretKey, syncMode} |
| CollectorRun | collectorType | "werss" | "wechat-api" |

---

## 集成页状态检查返回结构（Q12 确认）

```json
{
  "success": true,
  "baseUrl": "http://xxx:8001",
  "reachable": true,
  "feedCount": 5,
  "authStatus": "valid | expired | unknown",
  "contentHealth": {
    "totalArticles": 100,
    "missingContent": 5,
    "ratio": 0.05
  },
  "akskConfigured": true,
  "dbPath": "infra/wechat-rss/we-mp-rss/data/db.db",
  "dbReachable": true,
  "channels": { "api": true, "sqlite": true },
  "message": ""
}
```

- `authStatus` 判断：调 `/api/mps?limit=1`，成功 → `"valid"`；401/403 → `"expired"`；连接失败 → `"unknown"`
- `contentHealth` 判断：统计最近 100 篇文章中 `has_content=0` 的比例，>50% 则 `authStatus` 降级为 `"expired"`

---

## extractPlainText 实现（Q10 确认）

```typescript
import * as cheerio from 'cheerio';

export function extractPlainText(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);
  $('script, style, head').remove();
  const blocks: string[] = [];
  $('p, div, section, h1, h2, h3, h4, h5, h6, li, blockquote, pre').each((_, el) => {
    const text = $(el).text().trim();
    if (text) blocks.push(text);
  });
  if (blocks.length === 0) {
    return $.root().text().replace(/\n{3,}/g, '\n\n').trim();
  }
  return blocks.join('\n\n');
}
```

---

## 封禁页检测优先级（Q11 确认）

```
has_content === 0 → blocked（内容缺失）
has_content === 1 + detectWechatBlockPage(fullText) → blocked（封禁页伪装）
```

---

## 错误处理与降级

| 场景 | 处理 |
|------|------|
| we-mp-rss API 超时/拒绝连接 | 返回："we-mp-rss 服务不可达，请检查容器状态和端口" |
| AK-SK 认证失败 | 返回："API 认证失败，请检查 Access Key / Secret Key 配置" |
| WE_MP_RSS_BASE_URL 未配置 | 首次使用时报错，拒绝静默回退 localhost |
| 文章 has_content=0 | 标记 qualityStatus: "blocked"，等待自动补抓 |
| fix_fail_count ≥ 3 | 标记 qualityStatus: "blocked"，提示手动刷新 |

### 同步模式
- auto：API 优先 → SQLite fallback → 都失败报错
- api：仅 API
- sqlite：仅 SQLite
- manual：不自动同步

### 本地 vs 远程
- 本地：API + SQLite fallback 都可用
- 远程：仅 API，SQLite fallback 跳过（DB 路径不可达）

---

## 关键常量

| 常量 | 值 | 用途 |
|------|----|------|
| SYNC_ARTICLE_LIMIT | 100 | 每次同步最多拉取文章数（Q7） |
| IMPORT_POLL_TIMEOUT | 120000 | 手动导入轮询超时 ms（Q6） |
| IMPORT_POLL_INTERVAL | 3000 | 轮询间隔 ms |
| REFRESH_DEBOUNCE_MS | 30000 | 前端刷新防抖（Q9） |
| REFRESH_RATE_LIMIT_S | 60 | 后端同来源刷新限流秒数（Q9） |
| FEATURED_MP_ID | "MP_WXS_FEATURED_ARTICLES" | 精选文章虚拟公众号 ID（Q15） |
| AUTH_EXPIRED_RATIO | 0.5 | content missing 比例超此值则标记授权过期（Q3） |
