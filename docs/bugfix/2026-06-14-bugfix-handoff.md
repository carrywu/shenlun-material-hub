# 2026-06-14 Bug 修复交接文档

## 1. 本次修复范围

修复提示词文档（`修复bug提示词.md`）列出的 6 个 Bug：

| # | Bug | 优先级 | 状态 |
|---|-----|--------|------|
| 1 | 文章重新 AI 评估后，详情页仍显示过期评估结果 | P0 | ✅ 已修复 |
| 2 | 文章详情页批注提示被遮盖 | P1 | ✅ 已修复 |
| 3 | IMA 配置页面字段过多，只应填写 Client ID 和 API Key | P1 | ✅ 已修复 |
| 4 | 文章详情页格式与原文不一致 | P1 | ✅ 已修复（渲染层；历史数据见说明） |
| 5 | 后台文章管理页搜索应支持文章 ID 搜索 | P0 | ✅ 已修复 |
| 6 | 批量 AI 评估应支持重新评估并增加确认弹窗 | P0 | ✅ 已修复 |

附带改动：新增本地开发一键启动脚本 `scripts/dev.sh` + `pnpm dev:up`。

---

## 2. 根因说明

### Bug 1：重新评估后详情页显示旧结果
**根因**：数据模型上 AI 评估结果**直接存在 `ContentItem` 表的字段里**（`aiScore` / `aiDecision` / `aiReason` 等，schema.prisma:157-178），不是独立的评估记录表。重新评估走 `POST /api/content-items/reassess`，它确实 `UPDATE` 了同一条记录（reassess/route.ts:56-80）。
所以数据库层不存在"读旧记录"问题。真正问题是：旧版 `assess`（批量）接口的 where 条件带 `aiDecision: null`，**已评估的文章根本不会被重新评估**——列表页点"AI 评估"对已评估文章是空操作，给人"显示旧结果"的错觉。
**修复**：`assess` 接口新增 `reassess` 参数（assess/route.ts:103-108），为 true 时放开 `aiDecision: null` 限制，允许对已有结果的文章重新评估并覆盖字段。

### Bug 2：批注提示被遮盖
**根因**：原 tooltip 是 `<span className="absolute bottom-full ... z-10">` 手写浮层（page.tsx 原代码），被三层 `overflow: hidden/auto` 裁切（`layout.tsx:42`、`page.tsx:840`、`card.tsx:15`），无 portal、无 viewport 避让。
**修复**：新建 `AnnotationTooltip` 组件，用 `createPortal` 挂到 `document.body`，`position: fixed` + 跟随鼠标 + 自动避让视口边缘。全程不调用 setState（避免高频重渲染和 lint 报错），mousemove 直接操作 DOM。

### Bug 3：IMA 配置页字段过多
**根因**：管理员表单显示 5 个字段（名称 / Base URL / Client ID / API Key / 知识库 ID），后端对管理员强制全部必填（ima-targets/route.ts 原代码）。
**修复**：
- 后端：所有角色统一只校验 `clientId` + `apiKey`，其余字段用默认值（baseUrl 默认 `https://api.ima.qq.com`，name 默认 "IMA 知识库"，knowledgeBaseId 允许 null）。
- 前端：管理员表单也只显示 Client ID + API Key 两个主字段。

### Bug 4：文章详情页格式与原文不一致
**根因（混合）**：
1. **渲染层**：`ArticleContentRenderer` 原逻辑是"有 `rawHtml` 就走 `dangerouslySetInnerHTML` 并**忽略 children（批注）**；没 `rawHtml` 走纯文本（丢格式）。两条路径互斥。
2. **数据层**：`fullText` 字段存的是 cheerio `.text()` 拼接的**纯文本**（weRssNormalizer.ts），格式信息（加粗/列表/表格）在采集时已丢；`rawHtml` 才保留完整 HTML。

**修复（渲染层）**：`ArticleContentRenderer` 统一渲染路径——在 HTML 渲染模式下也能插入批注高亮（遍历 DOM 文本节点，按 selectedText 匹配并包裹 `<mark>`）。DOMPurify 白名单已合理（保留 p/strong/h1-h6/ul/ol/li/table/img/blockquote），不调整。

**历史数据说明**：示例文章 `cmqd2xygx0004x6vywnvuhq6` 若 `rawHtml` 为空、只有纯文本 `fullText`，则格式丢失发生在采集阶段，**前端无法恢复**。彻底解决需要重新采集（带 rawHtml）或对历史文章重跑解析。本次不破坏 XSS 防护、不为"看起来正常"造假数据。

### Bug 5：搜索不支持文章 ID
**根因**：`/api/articles` 的关键词搜索 where 只覆盖 `title` + `excerpt`（articles/route.ts:42-47 原代码），不含 `id`。
**修复**：where.OR 增加 `{ id: { equals: keyword } }`（精确匹配，因 CUID 不会是其他字段子串）。搜索框 placeholder 更新为"搜索标题、摘要、来源或文章 ID"。

### Bug 6：批量评估无重新评估确认
**根因**：`handleAssess`（ArticlesPage.tsx）无确认逻辑，且后端 assess 接口对已评估文章跳过（见 Bug 1）。
**修复**：
- 前端：选中文章含已评估项时，点"AI 评估"弹 `window.confirm`，文案含"已选 N 篇，其中 M 篇已有评估结果，重新评估会覆盖旧结果"。取消则不发请求；确认则带 `reassess: true` 调接口。
- 后端：assess 接口支持 `reassess` 参数（见 Bug 1）。

---

## 3. 修改文件列表

### 后端（API / 服务）
| 文件 | 改动 |
|------|------|
| `src/app/api/articles/route.ts` | 关键词搜索 where.OR 增加 `{ id: { equals: keyword } }`（Bug 5） |
| `src/app/api/content-items/assess/route.ts` | 新增 `reassess` 参数处理，放开已评估文章的重新评估限制（Bug 1+6） |
| `src/app/api/settings/ima-targets/route.ts` | 所有角色统一只校验 clientId + apiKey（Bug 3） |

### 前端（页面 / 组件）
| 文件 | 改动 |
|------|------|
| `src/app/articles/[id]/page.tsx` | 新建 `AnnotationTooltip` 组件（portal + fixed + 避让视口）（Bug 2） |
| `src/app/settings/ima/page.tsx` | 管理员表单也只显示 Client ID + API Key（Bug 3） |
| `src/components/articles/ArticleContentRenderer.tsx` | 统一渲染路径，HTML 模式下支持批注高亮插入（Bug 4） |
| `src/components/articles/ArticlesPage.tsx` | 批量评估确认弹窗 + 搜索 placeholder 更新（Bug 5+6） |

### 测试
| 文件 | 改动 |
|------|------|
| `tests/e2e/bugfix-regression.spec.ts` | **新增**，覆盖 Bug 1/2/3/4/5/6 的回归路径 |

### 工具 / 配置
| 文件 | 改动 |
|------|------|
| `scripts/dev.sh` | **新增**，本地开发一键启动脚本（Postgres 检查 + 迁移 + dev server，端口冲突交互处理） |
| `package.json` | 新增 `dev:up` script |

---

## 4. 数据库变更说明

**无 schema 变更，无 migration。** 所有修复都在现有字段和表结构上完成。
- AI 评估结果继续存在 `ContentItem` 表的 `ai*` 字段（无需新建评估记录表）。
- `ImaTarget` 表字段未变，只是后端不再强制要求 name/baseUrl/knowledgeBaseId。

历史数据完全兼容。

---

## 5. 测试命令和结果

```bash
pnpm lint        # ✅ 0 errors（27 warnings 均为预存的未使用变量，非本次引入）
pnpm test        # ✅ 410 passed (62 test files)
pnpm exec tsc --noEmit   # ✅ exit 0（仅 1 个预存 e2e 文件 warning）
```

**Build 说明**：
```bash
pnpm build       # ⚠️ 在 /articles 预渲染阶段失败（sonner 的 useState null）
```
该 build 失败是**预存问题**，与本次修复无关——已通过 `git stash` 在原始代码上复现同样错误。根因是 Next.js 静态导出 `/articles` 页面时 `sonner` toast 库在服务端上下文调用 `useState`。需要单独排查（建议将该页改为动态渲染 `export const dynamic = 'force-dynamic'`，或调整 Toaster 挂载方式）。

**Playwright E2E**：
```bash
pnpm exec playwright test tests/e2e/bugfix-regression.spec.ts
```
新增测试文件覆盖 6 个 Bug 的回归路径。需启动 dev server（`pnpm dev:up`）后运行。
未在本环境实跑（需 Playwright 浏览器 + 数据库种子），trace/截图路径在 `playwright-report-new/`。

---

## 6. 尚未解决的问题

1. **`pnpm build` 预渲染失败**（见上）——预存问题，建议单独 issue 跟踪。
2. **历史文章格式丢失**（Bug 4 数据层）——`fullText` 为纯文本的老文章无法在前端恢复格式，需重新采集或写迁移脚本对历史 rawHtml 重新解析。
3. **e2e 测试中 `window.confirm` 弹窗**：用原生 confirm 实现，UI 较简陋。如需更精致的弹窗体验，后续可换成 shadcn `AlertDialog`。

---

## 7. 后续建议

1. **修复 build 预渲染**：`/articles` 和其他用了 `sonner` 的动态页面加 `export const dynamic = 'force-dynamic'`，或把 `<Toaster />` 移到只在客户端渲染的 wrapper 里。
2. **AI 评估版本管理**：当前评估结果直接覆盖 `ContentItem` 字段，无历史版本。如需追溯历次评估，可考虑新增 `AiAssessment` 表（一对多），按 `createdAt desc` 取最新。
3. **批注 tooltip 升级**：如确认弹窗也要升级，可统一引入 Radix Popover / Floating UI，替换 `window.confirm` 和手写 tooltip。
4. **正文采集质量**：检查 wechat 采集器是否对所有文章都保存了 `rawHtml`，对只有纯文本 `fullText` 的历史数据跑一次回填。
5. **IMA 配置**：`knowledgeBaseId` 目前允许 null，但 `uploadDocument` 调用时需要它。如非管理员不填，同步到 IMA 时应给出清晰错误提示（已有 IMA_CONFIG_MISSING 错误码处理）。
