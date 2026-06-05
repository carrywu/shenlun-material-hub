# shenlun-material-hub 代码库概览

> 生成时间：2026-06-05 | 分支：feat/production-hardening

## 项目定位

**申论素材采集台** — 中国公务员考试申论素材的采集、AI 评估和素材卡生成系统。

| 层面 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router, Turbopack) |
| ORM | Prisma 7 + libsql adapter |
| 数据库 | SQLite（dev: `prisma/dev.db`） |
| 前端 | React 19 + Tailwind CSS 4 + shadcn/ui + Lucide 图标 |
| AI | OpenAI 兼容 API（可配置 baseUrl / model） |
| 测试 | Vitest 4（单元/集成）+ Playwright（E2E） |
| 包管理 | pnpm |

---

## 顶层目录结构

```
.
├── src/                      # 应用源码
│   ├── proxy.ts              # Next.js 16 全局认证代理（替代 middleware）
│   ├── app/                  # 页面路由 + API 路由（App Router）
│   ├── components/           # React 组件
│   ├── lib/                  # 共享工具库（auth, db, crypto, logger...）
│   ├── services/             # 核心业务逻辑（采集器、AI、集成）
│   ├── scripts/              # 种子脚本
│   ├── test/                 # 测试 setup
│   └── types/                # 共享 TypeScript 类型
├── prisma/
│   ├── schema.prisma         # 数据库 schema（11 个模型）
│   ├── migrations/           # 3 个迁移文件
│   └── dev.db                # SQLite 开发数据库
├── config/                   # 服务器配置（端口、hostname）
├── scripts/                  # 工具脚本（迁移、修复、截图）
├── e2e/                      # Playwright E2E 测试（5 个 spec）
├── docs/                     # 项目文档
├── infra/                    # 基础设施配置
├── public/                   # 静态资源
└── docker-compose.yml        # Docker 部署配置
```

---

## 核心数据流（端到端）

```
┌─────────────────────────────────────────────────────┐
│  来源发现                                             │
│  网站爬虫 │ 微信公众号 (WeWe RSS) │ MediaCrawler      │
│  (人民日报等)                        (小红书 / B站)    │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  5 阶段内容过滤器                                     │
│  URL 模式 → 标题模式 → 文本长度 → 导航页检测 → 重复   │
└──────────────────────┬──────────────────────────────┘
                       ▼
              ContentItem（candidate / filtered）
                       ▼
┌─────────────────────────────────────────────────────┐
│  AI 相关性评估（异步任务）                              │
│  4 维度：素材密度 / 分析深度 / 话题相关性 / 时效权威    │
│  → accept / reject + 7 种内容体裁分类                  │
└──────────────────────┬──────────────────────────────┘
                       ▼ （仅 accepted）
┌─────────────────────────────────────────────────────┐
│  素材卡生成（异步任务）                                 │
│  9 种卡类型，各有专用 AI prompt                         │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  用户审核 → 确认 → IMA 知识库同步                       │
└─────────────────────────────────────────────────────┘
```

---

## 三大采集通道

### 1. 网站爬虫（政府/官方网站）

**文件**：`src/services/collectors/web/`

| 采集器 | 目标网站 |
|---|---|
| `peoplesDaily.ts` | 人民日报 |
| `peopleOpinion.ts` | 人民网观点 |
| `xianfengwenhui.ts` | 先锋文汇（Discuz 论坛） |
| `guangdongOfficial.ts` | 广东省政府网 |
| `hunanOfficial.ts` | 湖南省政府网 |

**架构**：抽象基类 `BaseCollector`（`base.ts`）→ 每个采集器继承并重写 `extractArticleDetail()`。`registry.ts` 按名称/类型映射。

**采集模式**：
- **HTML 列表页爬取**：抓列表页 → 提取文章链接 → 逐个抓详情页
- **RSS 订阅**：URL 以 `.xml` 结尾或 `urlPattern === 'rss'` 时自动切换

**关键方法**：
- `normalizeToContentItem()` — URL 去重 + 内容 hash + 质量门控（< 300 字符直接过滤）
- `runContentFilters()` — 5 阶段过滤管线

### 2. 微信公众号（WeWe RSS）

**文件**：`src/services/collectors/wechat/` + `src/services/integrations/`

```
WeWe RSS (sidecar 服务)
    ↓ API 优先 / SQLite 只读 fallback
wewe-rss.ts（编排层）
    ↓
weRssClient.ts → weRssNormalizer.ts → ContentItem
```

**三种操作模式**：
- **来源同步**（`POST /api/integrations/wewe-rss/sync-sources`）：upsert feeds 到 Source 表
- **文章同步**（`POST /api/collectors/wechat/sync`）：拉取最新文章
- **手动导入**（`POST /api/collectors/wechat/import`）：mp.weixin.qq.com URL 列表

**HTML 清洗**（`wechatParser.ts`）：提取 `#js_content` → 去除 script/style/iframe/svg → 输出 `fullText` + `rawHtml`

### 3. MediaCrawler（小红书 / B站）

**文件**：`src/services/collectors/mediacrawler/`

| 文件 | 功能 |
|---|---|
| `client.ts` | Python sidecar HTTP 客户端 |
| `bilibili.ts` | B 站采集（文章 + 视频） |
| `xiaohongshu.ts` | 小红书采集（笔记） |
| `tracer.ts` | 原文链接追踪（正则匹配"原文链接"等） |

**流程**：触发爬虫 → 轮询状态（指数退避，最多 60 次）→ 去重 → 入库

---

## AI 处理管线

### 配置解析优先级

```
数据库 AiConfig（加密存储） > 环境变量（AI_API_KEY / OPENAI_API_KEY）
```

API Key 使用 AES-256-CBC 加密存储在数据库中（`src/lib/crypto.ts`）。

### 核心功能

| 功能 | API | 说明 |
|---|---|---|
| **相关性评估** | `POST /api/content-items/assess` | 4 维度评分，accept/reject + 7 种体裁分类 |
| **5 维评分（旧版）** | `POST /api/content-items/[id]/score` | 相关性 0.25 + 质量 0.25 + 时效 0.15 + 独特 0.15 + 实用 0.20 |
| **素材卡生成** | `POST /api/content-items/[id]/generate-card` | 9 种卡类型，各有专用 prompt |
| **AI 批注** | 自动 / 手动 | 选中文本批注 + 自动关键段落批注 |

### 9 种素材卡类型

| 卡类型 | 说明 |
|---|---|
| `golden_sentence` | 金句提取（3-8 句，含修辞分析） |
| `standard_expression` | 规范表达（5-15 个政府标准表述） |
| `case_material` | 案例素材（主体-行为-效果-启示结构） |
| `countermeasure` | 对策建议（按维度分类的制度/机制/技术措施） |
| `problem_statement` | 问题表述（表层/机制/根因分层） |
| `reason_analysis` | 原因分析（主客观/直接根因分类） |
| `policy_expression` | 政策表述（中央/省级/地方分级） |
| `person_story` | 人物故事（身份-事迹-品质-语录结构） |
| `article_structure` | 文章结构（标题模式/开头/过渡/分论点/结尾） |

### Prompt 模板系统

12 个可自定义 prompt key，存储在 `AiPromptTemplate` 表中。`getPromptTemplate()` 先查数据库，fallback 到硬编码默认值。`renderPromptTemplate()` 支持 `{{variable}}` 占位符替换。

---

## 数据库模型

**Schema 文件**：`prisma/schema.prisma`（11 个模型，3 个迁移）

### 模型关系图

```
User ──1:N──→ Session           [userId, cascade delete]
User ──1:N──→ ContentItem       [ownerUserId]
User ──1:N──→ MaterialCard      [ownerUserId]
User ──1:N──→ AsyncTask         [userId]
User ──1:N──→ SyncRecord        [userId]
User ──1:N──→ ArticleAnnotation  [userId]

Source ──1:N──→ ContentItem       [sourceId, cascade delete]
Source ──1:N──→ CollectorRun      [sourceId, cascade delete]
Source ──1:N──→ CollectionChannel [sourceId, cascade delete]

ContentItem ──1:N──→ MaterialCard      [contentItemId, cascade delete]
ContentItem ──1:N──→ SyncRecord        [contentItemId, cascade delete]
ContentItem ──1:N──→ ArticleAnnotation [contentItemId, cascade delete]

MaterialCard ──1:N──→ SyncRecord       [materialCardId, cascade delete]
```

### 关键模型说明

| 模型 | 关键字段 | 说明 |
|---|---|---|
| **User** | `username`, `passwordHash`, `role`(ADMIN/VERIFIED_USER/USER), `status` | 支持 bcrypt + 旧版 SHA-256 |
| **Session** | `userId`, `token`(高熵随机), `expiresAt`(24h) | DB session + 旧版 JWT 兼容 |
| **Source** | `name`, `platform`, `provider`(wewe-rss), `sourceGrade`(A-F), 质量指标 | 含 WeWe RSS 集成字段 |
| **CollectionChannel** | `sourceId`, `listUrl`, `urlPattern`, `paginationPattern`, `maxPages` | 来源下的分栏采集配置 |
| **ContentItem** | ~40 个字段，覆盖完整生命周期 | discovery → filtering → AI assessment → card generation |
| **MaterialCard** | `cardType`(9 种), `markdownContent`, `userEditedContent`, `confirmed` | 需用户确认后才能同步 IMA |
| **AiConfig** | `encryptedKey`, `baseUrl`, `model`, `temperature` | AES-256-CBC 加密存储 |
| **AiPromptTemplate** | `key`, `content`, `version`, `enabled` | 可自定义 AI prompt |
| **AsyncTask** | `type`(4 种), `status`, `params`(JSON), `result`(JSON) | 异步后台任务队列 |
| **CollectorRun** | `discoveredCount`, `importedCount`, `errorSummary` | 每次采集运行的审计记录 |
| **SystemLog** | `level`, `category`, `message`, `detail` | 双写日志（console + DB） |

---

## 异步任务系统

**文件**：`src/lib/async-task.ts`

```
创建 AsyncTask (PENDING)
    ↓ enqueueAsyncTask()
内存队列 [Symbol.for 全局单例]
    ↓ drainTaskQueue()
并发执行（ASYNC_TASK_CONCURRENCY，默认 2，最大 8）
    ↓
标记 RUNNING → 执行 handler → COMPLETED / FAILED
```

**4 种任务类型**：

| 类型 | 说明 |
|---|---|
| `WEWE_RSS_SYNC` | WeWe RSS 文章同步 |
| `WEB_CRAWL` | 网站爬虫采集 |
| `AI_ASSESS` | AI 相关性评估 |
| `CARD_GENERATE` | 素材卡生成 |

**客户端轮询**：`waitForAdminTask()` 每 1.5s 轮询 `GET /api/admin/tasks/{id}`，90s 超时。

---

## 认证与权限

### 认证架构

| 层级 | 文件 | 职责 |
|---|---|---|
| 全局代理 | `src/proxy.ts` | 所有页面需认证，未登录重定向到 `/admin/login` |
| Auth 工具 | `src/lib/auth.ts` | 密码 hash、session CRUD、角色检查 |
| 数据隔离 | `src/lib/data-isolation.ts` | ADMIN 看全部，其他用户看公开 + 自己的 |
| API 守卫 | 各 API route | `requireAuth()` / `requireAdmin()` / `requireVerifiedUser()` |

### 角色体系

| 角色 | 权限 |
|---|---|
| `ADMIN` | 全部功能 + 管理后台 |
| `VERIFIED_USER` | 前台功能 + 部分写操作 |
| `USER` | 基本只读访问 |

---

## 页面一览

### 前台页面（13 个）

| 路由 | 文件 | 功能 |
|---|---|---|
| `/` | `src/app/page.tsx` | 仪表板（统计数据、最近内容、快捷操作） |
| `/discover` | `src/app/discover/page.tsx` | 今日推荐 |
| `/explore` | `src/app/explore/page.tsx` | 探索区 |
| `/articles` | `src/app/articles/page.tsx` | 文章列表（筛选、分页） |
| `/articles/[id]` | `src/app/articles/[id]/page.tsx` | 文章详情（批注、评分、卡片生成） |
| `/cards` | `src/app/cards/page.tsx` | 素材卡列表 |
| `/cards/[id]` | `src/app/cards/[id]/page.tsx` | 素材卡详情（编辑、确认、同步） |
| `/search` | `src/app/search/page.tsx` | 全文检索 |
| `/review` | `src/app/review/page.tsx` | 复习模式 |
| `/settings/ai` | `src/app/settings/ai/page.tsx` | AI 配置 |
| `/subscriptions` | `src/app/subscriptions/page.tsx` | 订阅管理 |
| `/sync-records` | `src/app/sync-records/page.tsx` | 同步记录 |
| `/integrations/wewe-rss` | `src/app/integrations/wewe-rss/page.tsx` | WeWe RSS 集成 |

### 管理后台页面（12 个）

| 路由 | 功能 |
|---|---|
| `/admin` | 管理首页（指标面板） |
| `/admin/login` | 登录页 |
| `/admin/articles` | 文章管理 |
| `/admin/sources` | 来源管理 |
| `/admin/backup` | 备份/恢复 |
| `/admin/clean` | 数据清洗 |
| `/admin/logs` | 系统日志 |
| `/admin/settings/ai` | AI 配置管理 |
| `/admin/integrations/wewe-rss` | WeWe RSS 管理 |
| `/admin/sync-records` | 同步记录 |
| `/admin/tasks` | 异步任务管理 |
| `/admin/users` | 用户管理 |

---

## API 路由（53 个）

### 按功能分组

| 分组 | 数量 | 说明 |
|---|---|---|
| `/api/admin/*` | 10 | 管理后台（指标、备份、清洗、日志、任务、用户） |
| `/api/auth/*` | 4 | 认证（登录、登出、检查、改密码） |
| `/api/content-items/*` | 7 | 内容管理（CRUD、评估、评分、卡片生成） |
| `/api/material-cards/*` | 2 | 素材卡 CRUD |
| `/api/articles/*` | 1 | 文章列表 |
| `/api/collectors/*` | 9 | 采集器（网站、微信、MediaCrawler） |
| `/api/sources/*` | 7 | 来源管理（CRUD、验证、频道、质量） |
| `/api/integrations/*` | 6 | 外部集成（WeWe RSS 状态/测试/同步） |
| `/api/ai-config/*` | 3 | AI 配置（设置、测试、prompt 模板） |
| `/api/annotations/*` | 1 | 批注管理 |
| 其他 | 3 | discover / explore / review / search / export / proxy / sync 等 |

---

## 共享工具库（src/lib/）

| 文件 | 职责 |
|---|---|
| `db.ts` | PrismaClient 单例（libsql adapter，dev 热重载安全） |
| `auth.ts` | 认证全套：bcrypt、session CRUD、JWT 兼容、角色中间件、初始 admin |
| `crypto.ts` | AES-256-CBC 加密/解密（AI API Key 存储） |
| `logger.ts` | 双写日志：console（彩色）+ SystemLog DB 表 |
| `async-task.ts` | 内存任务队列 + DB 持久化 |
| `backup.ts` | 系统备份：gzip 压缩（DB + uploads），支持导出/导入/预览 |
| `data-isolation.ts` | 多用户数据隔离过滤 |
| `content-filter.ts` | 5 阶段内容过滤管线 |
| `rss.ts` | RSS 解析器包装（支持 content:encoded, dc:creator） |
| `display-labels.ts` | 枚举值的中文显示标签映射 |
| `api-error.ts` | 标准化 API 错误处理 |
| `client-admin-task.ts` | 客户端异步任务轮询工具 |
| `utils.ts` | 通用工具（Tailwind `cn` 等） |

---

## 服务层（src/services/）

| 文件 | 职责 |
|---|---|
| `ai.ts` | AI 引擎：配置解析、缓存、评估、评分、卡片生成、批量操作 |
| `ai-annotation.ts` | AI 批注：选中文本批注 + 自动关键段落批注 |
| `content-filter.ts` | 内容质量过滤（5 阶段管线） |
| `ima-sync.ts` | IMA 知识库同步（重试、结构化内容渲染） |
| `source-quality.ts` | 来源质量评分（综合公式 + A-F 分级） |
| `collectors/base.ts` | 采集器抽象基类 |
| `collectors/registry.ts` | 采集器注册表 |
| `collectors/web/*.ts` | 5 个网站采集器 |
| `collectors/wechat/*.ts` | 微信文章解析 + WeRSS 客户端 + 规范化 |
| `collectors/mediacrawler/*.ts` | MediaCrawler 客户端 + 小红书/B站采集 |
| `integrations/wewe-rss.ts` | WeWe RSS 编排层（API + SQLite fallback） |
| `integrations/wewe-rss-api.ts` | WeWe RSS HTTP API 客户端 |
| `integrations/wewe-rss-sqlite.ts` | WeWe RSS SQLite 只读访问层 |

---

## 管理后台功能

| 功能 | API | 说明 |
|---|---|---|
| **指标面板** | `GET /api/admin/metrics` | DB 统计 + 系统资源（内存/CPU/磁盘）+ 最近错误 |
| **备份恢复** | `export` / `import` | gzip 压缩包（DB + uploads），支持预览 |
| **数据清洗** | `POST /api/admin/clean` | 4 条规则：旧过滤数据/重复内容/URL 修复/孤立卡片 |
| **来源质量** | `POST /api/sources/quality` | `composite = hitRate×0.4 + (1-filterRate)×0.2 + aiScore×0.3 + effectiveRate×0.1` |
| **用户管理** | `users` CRUD | 角色分配、状态管理、防止删除最后一个 admin |
| **系统日志** | `GET /api/admin/logs` | 按级别/分类/日期筛选 |

---

## 测试覆盖

### 单元/集成测试（Vitest）

**27 个测试文件，144 个测试用例**

| 分类 | 文件数 | 覆盖范围 |
|---|---|---|
| lib 工具 | 5 | api-error, async-task, backup, display-labels, utils |
| 服务层 | 4 | ai-annotation, ai-prompts, ai-runtime, material-card-generation |
| 采集器 | 5 | base-collector-rss, hunan-collector, wechatParser, weRssClient, weRssNormalizer |
| 集成 | 2 | wewe-rss, wewe-rss-sqlite |
| API 路由 | 10 | admin/metrics, admin/tasks, ai-config, auth/login, articles, wechat/import, wechat/sync, generate-card |
| 组件 | 1 | CollectDialog |

### E2E 测试（Playwright）

| 文件 | 测试内容 |
|---|---|
| `admin-auth.spec.ts` | 管理后台认证流程 |
| `article-detail-content.spec.ts` | 文章详情页内容验证 |
| `articles-filter-remove-column.spec.ts` | 文章列表筛选和列移除 |
| `subscriptions-wewe-rss.spec.ts` | WeWe RSS 订阅管理 |
| `ui-chinese-integrity.spec.ts` | 中文 UI 完整性检查 |

---

## 环境变量

关键环境变量（见 `.env.example`）：

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | SQLite 数据库路径 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始管理员创建 |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | AI 配置（fallback，优先使用数据库配置） |
| `AI_CONFIG_ENCRYPTION_KEY` | AI API Key 加密密钥 |
| `IMA_API_KEY` / `IMA_CLIENT_ID` / `IMA_KNOWLEDGE_BASE_ID` | IMA 知识库集成 |
| `WERSS_BASE_URL` / `WERSS_ACCESS_KEY` / `WERSS_SECRET_KEY` | WeRSS 订阅 |
| `MEDIACRAWLER_BASE_URL` / `MEDIACRAWLER_ENABLED` | MediaCrawler 爬虫 |
| `ASYNC_TASK_CONCURRENCY` | 异步任务并发数（默认 2，最大 8） |

---

## 常用命令

```bash
pnpm dev          # 启动开发服务器（端口 3001）
pnpm build        # 生产构建
pnpm start        # 启动生产服务器
pnpm lint         # ESLint 检查
pnpm test         # Vitest 单元测试
pnpm test:watch   # Vitest 监听模式
pnpm exec playwright test  # Playwright E2E 测试
```
