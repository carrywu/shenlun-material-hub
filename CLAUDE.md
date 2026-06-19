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

---

## Required Reading（Agent 工作流约束）

> 以下为 harness 工作流规则，与上文 we-mp-rss 边界规则互补。详细契约见 `docs/harness/contract.md`。

编辑代码前，按顺序阅读：

1. `docs/audit/requirements-confirmation.md`
2. `docs/audit/project-assessment.md`
3. `docs/audit/development-plan.md`
4. `docs/audit/development-todolist.md`
5. `docs/audit/development-handoff.md`
6. `docs/testing.md`

不要跳过这些文件。如果某文件缺失，停止并报告，不要猜测。

如果代码或旧文档与 `docs/audit/requirements-confirmation.md` 冲突，**以 requirements-confirmation.md 为准**。

## Work Style

- 编辑前先理解仓库结构。
- 中大型改动前必须输出 TodoList（Problem Summary / Current Behavior / Expected Behavior / Files To Inspect / Planned Changes / Tests To Add / Validation Commands / Risks / Rollback Plan）。
- 只在当前 batch 范围内工作（见 `tasks/harness/`）。
- 优先小而可验证的改动。
- 修根因，不修症状。
- 除非任务明确要求，保留现有行为。
- 除非明确指示，不删除现有功能。
- 不做大范围重构 / 顺手改无关 UI / 顺手改无关 API。
- 不允许把失败测试 skip 掉。
- 不允许用 mock 掩盖真实权限问题。
- 声称验证通过前必须实际运行命令。

## Security and Data Isolation

改动 API / service / Prisma / 同步逻辑时必须核对：

- USER / VERIFIED_USER / ADMIN 权限（见 `docs/harness/contract.md` §2）。
- `ownerUserId` 隔离：MaterialCard / ArticleFavorite / UserContentState / SyncRecord 必须按用户隔离，非 owner 访问返回 404。
- 用户私有状态（阅读 / 收藏 / 忽略 / 复习）不得写到全局 `ContentItem.read / bookmarked / ignored`。
- IMA 同步范围 = 当前用户自己可见的文章 + 自己的素材卡；排除 `archivedAt != null`。
- 个人 AI / IMA 禁止 fallback 到 env 配置；缺配置时禁止操作并提示去配置。
- service 层必须复核 owner，不要只靠 route 层。
- secret（密码 / API key / IMA key / cookie / Authorization）在日志与审计数据中必须脱敏。
- 破坏性操作必须有 dry-run / 预览 / 二次确认。

## Validation

标准验证（harness 封装，见 `docs/harness/validation-matrix.md`）：

```bash
pnpm harness:preflight      # 只读预检
pnpm harness:validate       # standard: lint + test + build
pnpm harness:validate:e2e   # e2e: standard + playwright 全量
pnpm harness:validate:db    # db: db:generate + db:setup:dry + standard
```

底层命令：

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

UI / auth / RBAC / owner 隔离改动必须按影响范围运行相关 Playwright spec（spec 映射见 `docs/harness/validation-matrix.md` §3.2）。AI prompt 行为：`pnpm test:ai`。

## Completion Definition

任务完成当且仅当：

- 验收标准已逐项检查。
- 测试已运行或显式写明 Not-tested 原因。
- 失败测试含文件 / spec 名与下一步动作。
- 已检查 `git status --short` 与 `git diff --stat`。
- `docs/audit/development-todolist.md` 已更新。
- `docs/audit/development-handoff.md` 已更新。
