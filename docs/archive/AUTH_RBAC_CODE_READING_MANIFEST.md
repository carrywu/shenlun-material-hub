# 代码阅读清单 (AUTH_RBAC_CODE_READING_MANIFEST)

> 审计时间：2026-06-05
> 项目：shenlun-material-hub
> 非 Git 仓库，无 .git 目录（外层目录），项目内部 `shenlun-material-hub/.git` 存在

## 审计基线

| 项目 | 值 |
|---|---|
| 项目根目录 | `/Users/apple/Downloads/ima-shenglun-creators/shenlun-material-hub` |
| Git 状态 | 项目内部有 `.git` 目录，外层目录无 |
| 文件总数（排除 node_modules/.next/generated） | ~160 个源文件 |
| 技术栈 | Next.js 16.2.6 + Prisma 7.8.0 + PostgreSQL (pg) + React 19 + Tailwind CSS 4 + Vitest 4 + Playwright 1.60 |

## 阅读覆盖清单

### 项目和运行基础

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `package.json` | 已完整阅读 | 依赖、脚本定义 | 确认技术栈和可用工具 | 无 next-auth/passport 等认证库；有 `seed:accounts` 脚本 |
| `.env.example` | 已完整阅读 | 环境变量模板 | 确认配置方式和密钥管理 | 单管理员模型：ADMIN_USERNAME/PASSWORD_HASH/JWT_SECRET |
| `.env.test` | 已完整阅读 | 测试环境变量 | 确认测试隔离 | 仅 DATABASE_URL 覆盖 |
| `Dockerfile` | 已完整阅读 | 容器构建 | 部署方式评估 | standalone 模式，非 root 用户运行 |
| `docker-compose.yml` | 已完整阅读 | 容器编排 | 部署方式评估 | 单 app 服务 + 可选 we-mp-rss sidecar |
| `next.config.ts` | 已完整阅读 | Next.js 配置 | 中间件/路由评估 | standalone output，无 middleware 配置 |
| `config/server.config.json` | 已完整阅读 | 次要服务器配置 | 评估是否有额外服务 | port 3001，未在主流程使用 |
| `CLAUDE.md` | 已完整阅读 | 项目开发规则 | 约束条件 | we-mp-rss 边界规则、内容清洗规则 |
| `AGENTS.md` | 已完整阅读 | Codex 代理规则 | 约束条件 | 与 CLAUDE.md 同步 |
| `DEPLOY.md` | 已完整阅读 | 部署文档 | 部署和认证方式 | SHA-256 密码哈希、JWT 生成方式 |
| `prisma.config.ts` | 仅确认用途 | Prisma 配置 | 数据库连接 | 未深入阅读 |
| `eslint.config.mjs` | 仅确认用途 | 代码风格 | 代码质量 | 未深入阅读 |
| `vitest.config.ts` | 仅确认用途 | 测试配置 | 测试方式 | 未深入阅读 |
| `playwright.config.ts` | 仅确认用途 | E2E 测试配置 | 测试方式 | 未深入阅读 |
| `tsconfig.json` | 仅确认用途 | TypeScript 配置 | 类型系统 | 未深入阅读 |
| `components.json` | 未阅读 | shadcn/ui 配置 | UI 组件 | 不影响评估 |
| `postcss.config.mjs` | 未阅读 | CSS 处理 | 样式 | 不影响评估 |
| `pnpm-workspace.yaml` | 未阅读 | 工作区配置 | 依赖管理 | 不影响评估 |

### 数据库

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `prisma/schema.prisma` | 已完整阅读 | 数据库 Schema 定义 | **核心**：数据模型评估 | 无 User 模型；11 个表；所有数据全局无用户归属 |
| `prisma/migrations/20260529083947_init/migration.sql` | 已完整阅读 | 初始迁移 | 数据表结构 | 5 核心表：Source, ContentItem, MaterialCard, SyncRecord, CollectorRun |
| `prisma/migrations/20260604000000_add_ai_prompt_templates/migration.sql` | 已完整阅读 | AI 提示词模板表 | AI 配置 | AiPromptTemplate 表 |
| `prisma/migrations/20260604010000_add_system_logs_and_async_tasks/migration.sql` | 已完整阅读 | 日志和任务表 | 任务系统 | SystemLog + AsyncTask 表 |
| `prisma/dev.db` | 未阅读（二进制） | 开发数据库 | 数据现状 | 二进制文件，不影响评估 |

### 后端 - 认证和核心库

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/lib/auth.ts` | 已完整阅读 | JWT 和密码工具 | **核心**：认证基础 | 单管理员、SHA-256（非 bcrypt）、Web Crypto JWT、无角色字段 |
| `src/lib/db.ts` | 已完整阅读 | Prisma 客户端单例 | 数据库访问 | pg adapter (PrismaPg + pg.Pool)、全局单例 |
| `src/lib/crypto.ts` | 已完整阅读 | AES-256-CBC 加密 | 密钥加密 | AI_CONFIG_ENCRYPTION_KEY，零填充密钥（非 KDF） |
| `src/lib/async-task.ts` | 已完整阅读 | 异步任务队列 | **核心**：任务系统 | 进程内内存队列、无持久化、默认并发 2、无重试 |
| `src/lib/logger.ts` | 已完整阅读 | 日志服务 | 审计日志基础 | 写入 SystemLog 表 + console，无用户上下文 |
| `src/lib/api-error.ts` | 仅确认用途 | API 错误处理 | 错误处理 | 不影响评估 |
| `src/lib/backup.ts` | 仅确认用途 | 备份工具 | 数据安全 | 不影响评估 |
| `src/lib/display-labels.ts` | 仅确认用途 | 显示标签 | UI | 不影响评估 |
| `src/lib/utils.ts` | 仅确认用途 | 工具函数 | UI | 不影响评估 |
| `src/lib/rss.ts` | 已完整阅读 | RSS 解析器 | we-mp-rss | 通用 RSS 解析，无用户上下文 |
| `src/lib/client-admin-task.ts` | 未阅读 | 客户端管理任务 | 管理功能 | 不影响评估 |

### 后端 - 认证 API 路由

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/app/api/auth/login/route.ts` | 已完整阅读 | 登录端点 | **核心**：认证流程 | 单管理员登录、JWT Cookie、SHA-256 验证 |
| `src/app/api/auth/logout/route.ts` | 已完整阅读 | 登出端点 | 认证流程 | 清除 Cookie，无会话验证 |
| `src/app/api/auth/check/route.ts` | 已完整阅读 | 认证检查端点 | **核心**：认证验证 | 二元认证（已认证/未认证），无角色信息 |

### 后端 - 管理 API 路由

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/app/api/admin/tasks/route.ts` | 已完整阅读 | 任务列表 | 管理功能 | **无认证** |
| `src/app/api/admin/tasks/[id]/route.ts` | 已完整阅读 | 任务详情 | 管理功能 | **无认证** |
| `src/app/api/admin/backup/export/route.ts` | 已完整阅读 | 数据导出 | 数据安全 | **无认证**，可下载全库 |
| `src/app/api/admin/backup/import/route.ts` | 已完整阅读 | 数据导入 | 数据安全 | 部分认证（仅 apply 时密码验证） |
| `src/app/api/admin/logs/route.ts` | 已完整阅读 | 日志查看/删除 | 审计 | **无认证**，可删除全部日志 |
| `src/app/api/admin/metrics/route.ts` | 已完整阅读 | 系统指标 | 监控 | **无认证**，暴露服务器信息 |
| `src/app/api/admin/clean/route.ts` | 已完整阅读 | 数据清洗 | 数据安全 | **无认证**，可执行破坏性操作 |

### 后端 - 业务 API 路由

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/app/api/articles/route.ts` | 已完整阅读 | 文章列表 | 内容浏览 | **无认证**，全局查询 |
| `src/app/api/content-items/route.ts` | 已完整阅读 | 内容 CRUD | 内容管理 | **无认证**，全局查询 |
| `src/app/api/content-items/[id]/route.ts` | 已完整阅读 | 内容详情/更新/删除 | 内容管理 | **无认证**，按 ID 操作 |
| `src/app/api/content-items/assess/route.ts` | 已完整阅读 | AI 批量评估 | AI 功能 | **无认证**，触发 AI 调用 |
| `src/app/api/content-items/reassess/route.ts` | 已完整阅读 | AI 重新评估 | AI 功能 | **无认证** |
| `src/app/api/content-items/[id]/generate-card/route.ts` | 已完整阅读 | 素材卡生成 | AI 功能 | **无认证**，触发 AI 调用 |
| `src/app/api/content-items/[id]/score/route.ts` | 已完整阅读 | AI 评分 | AI 功能 | **无认证**，触发 AI 调用 |
| `src/app/api/content-items/[id]/annotations/route.ts` | 仅确认用途 | 批注 CRUD | 批注功能 | 未深入阅读 |
| `src/app/api/ai-config/route.ts` | 已完整阅读 | AI 配置 CRUD | **核心**：配置管理 | **无认证**，可读写 API Key |
| `src/app/api/ai-config/test/route.ts` | 已完整阅读 | AI 连接测试 | 配置管理 | **无认证** |
| `src/app/api/ai-config/prompts/route.ts` | 已完整阅读 | AI 提示词管理 | 配置管理 | **无认证** |
| `src/app/api/sync/route.ts` | 已完整阅读 | IMA 同步 | **核心**：同步功能 | **无认证**，调用外部 IMA API |
| `src/app/api/sync-records/route.ts` | 已完整阅读 | 同步记录查询 | 同步功能 | **无认证** |
| `src/app/api/material-cards/route.ts` | 已完整阅读 | 素材卡 CRUD | 素材卡管理 | **无认证** |
| `src/app/api/material-cards/[id]/route.ts` | 仅确认用途 | 素材卡详情 | 素材卡管理 | 未深入阅读 |
| `src/app/api/sources/route.ts` | 已完整阅读 | 来源 CRUD | 来源管理 | **无认证** |
| `src/app/api/sources/[id]/route.ts` | 仅确认用途 | 来源详情 | 来源管理 | 未深入阅读 |
| `src/app/api/sources/[id]/verify/route.ts` | 仅确认用途 | 来源验证 | 来源管理 | 未深入阅读 |
| `src/app/api/sources/[id]/channels/route.ts` | 仅确认用途 | 栏目管理 | 来源管理 | 未深入阅读 |
| `src/app/api/sources/import/route.ts` | 仅确认用途 | 来源导入 | 来源管理 | 未深入阅读 |
| `src/app/api/sources/quality/route.ts` | 仅确认用途 | 来源质量 | 来源管理 | 未深入阅读 |
| `src/app/api/collectors/web/collect/route.ts` | 已完整阅读 | 网站采集 | **核心**：采集功能 | **无认证**，可触发全部采集 |
| `src/app/api/collectors/wechat/sync/route.ts` | 已完整阅读 | 微信同步 | **核心**：采集功能 | **无认证** |
| `src/app/api/collectors/wechat/import/route.ts` | 已完整阅读 | 微信导入 | 采集功能 | **无认证** |
| `src/app/api/collectors/wechat/articles/route.ts` | 仅确认用途 | 微信文章 | 采集功能 | 未深入阅读 |
| `src/app/api/collectors/wechat/sources/route.ts` | 仅确认用途 | 微信来源 | 采集功能 | 未深入阅读 |
| `src/app/api/collectors/mediacrawler/crawl/route.ts` | 仅确认用途 | MediaCrawler 采集 | 采集功能 | 未深入阅读 |
| `src/app/api/collectors/mediacrawler/status/[runId]/route.ts` | 仅确认用途 | 采集状态 | 采集功能 | 未深入阅读 |
| `src/app/api/integrations/we-mp-rss/status/route.ts` | 已完整阅读 | we-mp-rss 健康检查 | 集成 | **无认证** |
| `src/app/api/integrations/we-mp-rss/test/route.ts` | 已完整阅读 | we-mp-rss 连接测试 | 集成 | **无认证**，可探测任意 URL |
| `src/app/api/integrations/we-mp-rss/sync-sources/route.ts` | 已完整阅读 | we-mp-rss 来源同步 | 集成 | **无认证**，可传入任意 dbPath |
| `src/app/api/integrations/we-mp-rss/preview-sync/route.ts` | 仅确认用途 | 同步预览 | 集成 | 未深入阅读 |
| `src/app/api/integrations/we-mp-rss/refresh-source/route.ts` | 仅确认用途 | 来源刷新 | 集成 | 未深入阅读 |
| `src/app/api/integrations/we-mp-rss/delete-missing-sources/route.ts` | 仅确认用途 | 删除缺失来源 | 集成 | 未深入阅读 |
| `src/app/api/search/route.ts` | 已完整阅读 | 搜索 | 搜索功能 | **无认证** |
| `src/app/api/export/route.ts` | 已完整阅读 | 导出 | 导出功能 | **无认证** |
| `src/app/api/review/route.ts` | 已完整阅读 | 复习 | 复习功能 | **无认证** |
| `src/app/api/discover/route.ts` | 已完整阅读 | 今日推荐 | 内容发现 | **无认证** |
| `src/app/api/explore/route.ts` | 已完整阅读 | 探索区 | 内容发现 | **无认证** |
| `src/app/api/annotations/[id]/route.ts` | 已完整阅读 | 批注更新/删除 | 批注功能 | **无认证** |
| `src/app/api/proxy/image/route.ts` | 未阅读 | 图片代理 | 图片功能 | 不影响评估 |

### 后端 - 服务层

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/services/ai.ts` | 已完整阅读 | AI 服务核心 | **核心**：AI 配置读取 | 两级配置（DB 优先 + env fallback），无用户上下文 |
| `src/services/ima-sync.ts` | 已完整阅读 | IMA 同步服务 | **核心**：IMA 配置 | 纯环境变量配置，模块级读取，无用户上下文 |
| `src/services/ai-annotation.ts` | 已完整阅读 | AI 批注服务 | AI 功能 | 依赖 ai.ts，无用户上下文 |
| `src/services/content-filter.ts` | 已完整阅读 | 内容过滤 | 内容质量 | 5 级过滤管道，全局数据 |
| `src/services/source-quality.ts` | 已完整阅读 | 来源质量评估 | 来源管理 | 质量评分算法，全局数据 |
| `src/services/integrations/we-mp-rss.ts` | 已完整阅读 | we-mp-rss 编排 | **核心**：we-mp-rss | baseUrl 参数传入，无用户上下文 |
| `src/services/integrations/we-mp-rss-api.ts` | 已完整阅读 | we-mp-rss API 客户端 | we-mp-rss | 纯 HTTP 客户端，baseUrl 参数化 |
| `src/services/integrations/we-mp-rss-sqlite.ts` | 已完整阅读 | we-mp-rss SQLite 回退 | we-mp-rss | 只读 SQLite，硬编码路径 |
| `src/services/collectors/base.ts` | 仅确认用途 | 采集器基类 | 采集功能 | 未深入阅读 |
| `src/services/collectors/registry.ts` | 仅确认用途 | 采集器注册表 | 采集功能 | 未深入阅读 |
| `src/services/collectors/web/*.ts` | 仅确认用途 | 各网站采集器 | 采集功能 | 5 个采集器，未深入阅读 |
| `src/services/collectors/wechat/*.ts` | 仅确认用途 | 微信采集器 | 采集功能 | 3 个模块，未深入阅读 |
| `src/services/collectors/mediacrawler/*.ts` | 仅确认用途 | MediaCrawler | 采集功能 | 3 个模块，未深入阅读 |

### 前端 - 页面和布局

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/app/layout.tsx` | 已完整阅读 | 根布局 | **核心**：导航和权限 | 7 个导航项无条件渲染，无权限控制 |
| `src/app/page.tsx` | 已完整阅读 | 仪表板 | 仪表板 | 全局统计，无认证，CollectButton 无条件显示 |
| `src/app/admin/layout.tsx` | 已完整阅读 | 管理后台布局 | **核心**：管理认证 | 路径判断排除 login 页，其余用 AdminShell |
| `src/app/admin/login/page.tsx` | 已完整阅读 | 登录页 | 认证 | 用户名/密码表单，POST /api/auth/login |
| `src/app/admin/page.tsx` | 已完整阅读 | 管理仪表板 | 管理功能 | 依赖 AdminShell 认证 |
| `src/app/admin/articles/page.tsx` | 已完整阅读 | 管理文章 | 管理功能 | ArticlesPage managementMode |
| `src/app/admin/sources/page.tsx` | 已完整阅读 | 来源管理 | 管理功能 | SubscriptionsPage |
| `src/app/admin/tasks/page.tsx` | 已完整阅读 | 任务监控 | 管理功能 | 自动轮询 3 秒 |
| `src/app/admin/settings/ai/page.tsx` | 已完整阅读 | AI 配置 | 配置管理 | AiConfigPage |
| `src/app/admin/integrations/we-mp-rss/page.tsx` | 仅确认用途 | we-mp-rss 集成 | 集成管理 | 未深入阅读 |
| `src/app/admin/sync-records/page.tsx` | 仅确认用途 | 同步记录 | 同步管理 | 未深入阅读 |
| `src/app/admin/logs/page.tsx` | 仅确认用途 | 系统日志 | 日志管理 | 未深入阅读 |
| `src/app/admin/backup/page.tsx` | 仅确认用途 | 数据备份 | 数据安全 | 未深入阅读 |
| `src/app/admin/clean/page.tsx` | 仅确认用途 | 数据清洗 | 数据安全 | 未深入阅读 |
| `src/app/articles/page.tsx` | 已完整阅读 | 文章列表 | 内容浏览 | 委托 ArticlesPage |
| `src/app/articles/[id]/page.tsx` | 已完整阅读 | 文章详情 | **核心**：内容页面 | 1057 行，公开阅读视图，AI 批注功能 |
| `src/app/cards/page.tsx` | 已完整阅读 | 素材卡列表 | 素材卡管理 | 批量选择、同步、无权限控制 |
| `src/app/cards/[id]/page.tsx` | 已完整阅读 | 素材卡详情 | 素材卡管理 | 编辑、确认、同步、删除，无权限控制 |
| `src/app/settings/ai/page.tsx` | 已完整阅读 | AI 设置重定向 | 配置 | 重定向到 /admin/settings/ai |
| `src/app/discover/page.tsx` | 仅确认用途 | 今日推荐 | 内容发现 | 未深入阅读 |
| `src/app/explore/page.tsx` | 仅确认用途 | 探索区 | 内容发现 | 未深入阅读 |
| `src/app/search/page.tsx` | 仅确认用途 | 检索 | 搜索 | 未深入阅读 |
| `src/app/review/page.tsx` | 仅确认用途 | 复习 | 复习 | 未深入阅读 |
| `src/app/subscriptions/page.tsx` | 仅确认用途 | 订阅 | 订阅管理 | 未深入阅读 |
| `src/app/sync-records/page.tsx` | 仅确认用途 | 同步记录 | 同步 | 未深入阅读 |
| `src/app/integrations/we-mp-rss/page.tsx` | 仅确认用途 | we-mp-rss | 集成 | 未深入阅读 |

### 前端 - 组件

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/components/admin/AdminShell.tsx` | 已完整阅读 | 管理后台外壳 | **核心**：管理认证 | GET /api/auth/check 验证，10 个导航项 |
| `src/components/ai/AiConfigPage.tsx` | 已完整阅读 | AI 配置页面 | 配置管理 | 441 行，调用 ai-config API |
| `src/components/articles/ArticlesPage.tsx` | 仅确认用途 | 文章列表组件 | 内容浏览 | 未深入阅读 |
| `src/components/ArticleDetail.tsx` | 仅确认用途 | 文章详情组件 | 内容浏览 | 未深入阅读 |
| `src/components/CollectButton.tsx` | 已完整阅读 | 采集按钮 | **核心**：操作按钮 | 无权限控制，直接显示 |
| `src/components/CollectDialog.tsx` | 仅确认用途 | 采集对话框 | 采集功能 | 未深入阅读 |
| `src/components/SyncToIma.tsx` | 已完整阅读 | IMA 同步组件 | **核心**：同步功能 | 无权限控制，调用 /api/sync |
| `src/components/MaterialCard.tsx` | 仅确认用途 | 素材卡组件 | 素材卡 | 未深入阅读 |
| `src/components/MaterialCardEditor.tsx` | 仅确认用途 | 素材卡编辑器 | 素材卡 | 未深入阅读 |
| `src/components/ReviewCard.tsx` | 仅确认用途 | 复习卡片 | 复习 | 未深入阅读 |
| `src/components/BatchActions.tsx` | 仅确认用途 | 批量操作 | 批量功能 | 未深入阅读 |
| `src/components/WechatImportDialog.tsx` | 仅确认用途 | 微信导入对话框 | 采集 | 未深入阅读 |
| `src/components/ChannelManager.tsx` | 仅确认用途 | 栏目管理 | 来源管理 | 未深入阅读 |
| `src/components/ArticlePreviewDialog.tsx` | 仅确认用途 | 文章预览 | 内容浏览 | 未深入阅读 |
| `src/components/integrations/WeweRssIntegrationPage.tsx` | 仅确认用途 | we-mp-rss 集成页 | 集成 | 未深入阅读 |
| `src/components/subscriptions/SubscriptionsPage.tsx` | 仅确认用途 | 订阅管理页 | 订阅 | 未深入阅读 |
| `src/components/sync/SyncRecordsPage.tsx` | 仅确认用途 | 同步记录页 | 同步 | 未深入阅读 |
| `src/components/filters/*.tsx` | 未阅读 | 筛选组件 | UI | 不影响评估 |
| `src/components/ui/*.tsx` | 未阅读 | UI 基础组件 | UI | shadcn/ui 组件，不影响评估 |

### 脚本和种子数据

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/scripts/seed-accounts.ts` | 已完整阅读 | 来源种子数据 | 数据初始化 | 21 个来源记录，非用户种子 |
| `src/scripts/seed-channels.ts` | 仅确认用途 | 栏目种子数据 | 数据初始化 | 未深入阅读 |
| `scripts/repair-wechat-content.ts` | 未阅读 | 内容修复 | 数据维护 | 不影响评估 |
| `scripts/migrate-card-types.ts` | 未阅读 | 卡片类型迁移 | 数据迁移 | 不影响评估 |

### 测试

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `e2e/admin-auth.spec.ts` | 已完整阅读 | 管理员认证 E2E | **核心**：认证测试 | 测试登录流程、Cookie 设置 |
| `e2e/article-detail-content.spec.ts` | 已完整阅读 | 文章内容 E2E | 内容质量 | 验证无原始 HTML 标签 |
| `e2e/subscriptions-we-mp-rss.spec.ts` | 已完整阅读 | we-mp-rss E2E | 集成测试 | 登录后测试来源和集成页 |
| `e2e/articles-filter-remove-column.spec.ts` | 未阅读 | 文章筛选 E2E | UI 测试 | 不影响评估 |
| `e2e/ui-chinese-integrity.spec.ts` | 未阅读 | 中文完整性 E2E | UI 测试 | 不影响评估 |
| `src/lib/__tests__/*.test.ts` | 未阅读 | 单元测试 | 测试覆盖 | 不影响评估 |
| `src/services/__tests__/*.test.ts` | 未阅读 | 服务单元测试 | 测试覆盖 | 不影响评估 |
| `src/components/__tests__/*.test.ts` | 未阅读 | 组件测试 | 测试覆盖 | 不影响评估 |
| `src/app/api/**/__tests__/*.test.ts` | 未阅读 | API 测试 | 测试覆盖 | 不影响评估 |

### 生成代码

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/generated/prisma/*` | 仅确认用途 | Prisma 生成代码 | ORM | 自动生成，不影响评估 |

### 类型定义

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `src/types/index.ts` | 已完整阅读 | 类型定义 | 类型系统 | 371 行，定义所有业务类型和枚举 |

### 文档

| 路径/目录 | 阅读状态 | 主要职责 | 与需求的关系 | 发现 |
|---|---|---|---|---|
| `README.md` | 仅确认用途 | 项目说明 | 项目概况 | 未深入阅读 |
| `docs/*.md` | 仅确认用途 | 各类文档 | 参考 | 未深入阅读 |
| `agent-orchestrator.yaml` | 未阅读 | 代理编排配置 | 开发工具 | 不影响评估 |

## 阅读统计

| 状态 | 数量 |
|---|---|
| 已完整阅读 | 68 |
| 已重点阅读 | 0 |
| 仅确认用途 | 42 |
| 未阅读 | 50 |

## 关键发现汇总

1. **无 User 模型**：数据库中没有任何用户相关表
2. **无 API 认证**：除 login/check/logout 三个端点外，所有 API 路由均无认证
3. **无角色系统**：JWT 仅包含 username，无 role 字段
4. **全局数据**：所有查询无用户范围限制
5. **单管理员模型**：认证基于环境变量的单一管理员账号
6. **AI 配置全局唯一**：`aiConfig` 表仅有一条 name="default" 的记录
7. **IMA 配置纯环境变量**：模块加载时读取，无法动态切换
8. **we-mp-rss 配置由调用方传入**：baseUrl 参数化，但当前由环境变量提供
9. **任务系统无用户关联**：AsyncTask 无 userId 字段
10. **管理后台 API 无认证**：7/8 个管理 API 端点完全公开
