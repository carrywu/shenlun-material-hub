# shenlun-material-hub Project Rules

> 通用开发规范见全局规则（~/.claude/CLAUDE.md）。本文件只记录当前项目特有约束。

## Project Context

申论素材采集与 AI 素材卡生成系统。

技术栈：Next.js 16 + Prisma 7 + PostgreSQL + React 19 + Tailwind CSS + Vitest + Playwright

核心模块：
- 网站采集（人民日报、先锋文汇等）
- 公众号 RSS 订阅（we-mp-rss sidecar）
- 来源管理
- 文章入库与去重
- 文章详情页
- AI 评分
- 素材卡生成
- 未来 IMA 导出

## we-mp-rss Boundary

- we-mp-rss 是本地 sidecar 服务（Python + FastAPI + SQLite），不嵌入本项目。
- 本项目通过 AK-SK 认证 API / 只读 SQLite fallback 消费 we-mp-rss 数据。
- 不得将 we-mp-rss 源码合并进本项目。
- 不得实现微信逆向工程。
- 不得绕过登录、验证码或风控系统。

## we-mp-rss Sync Rules

- 来源同步优先使用 AK-SK 认证 API（GET /api/mps）。
- API 不可用时使用只读 SQLite fallback（`readonly: true`）。
- 禁止写入 `we_mp_rss.db`。
- 手动来源必须保留。
- 只有 `provider=we-mp-rss` 的来源在同步时可被删除。
- we-mp-rss 删除来源时，前端必须二次确认。
- 默认删除只删来源，不删已导入文章。
- 手动导入文章 URL 支持必须保留。
- FEATURED_MP_ID（`MP_WXS_FEATURED_ARTICLES`）不可被同步删除。

## WeChat Article Content Rules

- 优先消费 we-mp-rss 已处理的 content / content_html 字段。
- `fullText` 必须是干净可读文本（`extractPlainText(content)`）。
- `rawHtml` 可存原始 HTML（content_html），但不得作为正文展示。
- `summary` 不得来自 HTML head / doctype。
- `wordCount` 必须从清洗后文本计算。
- `hasContent===0` 或 `hasContent===1 + detectWechatBlockPage(fullText)` → 标记 `qualityStatus: "blocked"`。
- `fixFailCount>=3` → 标记 blocked + filterReason 提示手动刷新。

## Critical Pages

浏览器验收必须覆盖：

- `/admin/integrations/wechat-rss` — we-mp-rss 集成页
- `/subscriptions` — 订阅列表页
- `/articles/[id]` — 文章详情页
- `/materials` — 素材卡页面
- `/sources` — 来源管理页

## Required Validation

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

## Sensitive Files — Never Commit

```
.env
*.db
*.sqlite
*.sqlite3
prisma/*.db
test-results/
playwright-report/
```

## Do Not Do

- 不写微信逆向爬虫
- 不绕过登录/验证码/风控
- 不硬编码 Cookie / Token / AUTH_CODE / API Key
- 不删除手动 RSS URL 支持
- 修爬虫 bug 时不顺手重写无关 UI
- 不在无 dry-run 的情况下执行破坏性数据库脚本
- WE_MP_RSS_BASE_URL 必须配置，运行时校验，不硬编码 localhost
