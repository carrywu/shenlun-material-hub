# 登录、邀请码、分级权限与个人配置 — 需求可行性评估报告

> 评估时间：2026-06-05
> 项目：shenlun-material-hub
> 评估范围：代码阅读与需求可行性分析
> 本阶段未修改任何业务代码

---

## 1. 执行摘要

### 结论：建议调整部分需求后进入开发

**项目适合增加权限体系**，但当前架构存在显著差距需要弥补：

- 当前项目是一个**单管理员、全局公开**的内容管理工具，无用户表、无角色系统、无 API 认证
- 增加多用户系统需要**新建 6-8 张数据表**、**改造全部 30+ 个 API 路由**、**重构前端导航和权限控制**
- **最大技术风险**：(1) 全局数据迁移为用户隔离数据的工作量；(2) 后台异步任务的用户上下文传递；(3) IMA/WeWe RSS 从全局配置改为用户级配置的改造深度
- **推荐实施顺序**：先做认证基础和 API 保护 → 用户管理和邀请码 → 数据隔离 → 用户级配置 → 高级功能

**建议调整的需求**：
1. `USER` 和 `VERIFIED_USER` 的区分可以简化为"注册用户"和"认证用户"两级
2. 邀请码系统可以延后到第二阶段，先做管理员手动创建账号
3. 多 IMA 知识库应延后到第三阶段
4. 管理员查看明文密钥**强烈建议放弃**
5. 历史文章默认公开需谨慎，建议保留管理员手动发布机制

---

## 2. 当前项目真实架构

### 2.1 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | Next.js (App Router) | 16.2.6 |
| 前端 | React + Tailwind CSS + shadcn/ui | React 19.2.4, Tailwind 4 |
| 后端 | Next.js API Routes (Route Handlers) | 同框架 |
| ORM | Prisma (libSQL adapter) | 7.8.0 |
| 数据库 | SQLite (via libSQL/better-sqlite3) | — |
| AI | OpenAI SDK | 6.39.1 |
| 测试 | Vitest + Playwright | Vitest 4.1.7, Playwright 1.60 |
| 包管理 | pnpm | — |
| 部署 | Docker (standalone mode) | Node 20 |

### 2.2 前后端组织方式

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 根布局（公开导航）
│   ├── page.tsx            # 仪表板
│   ├── articles/           # 文章页面
│   ├── cards/              # 素材卡页面
│   ├── discover/           # 今日推荐
│   ├── explore/            # 探索区
│   ├── search/             # 检索
│   ├── review/             # 复习
│   ├── settings/ai/        # → 重定向到 /admin/settings/ai
│   ├── admin/              # 管理后台
│   │   ├── layout.tsx      # 管理布局（AdminShell 认证）
│   │   ├── login/          # 登录页
│   │   ├── articles/       # 管理文章
│   │   ├── sources/        # 来源管理
│   │   ├── tasks/          # 任务监控
│   │   ├── settings/ai/    # AI 配置
│   │   └── ...
│   └── api/                # API 路由
│       ├── auth/           # 认证（login/logout/check）
│       ├── admin/          # 管理 API（无认证！）
│       ├── articles/       # 文章 API
│       ├── content-items/  # 内容 API
│       ├── ai-config/      # AI 配置 API
│       ├── sync/           # IMA 同步 API
│       ├── collectors/     # 采集 API
│       ├── integrations/   # 外部集成 API
│       └── ...
├── components/             # React 组件
├── services/               # 业务服务层
├── lib/                    # 工具库
├── generated/prisma/       # Prisma 生成代码
├── types/                  # 类型定义
└── scripts/                # 种子脚本
```

### 2.3 数据库

SQLite 数据库，通过 Prisma 管理。当前 11 张表：

| 表名 | 职责 | 用户归属 |
|---|---|---|
| Source | 信息源 | 无 |
| CollectionChannel | 采集栏目 | 无 |
| ContentItem | 内容条目 | 无 |
| MaterialCard | AI 素材卡 | 无 |
| SyncRecord | 同步记录 | 无 |
| CollectorRun | 采集运行记录 | 无 |
| AiConfig | AI 配置 | 无（全局唯一） |
| AiPromptTemplate | AI 提示词模板 | 无（全局） |
| ArticleAnnotation | 文章批注 | 无 |
| SystemLog | 系统日志 | 无 |
| AsyncTask | 异步任务 | 无 |

**无 User、Session、Invitation 或任何权限相关表。**

### 2.4 API 结构

共约 35 个 API 端点。认证状态：

| 类别 | 端点数 | 有认证 | 无认证 |
|---|---|---|---|
| 认证 (auth/) | 3 | 3 (login/check/logout) | 0 |
| 管理 (admin/) | 8 | 1 (backup import 部分) | 7 |
| 业务 API | 24 | 0 | 24 |
| **合计** | **35** | **4** | **31** |

**89% 的 API 端点没有任何认证保护。**

### 2.5 任务系统

进程内内存队列（`src/lib/async-task.ts`），存储在 `globalThis` 上：
- 4 种任务类型：`WEWE_RSS_SYNC`、`WEB_CRAWL`、`AI_ASSESS`、`CARD_GENERATE`
- 默认并发 2（可通过 `ASYNC_TASK_CONCURRENCY` 配置，上限 8）
- 任务状态持久化到 `AsyncTask` 表，但队列本身不持久化
- 无重试机制
- 无用户关联

### 2.6 配置系统

| 配置项 | 存储位置 | 当前范围 |
|---|---|---|
| AI API Key | DB `AiConfig.encryptedKey` + env fallback | 全局唯一 |
| AI Base URL | DB `AiConfig.baseUrl` + env fallback | 全局唯一 |
| AI Model | DB `AiConfig.model` + env fallback | 全局唯一 |
| AI Prompt Templates | DB `AiPromptTemplate` | 全局 |
| IMA API Key | 环境变量 `IMA_API_KEY` | 全局唯一 |
| IMA Client ID | 环境变量 `IMA_CLIENT_ID` | 全局唯一 |
| IMA Knowledge Base ID | 环境变量 `IMA_KNOWLEDGE_BASE_ID` | 全局唯一 |
| IMA API Base | 环境变量 `IMA_API_BASE` | 全局唯一 |
| WeWe RSS Base URL | 环境变量 `WEWERSS_BASE_URL` | 全局唯一 |
| 管理员账号 | 环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | 单一账号 |
| JWT Secret | 环境变量 `JWT_SECRET` | 全局唯一 |
| 加密密钥 | 环境变量 `AI_CONFIG_ENCRYPTION_KEY` | 全局唯一 |

### 2.7 当前认证和权限

- **认证方式**：自定义 JWT (HS256)，Cookie 存储，24 小时过期
- **密码哈希**：SHA-256（非 bcrypt/argon2）
- **用户模型**：单一管理员，凭据来自环境变量
- **权限模型**：二元（已认证 = 管理员，未认证 = 访客）
- **前端保护**：仅 AdminShell 组件检查 `/api/auth/check`
- **API 保护**：仅 login/check/logout 三个端点有认证逻辑
- **管理后台 API**：7/8 个端点完全公开（无认证）

### 2.8 部署方式

Docker Compose 单容器部署：
- Next.js standalone 模式
- SQLite 数据文件挂载到宿主机 `./data/prisma`
- 上传文件挂载到 `./data/uploads`
- 可选 WeWe RSS sidecar（Docker profile 门控）
- 非 root 用户运行

---

## 3. 当前业务调用链

### 3.1 文章浏览

```
/articles (页面)
  → ArticlesPage 组件
    → GET /api/articles
      → db.contentItem.findMany() — 全局查询，无用户过滤
      → 返回 data, total, page, pageSize

/articles/[id] (页面)
  → 1057 行客户端组件
    → GET /api/content-items/[id]
      → db.contentItem.findUnique() — 按 ID 查询
      → 包含 materialCards, annotations
```

### 3.2 网站采集

```
仪表板 CollectButton
  → CollectDialog 组件
    → POST /api/collectors/web/collect
      → createAsyncTask("WEB_CRAWL")
      → enqueueAsyncTask(task, handler)
        → runWebCollectTask()
          → getCollector({ name }) — 匹配采集器
          → collector.run({ source }) — 执行采集
          → db.contentItem.create() — 写入数据
```

### 3.3 WeWe RSS 同步

```
管理后台 /admin/integrations/wewe-rss
  → WeweRssIntegrationPage 组件
    → POST /api/integrations/wewe-rss/sync-sources
      → listFeedsAuto(baseUrl, syncMode, dbPath)
        → API 模式: listFeeds(baseUrl)
        → SQLite 模式: listFeedsFromSqlite(dbPath)
      → db.source.create() / db.source.update() — 同步来源

    → POST /api/collectors/wechat/sync
      → createAsyncTask("WEWE_RSS_SYNC")
      → enqueueAsyncTask(task, handler)
        → runWechatSyncTask({ sourceId })
          → fetchStandardRssArticles(url) / WeRssClient
          → normalizeWeRssArticles()
          → db.contentItem.create() — 写入文章
```

### 3.4 AI 评估

```
管理后台 /admin/articles
  → ArticlesPage managementMode
    → POST /api/content-items/assess
      → createAsyncTask("AI_ASSESS")
      → enqueueAsyncTask(task, handler)
        → runAssessTask(ids, concurrency)
          → assessRelevanceWithRetry() — 调用 AI API
          → db.contentItem.update() — 写入评分结果

    → POST /api/content-items/reassess
      → assessRelevanceWithRetry() — 同步调用
      → db.contentItem.update()
```

### 3.5 素材卡生成

```
管理后台 /admin/articles
  → POST /api/content-items/[id]/generate-card
    → createAsyncTask("CARD_GENERATE")
    → enqueueAsyncTask(task, handler)
      → runGenerateCardTask(id, cardType)
        → generateCardForContentItem() — 调用 AI API
        → db.materialCard.create() — 写入素材卡
        → db.contentItem.update() — 更新处理状态
```

### 3.6 IMA 同步

```
/cards 页面 或 /cards/[id] 页面
  → SyncToIma 组件
    → POST /api/sync { cardId }
      → db.materialCard.findUnique() — 验证卡片存在且已确认
      → syncToIma(cardId) — 从 ima-sync.ts
        → callImaApi() — 使用环境变量中的 IMA_API_KEY
        → db.syncRecord.create() — 记录同步结果
```

### 3.7 管理后台配置

```
/admin/settings/ai
  → AiConfigPage 组件
    → GET /api/ai-config — 获取配置
      → db.aiConfig.findFirst({ name: "default" })
      → decrypt(config.encryptedKey) — 解密 API Key
      → 返回 maskedKey

    → POST /api/ai-config — 保存配置
      → encrypt(apiKey) — 加密 API Key
      → db.aiConfig.upsert({ name: "default" })
      → resetAiConfigCache() — 清除缓存

    → POST /api/ai-config/test — 测试连接
      → testAiConfig() — 调用 AI API 测试
      → db.aiConfig.update() — 记录测试结果
```

### 3.8 异步任务执行

```
任意触发点（采集/评估/生成/同步）
  → createAsyncTask(type, params) — 持久化到 DB
  → enqueueAsyncTask(task, handler) — 加入内存队列
    → scheduleQueueDrain() — setTimeout(0) 调度
      → drainTaskQueue()
        → while (activeCount < concurrency && pending.length > 0)
          → runQueuedTask(task)
            → markAsyncTaskRunning(id)
            → handler() — 执行任务
            → completeAsyncTask(id, result) / failAsyncTask(id, error)
```

---

## 4. 逐项需求可行性评估

### 4.1 身份与权限模型

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 访客浏览公开内容 | 部分支持（当前全部公开） | 需要中等改造 | 需区分公开/私有内容，添加可见性字段 | 历史数据迁移 | 第一阶段实现 |
| USER 角色 | 不支持 | 需要重大重构 | 新建 User 表、Session 管理、注册流程 | 认证架构重建 | 第一阶段实现 |
| VERIFIED_USER 角色 | 不支持 | 需要重大重构 | 在 USER 基础上添加认证状态和管理员审核 | 角色状态管理 | 第一阶段实现 |
| ADMIN 角色 | 部分支持（当前单一管理员） | 需要中等改造 | 将环境变量管理员迁移到数据库、添加角色字段 | 迁移兼容性 | 第一阶段实现 |
| 角色区分前端展示 | 不支持 | 需要中等改造 | 前端权限上下文、条件渲染 | 状态同步 | 第二阶段实现 |

**关键改动文件**：
- 新建：`prisma/schema.prisma`（User/Session 模型）、`src/lib/auth.ts`（重构）、`src/middleware.ts`（新建）
- 修改：全部 30+ API 路由（添加认证中间件）、`src/app/layout.tsx`（权限导航）、`src/components/admin/AdminShell.tsx`（角色检查）

### 4.2 邀请码注册

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 邀请码数据模型 | 不支持 | 需要中等改造 | 新建 Invitation、InvitationUse 表 | 并发扣减 | 第二阶段实现 |
| 邀请码管理 API | 不支持 | 需要中等改造 | 新增管理端点 CRUD | 安全性 | 第二阶段实现 |
| 注册流程 | 不支持 | 需要重大重构 | 新建注册页面、验证逻辑、用户创建 | 流程完整性 | 第二阶段实现 |
| 防暴力枚举 | 不支持 | 需要中等改造 | 速率限制、尝试次数限制 | 性能影响 | 第二阶段实现 |

**建议**：第一阶段先做管理员手动创建账号，邀请码延后到第二阶段。

### 4.3 历史内容公开与新增内容私有

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 历史文章默认 public | 支持（当前全部公开） | 需要中等改造 | 添加 visibility 字段，迁移脚本设置默认值 | 数据迁移 | 第一阶段实现 |
| 新采集内容默认 private | 不支持 | 需要中等改造 | 采集流程添加 ownerUserId 和 visibility | 采集器改造 | 第二阶段实现 |
| AI 结果和素材卡默认 private | 不支持 | 需要中等改造 | MaterialCard/AiResult 添加 ownerUserId | 数据模型 | 第二阶段实现 |
| 管理员发布/取消发布 | 不支持 | 可直接实现 | 添加 published 字段和管理 API | 低 | 第一阶段实现 |

**数据模型选择**：建议采用"共享文章主体 + 用户关系表"模式：
- `ContentItem` 保持全局（同一篇文章不重复采集）
- 新建 `UserContentRelation` 表记录用户与内容的关系（bookmarked, collected, visibility）
- `MaterialCard` 添加 `ownerUserId` 字段（每个用户的素材卡独立）

### 4.4 多个 IMA 知识库

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 用户级 IMA 配置 | 不支持（纯环境变量） | 需要重大重构 | 新建 UserIntegration 表，重构 ima-sync.ts | 服务层改造 | 第三阶段实现 |
| 多目标选择 | 不支持 | 需要重大重构 | 新建 ImaTarget 模型，同步时选择目标 | UI 和 API | 第三阶段实现 |
| 连接测试 | 部分支持 | 可直接实现 | 复用现有 callImaApi 模式 | 低 | 第三阶段实现 |
| 同步记录关联目标 | 不支持 | 需要中等改造 | SyncRecord 添加 targetId 字段 | 数据模型 | 第三阶段实现 |

**关键冲突**：当前 `ima-sync.ts` 在模块加载时读取环境变量（第 4-7 行），改为用户级配置需要：
1. 将 `IMA_API_KEY`、`IMA_CLIENT_ID`、`IMA_KNOWLEDGE_BASE_ID`、`IMA_API_BASE` 从模块级常量改为函数参数
2. 重构 `callImaApi()`、`syncToIma()`、`syncBatchToIma()` 等所有函数接受配置参数
3. 修改所有调用方（`/api/sync` 路由）传入用户配置

### 4.5 用户自己的 AI 与 WeWe RSS 配置

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 用户级 AI 配置 | 部分支持（DB 有 AiConfig 表） | 需要重大重构 | AiConfig 添加 userId，重构 ai.ts 服务层 | 缓存失效、并发 | 第二阶段实现 |
| 用户级 WeWe RSS 配置 | 不支持（纯参数传入） | 需要中等改造 | 新建 UserIntegration 表，重构 API 路由 | 服务层改造 | 第三阶段实现 |
| 密钥加密 | 支持（已有 AES-256-CBC） | 可直接实现 | 复用现有 crypto.ts | 低 | 随用户级配置一起实现 |
| 管理员查看明文密钥 | 不支持 | **强烈不建议实现** | 需要可逆加密 + 审计日志 | **高安全风险** | 建议放弃 |

**AI 配置改造链**：
```
当前：ai.ts → db.aiConfig.findFirst({ name: "default" }) → 全局配置
目标：ai.ts → 接受 userId 参数 → db.aiConfig.findFirst({ userId }) → 用户配置
影响：所有调用 getAiRuntime() 的地方都需要传入 userId
     - assessRelevance() → 需要 userId
     - scoreContentItem() → 需要 userId
     - generateCardForContentItem() → 需要 userId
     - testAiConfig() → 需要 userId
     - 所有 API 路由 → 需要从 session 获取 userId
```

### 4.6 管理员查看用户明文密钥

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 密钥可逆加密 | 支持（已有 AES-256-CBC） | 可直接实现 | 现有 crypto.ts 已满足 | 低 | 可实现 |
| 管理员二次验证 | 不支持 | 需要中等改造 | 重新验证密码 + 审计 | 安全 | 可实现 |
| 审计日志 | 部分支持（有 SystemLog） | 可直接实现 | 添加 AUDIT 类型日志 | 低 | 可实现 |
| 掩码显示 | 支持（已有 maskedKey） | 可直接实现 | 现有实现 | 低 | 已实现 |
| 用户查看访问记录 | 不支持 | 需要中等改造 | 新建 AuditLog 表，用户可见 | 数据模型 | 可实现 |

**强烈建议放弃此需求**，理由：
1. 存储可逆加密的密钥增加了密钥泄露风险
2. 管理员查看用户密钥违反最小权限原则
3. 主密钥（`AI_CONFIG_ENCRYPTION_KEY`）的管理复杂度大幅增加
4. 如果主密钥泄露，所有用户的密钥全部暴露

**替代方案**：管理员只能重置用户的密钥（生成新密钥），不能查看明文。

### 4.7 按身份展示操作能力

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 访客隐藏操作按钮 | 不支持 | 需要中等改造 | 前端权限上下文、条件渲染 | 状态闪烁 | 第一阶段实现 |
| 认证用户显示操作按钮 | 不支持 | 需要中等改造 | 前端权限判断 | 配置缺失引导 | 第一阶段实现 |
| 管理员显示管理入口 | 部分支持 | 可直接实现 | 扩展 AdminShell 导航 | 低 | 第一阶段实现 |
| 服务端权限校验 | 不支持 | 需要重大重构 | API 中间件 + 路由守卫 | 全面改造 | 第一阶段实现 |

**当前操作按钮分布**：
- `CollectButton`：仪表板页面，无条件显示
- `SyncToIma`：素材卡列表/详情页，无条件显示
- AI 批注按钮：文章详情页，无条件显示
- 素材卡编辑/删除/确认：素材卡详情页，无条件显示
- 批量操作：素材卡列表页，无条件显示

### 4.8 用户数据和任务隔离

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 内容关联用户 | 不支持 | 需要重大重构 | ContentItem/MaterialCard 添加 ownerUserId | 数据迁移 | 第二阶段实现 |
| 任务关联用户 | 不支持 | 需要中等改造 | AsyncTask 添加 userId 字段 | 任务上下文 | 第一阶段实现 |
| 查询范围限制 | 不支持 | 需要重大重构 | 全部查询添加用户过滤 | 性能和正确性 | 第二阶段实现 |
| 防止水平越权 | 不支持 | 需要重大重构 | 所有按 ID 操作的端点添加所有权验证 | 安全 | 第一阶段实现 |
| 会话失效 | 不支持 | 需要中等改造 | JWT 黑名单或短期 Token | 状态管理 | 第一阶段实现 |

**最容易产生水平越权的端点**：
1. `GET /api/content-items/[id]` — 可查看任何内容
2. `PUT /api/content-items/[id]` — 可修改任何内容
3. `DELETE /api/content-items/[id]` — 可删除任何内容
4. `POST /api/content-items/[id]/generate-card` — 可为任何内容生成卡片
5. `POST /api/sync` — 可同步任何卡片到 IMA
6. `PATCH /api/annotations/[id]` — 可修改任何批注
7. `DELETE /api/annotations/[id]` — 可删除任何批注

### 4.9 采集与任务限额

| 需求 | 当前支持程度 | 可行性 | 主要改动 | 风险 | 推荐处理 |
|---|---|---|---|---|---|
| 角色限制任务创建 | 不支持 | 需要中等改造 | API 路由添加角色检查 | 低 | 第一阶段实现 |
| 并发任务限制 | 部分支持（全局并发 2） | 需要中等改造 | 改为按用户并发限制 | 任务队列改造 | 第二阶段实现 |
| 防重复创建 | 不支持 | 需要中等改造 | 任务去重逻辑 | 并发安全 | 第二阶段实现 |
| 限额可配置 | 不支持 | 可直接实现 | 添加配置表或环境变量 | 低 | 第二阶段实现 |

---

## 5. 数据模型影响

### 5.1 需要新增的数据实体

#### users（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (CUID) | 主键 |
| username | String (unique) | 用户名 |
| email | String? | 邮箱（可选） |
| passwordHash | String | 密码哈希（建议升级为 bcrypt） |
| role | String | USER / VERIFIED_USER / ADMIN |
| status | String | ACTIVE / DISABLED / PENDING |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

**与现有代码的影响**：所有需要用户归属的表都需要添加 `userId` 外键。

#### sessions（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (CUID) | 主键 |
| userId | String | 关联用户 |
| token | String (unique) | 会话令牌 |
| expiresAt | DateTime | 过期时间 |
| createdAt | DateTime | 创建时间 |

**与现有代码的影响**：`auth.ts` 需要重构以支持数据库会话管理。

#### invitations（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (CUID) | 主键 |
| code | String (unique) | 邀请码 |
| createdBy | String | 创建者（管理员） |
| maxUses | Int | 最大使用次数 |
| usedCount | Int | 已使用次数 |
| expiresAt | DateTime? | 过期时间 |
| isActive | Boolean | 是否启用 |
| createdAt | DateTime | 创建时间 |

#### invitation_uses（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (CUID) | 主键 |
| invitationId | String | 关联邀请码 |
| userId | String | 使用者 |
| usedAt | DateTime | 使用时间 |

#### user_integrations（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (CUID) | 主键 |
| userId | String | 关联用户 |
| provider | String | ai / ima / wewe-rss |
| config | String (JSON) | 加密的配置数据 |
| isEnabled | Boolean | 是否启用 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

**与现有代码的影响**：替代当前的 `AiConfig` 表（需要迁移）和环境变量配置。

#### audit_logs（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | String (CUID) | 主键 |
| userId | String | 操作者 |
| action | String | 操作类型 |
| resource | String | 资源类型 |
| resourceId | String? | 资源 ID |
| detail | String? | 详情 |
| createdAt | DateTime | 创建时间 |

### 5.2 需要调整的数据实体

#### articles（ContentItem）

| 变更 | 说明 | 迁移风险 |
|---|---|---|
| 添加 `ownerUserId` | 关联采集者 | 历史数据设为 null 或迁移为管理员 |
| 添加 `visibility` | public / private | 历史数据默认 public |
| 添加 `publishedAt` | 发布时间（区别于采集时间） | 历史数据使用 createdAt |

**迁移风险**：`originalUrl` 有 UNIQUE 约束。如果采用"共享文章主体"模式，同一篇文章只有一条记录，`ownerUserId` 表示第一个采集者。如果采用"独立副本"模式，需要移除 UNIQUE 约束。

**推荐**：共享文章主体模式（保留 UNIQUE），通过关系表记录用户关联。

#### material_cards（MaterialCard）

| 变更 | 说明 | 迁移风险 |
|---|---|---|
| 添加 `ownerUserId` | 关联创建者 | 历史数据设为管理员 |

#### tasks（AsyncTask）

| 变更 | 说明 | 迁移风险 |
|---|---|---|
| 添加 `userId` | 关联任务创建者 | 历史数据设为 null |

#### sync_records（SyncRecord）

| 变更 | 说明 | 迁移风险 |
|---|---|---|
| 添加 `userId` | 关联同步者 | 历史数据设为 null |
| 添加 `targetId` | 关联 IMA 目标（多 IMA 支持） | 历史数据设为默认目标 |

#### ai_configs（AiConfig）

| 变更 | 说明 | 迁移风险 |
|---|---|---|
| 添加 `userId` | 关联用户 | 历史数据（name="default"）迁移为管理员配置 |
| 修改 `name` 唯一约束 | 改为 `(userId, name)` 复合唯一 | 需要重建索引 |

#### sources（Source）

| 变更 | 说明 | 迁移风险 |
|---|---|---|
| 无需添加用户归属 | 来源是共享资源 | 无 |
| 可选添加 `createdBy` | 记录创建者 | 低风险 |

---

## 6. API 权限初步矩阵

### 6.1 公开读取（所有身份可访问）

| 路由/API | 当前状态 | 访客 | USER | VERIFIED_USER | ADMIN | 改造难度 |
|---|---|---|---|---|---|---|
| GET /api/articles | 无认证 | ✅ | ✅ | ✅ | ✅ | S — 添加可见性过滤 |
| GET /api/discover | 无认证 | ✅ | ✅ | ✅ | ✅ | S — 仅显示 public 内容 |
| GET /api/explore | 无认证 | ✅ | ✅ | ✅ | ✅ | S — 仅显示 public 内容 |
| GET /api/content-items/[id] | 无认证 | ✅ 仅 public | ✅ 仅 public | ✅ 自己的 + public | ✅ 全部 | M — 添加所有权检查 |
| GET /api/search | 无认证 | ✅ 仅 public | ✅ 仅 public | ✅ 自己的 + public | ✅ 全部 | M — 添加可见性过滤 |
| GET /api/review | 无认证 | ❌ | ✅ 自己的 | ✅ 自己的 | ✅ 全部 | M — 添加用户过滤 |

### 6.2 认证读取（USER 及以上）

| 路由/API | 当前状态 | 访客 | USER | VERIFIED_USER | ADMIN | 改造难度 |
|---|---|---|---|---|---|---|
| GET /api/auth/check | 有认证 | — | ✅ | ✅ | ✅ | S — 添加角色信息 |
| GET /api/material-cards | 无认证 | ❌ | ✅ 自己的 | ✅ 自己的 | ✅ 全部 | M — 添加用户过滤 |
| GET /api/sync-records | 无认证 | ❌ | ✅ 自己的 | ✅ 自己的 | ✅ 全部 | M — 添加用户过滤 |
| GET /api/export | 无认证 | ❌ | ✅ 自己的 | ✅ 自己的 | ✅ 全部 | M — 添加用户过滤 |

### 6.3 认证写入（VERIFIED_USER 及以上）

| 路由/API | 当前状态 | 访客 | USER | VERIFIED_USER | ADMIN | 改造难度 |
|---|---|---|---|---|---|---|
| POST /api/collectors/web/collect | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| POST /api/collectors/wechat/sync | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| POST /api/collectors/wechat/import | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| POST /api/content-items/assess | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| POST /api/content-items/reassess | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| POST /api/content-items/[id]/generate-card | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| POST /api/sync | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| POST /api/content-items | 无认证 | ❌ | ❌ | ✅ | ✅ | M — 添加角色检查 |
| PUT /api/content-items/[id] | 无认证 | ❌ | ❌ | ✅ 自己的 | ✅ 全部 | M — 所有权检查 |
| DELETE /api/content-items/[id] | 无认证 | ❌ | ❌ | ✅ 自己的 | ✅ 全部 | M — 所有权检查 |
| PATCH /api/annotations/[id] | 无认证 | ❌ | ❌ | ✅ 自己的 | ✅ 全部 | M — 所有权检查 |
| DELETE /api/annotations/[id] | 无认证 | ❌ | ❌ | ✅ 自己的 | ✅ 全部 | M — 所有权检查 |

### 6.4 管理员操作（ADMIN）

| 路由/API | 当前状态 | 访客 | USER | VERIFIED_USER | ADMIN | 改造难度 |
|---|---|---|---|---|---|---|
| GET /api/admin/tasks | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| GET /api/admin/tasks/[id] | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| GET /api/admin/logs | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| DELETE /api/admin/logs | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| GET /api/admin/metrics | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| GET /api/admin/backup/export | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| POST /api/admin/backup/import | 部分认证 | ❌ | ❌ | ❌ | ✅ | S — 统一认证 |
| GET/POST /api/admin/clean | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| GET/POST /api/ai-config | 无认证 | ❌ | ❌ | ❌ | ✅ (系统级) | M — 区分系统/用户配置 |
| POST /api/ai-config/test | 无认证 | ❌ | ❌ | ❌ | ✅ (系统级) | M — 同上 |
| GET/PUT/POST /api/ai-config/prompts | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| GET/POST /api/sources | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |
| POST /api/integrations/wewe-rss/* | 无认证 | ❌ | ❌ | ❌ | ✅ | S — 添加认证 |

---

## 7. 前端影响地图

### 7.1 需要新增的页面

| 页面 | 路由 | 说明 |
|---|---|---|
| 注册页 | `/register` | 邀请码注册（第二阶段） |
| 个人设置页 | `/settings` | 用户个人配置 |
| 用户管理页 | `/admin/users` | 管理员管理用户 |
| 邀请码管理页 | `/admin/invitations` | 管理员管理邀请码 |
| 审计日志页 | `/admin/audit-logs` | 管理员查看审计日志 |

### 7.2 需要改造的页面

| 页面 | 改造内容 |
|---|---|
| `src/app/layout.tsx` | 添加认证上下文提供者、根据角色条件渲染导航项、添加登录/注册/用户菜单 |
| `src/app/page.tsx` | 根据角色显示/隐藏 CollectButton、统计信息按用户范围过滤 |
| `src/app/articles/[id]/page.tsx` | AI 批注按钮仅对 VERIFIED_USER+ 显示、管理操作链接仅对 ADMIN 显示 |
| `src/app/cards/page.tsx` | 批量同步按钮仅对 VERIFIED_USER+ 显示、数据按用户过滤 |
| `src/app/cards/[id]/page.tsx` | 编辑/删除/同步按钮按权限显示 |
| `src/app/admin/login/page.tsx` | 改为通用登录页（非仅管理员） |
| `src/components/admin/AdminShell.tsx` | 角色判断、导航项权限过滤、用户信息显示 |
| `src/components/ai/AiConfigPage.tsx` | 区分系统级和用户级配置 |
| `src/components/CollectButton.tsx` | 根据角色显示/隐藏 |
| `src/components/SyncToIma.tsx` | 根据角色显示/隐藏 |
| `src/components/integrations/WeweRssIntegrationPage.tsx` | 区分系统级和用户级配置 |

### 7.3 需要隐藏或受控显示的按钮

| 按钮/组件 | 当前位置 | 显示条件 |
|---|---|---|
| CollectButton "开始采集" | 仪表板 | VERIFIED_USER+ |
| SyncToIma 同步按钮 | 素材卡列表/详情 | VERIFIED_USER+ |
| "AI 自动批注" 按钮 | 文章详情页 | VERIFIED_USER+ |
| "手动批注" 按钮 | 文章详情页 | VERIFIED_USER+ |
| 素材卡"编辑"按钮 | 素材卡详情页 | 所有者或 ADMIN |
| 素材卡"删除"按钮 | 素材卡详情页 | 所有者或 ADMIN |
| 素材卡"确认"按钮 | 素材卡详情页 | 所有者或 ADMIN |
| 批量"同步"按钮 | 素材卡列表页 | VERIFIED_USER+ |
| "管理后台" 入口 | 导航栏 | ADMIN |

### 7.4 需要增加身份状态的导航

- 根布局 `<header>`：添加登录/注册按钮（未登录）或用户菜单（已登录）
- AdminShell 侧边栏：根据角色过滤导航项
- 移动端导航：需要适配权限控制

### 7.5 可能出现权限闪烁或状态同步问题的位置

1. **页面加载时**：AdminShell 在 `useEffect` 中检查认证，期间可能短暂显示未认证状态
2. **角色变更后**：管理员修改用户角色后，用户的本地 JWT 可能仍持有旧角色
3. **配置缺失时**：VERIFIED_USER 缺少 AI/IMA 配置时，按钮显示但点击后报错
4. **Token 过期时**：24 小时过期，用户操作中途可能失效

---

## 8. 配置系统影响

### 8.1 AI 用户级配置

**当前代码中的全局配置读取位置**：
- `src/services/ai.ts:resolveAiRuntimeConfig()` — `db.aiConfig.findFirst({ name: "default" })`
- `src/services/ai.ts:getAiRuntime()` — 缓存全局运行时
- `src/app/api/ai-config/route.ts` — 直接操作 `name: "default"` 的配置

**改为用户级配置的推荐传递方式**：
1. `resolveAiRuntimeConfig(userId)` — 接受 userId 参数
2. 先查 `db.aiConfig.findFirst({ userId, isEnabled: true })`
3. 若无用户配置，回退到系统级配置 `db.aiConfig.findFirst({ userId: null, isEnabled: true })`
4. 若仍无，回退到环境变量

**影响的调用链**：
- `assessRelevance()` → 需要传入 userId
- `scoreContentItem()` → 需要传入 userId
- `generateCardForContentItem()` → 需要传入 userId
- `testAiConfig()` → 需要传入 userId
- `ai-annotation.ts` 的所有函数 → 需要传入 userId
- 所有 AI 相关 API 路由 → 需要从 session 获取 userId

### 8.2 WeWe RSS 用户级配置

**当前代码中的配置读取位置**：
- `src/app/api/integrations/wewe-rss/status/route.ts` — `process.env.WEWERSS_BASE_URL`
- `src/app/api/integrations/wewe-rss/test/route.ts` — 从请求体读取 baseUrl
- `src/app/api/integrations/wewe-rss/sync-sources/route.ts` — 从请求体或环境变量读取
- `src/app/api/collectors/wechat/sync/route.ts` — `process.env.WEWERSS_BASE_URL`

**改为用户级配置**：
1. 新建 `user_integrations` 表存储用户 WeWe RSS 配置
2. API 路由从 session 获取 userId，查询用户配置
3. 服务层函数改为接受 baseUrl 参数（当前已是参数化设计，改动较小）

### 8.3 多 IMA 目标

**当前代码中的配置读取位置**：
- `src/services/ima-sync.ts` 第 4-7 行：模块级常量
  ```typescript
  const IMA_API_BASE = process.env.IMA_API_BASE ?? "https://api.ima.qq.com";
  const IMA_CLIENT_ID = process.env.IMA_CLIENT_ID ?? "";
  const IMA_API_KEY = process.env.IMA_API_KEY ?? "";
  const IMA_KNOWLEDGE_BASE_ID = process.env.IMA_KNOWLEDGE_BASE_ID ?? "";
  ```

**改为用户级多目标配置**：
1. 将模块级常量改为函数参数
2. `callImaApi(config)` — 接受配置对象
3. `syncToIma(cardId, config)` — 接受配置对象
4. 新建 `user_ima_targets` 表
5. 同步时用户选择目标

### 8.4 系统级配置

建议保留系统级配置作为默认值：
- 环境变量作为最终 fallback
- 管理员可在后台配置系统级 AI/IMA/WeWe RSS
- 用户配置优先于系统配置

### 8.5 密钥加密

当前 `crypto.ts` 已实现 AES-256-CBC 加密，可直接复用。但需注意：
- 密钥零填充（非 KDF）是安全隐患，建议升级为 PBKDF2/HKDF
- 主密钥 `AI_CONFIG_ENCRYPTION_KEY` 需要安全管理
- 用户级配置的加密可以复用同一主密钥

### 8.6 管理员查看明文密钥

**安全风险评估**：
- 当前 `AiConfig.encryptedKey` 使用 AES-256-CBC 加密，主密钥来自环境变量
- 解密函数 `decrypt()` 已存在且可用
- 但存储可逆加密意味着主密钥泄露 = 所有用户密钥泄露
- 管理员查看密钥的行为难以审计和限制

**推荐方案**：不查看明文，只允许重置。

---

## 9. 多用户数据隔离风险

### 9.1 水平越权

**高风险端点**（当前无任何所有权验证）：
1. `GET /api/content-items/[id]` — 任何用户可查看任何内容
2. `PUT /api/content-items/[id]` — 任何用户可修改任何内容
3. `DELETE /api/content-items/[id]` — 任何用户可删除任何内容
4. `POST /api/content-items/[id]/generate-card` — 任何用户可为任何内容生成卡片
5. `POST /api/sync` — 任何用户可同步任何卡片
6. `PATCH /api/annotations/[id]` — 任何用户可修改任何批注
7. `DELETE /api/annotations/[id]` — 任何用户可删除任何批注
8. `POST /api/review` — 任何用户可确认任何卡片

**防护措施**：所有按 ID 操作的端点需要添加所有权验证中间件。

### 9.2 垂直越权

**风险**：当前 JWT 无角色信息，任何已认证用户等同于管理员。

**防护措施**：JWT 中添加角色字段，API 中间件验证角色。

### 9.3 任务串用户

**风险**：`AsyncTask` 无 `userId` 字段，任务执行时无法确定操作者身份。

**影响**：
- 采集任务写入的 ContentItem 无法关联用户
- AI 评估任务使用的配置可能是错误用户的
- 同步任务可能同步到错误用户的 IMA

**防护措施**：AsyncTask 添加 userId 字段，任务执行时传递用户上下文。

### 9.4 缓存串用户

**风险**：`ai.ts` 中的 `getAiRuntime()` 使用全局缓存，如果改为用户级配置，缓存需要按用户隔离。

**防护措施**：缓存 key 改为 `userId:configId` 格式。

### 9.5 搜索结果泄露

**风险**：`GET /api/search` 查询所有 MaterialCard，无用户过滤。

**防护措施**：查询添加 `ownerUserId` 过滤。

### 9.6 统计数据泄露

**风险**：`GET /api/admin/metrics` 暴露全局统计数据（文章总数、来源总数等）。

**防护措施**：管理员端点添加认证，普通用户不暴露全局统计。

### 9.7 导出泄露

**风险**：`GET /api/export` 可导出所有 MaterialCard。

**防护措施**：查询添加用户过滤。

### 9.8 日志泄露

**风险**：`GET /api/admin/logs` 暴露所有系统日志，可能包含用户操作信息。

**防护措施**：管理员端点添加认证。

### 9.9 AI Key 和 Token 泄露

**风险**：
- `GET /api/ai-config` 返回 maskedKey（前 8 位 + `****`），部分泄露
- `POST /api/admin/backup/export` 可下载包含加密密钥的完整数据库
- `GET /api/admin/metrics` 暴露数据库文件路径

**防护措施**：所有管理端点添加认证，备份导出需要管理员权限。

### 9.10 历史数据迁移错误

**风险**：
- 现有 ContentItem 无 `ownerUserId`，迁移时需要决定归属
- 现有 MaterialCard 无 `ownerUserId`，迁移时需要决定归属
- 现有 AiConfig `name="default"` 需要迁移为管理员配置或系统配置
- 现有 AsyncTask 无 `userId`，迁移时无法确定创建者

**防护措施**：迁移脚本需要 dry-run 模式，历史数据默认归属管理员。

---

## 10. 实施阶段建议

### 阶段 1：认证基础与 API 保护（建议工期：1-2 周）

**目标**：建立用户系统基础，保护所有 API 端点

**涉及模块**：
- `prisma/schema.prisma` — 新建 User、Session 表
- `src/lib/auth.ts` — 重构为多用户认证
- `src/middleware.ts` — 新建 API 认证中间件
- 所有 API 路由 — 添加认证检查
- `src/components/admin/AdminShell.tsx` — 适配新认证

**依赖关系**：无前置依赖

**验收条件**：
- [ ] 用户表和会话表创建成功
- [ ] 管理员可登录（从环境变量迁移到数据库）
- [ ] 所有 API 端点需要认证（公开读取端点除外）
- [ ] JWT 包含角色信息
- [ ] 现有 E2E 测试通过
- [ ] 新增认证相关的单元测试和 E2E 测试

**回滚方式**：保留环境变量认证作为 fallback，数据库认证失败时回退

**风险级别**：中 — 影响所有 API 路由，需要全面测试

### 阶段 2：用户管理与数据隔离（建议工期：2-3 周）

**目标**：实现多用户、邀请码、数据隔离

**涉及模块**：
- `prisma/schema.prisma` — 新建 Invitation 表，ContentItem/MaterialCard 添加 userId
- 用户管理 API 和页面
- 邀请码 API 和页面
- 所有业务查询 — 添加用户过滤
- 前端权限控制

**依赖关系**：依赖阶段 1

**验收条件**：
- [ ] 管理员可创建用户
- [ ] 邀请码注册流程完整
- [ ] 用户只能看到自己的私有数据和公共数据
- [ ] 水平越权防护测试通过
- [ ] 历史数据迁移完成（默认 public，归属管理员）

**回滚方式**：数据迁移脚本可逆（保留备份）

**风险级别**：高 — 数据迁移和查询改造影响面广

### 阶段 3：用户级配置与集成（建议工期：2-3 周）

**目标**：AI/IMA/WeWe RSS 配置用户化

**涉及模块**：
- `src/services/ai.ts` — 重构为用户级配置
- `src/services/ima-sync.ts` — 重构为参数化配置
- 新建 UserIntegration 表
- AI 配置页面改造
- IMA 配置页面改造
- WeWe RSS 配置页面改造

**依赖关系**：依赖阶段 2

**验收条件**：
- [ ] 每个用户可配置自己的 AI Provider
- [ ] 每个用户可配置自己的 IMA 知识库
- [ ] 每个用户可配置自己的 WeWe RSS
- [ ] 后台任务使用正确用户的配置
- [ ] 系统级配置作为默认值

**回滚方式**：环境变量配置作为 fallback

**风险级别**：高 — 服务层重构影响所有 AI 和同步功能

### 阶段 4：高级功能与优化（建议工期：1-2 周）

**目标**：限额、审计、多 IMA 目标

**涉及模块**：
- 任务限额逻辑
- 审计日志系统
- 多 IMA 目标
- 性能优化

**依赖关系**：依赖阶段 3

**验收条件**：
- [ ] 任务并发限制生效
- [ ] 审计日志记录关键操作
- [ ] 多 IMA 目标可配置和切换

**回滚方式**：功能开关

**风险级别**：中 — 新增功能，不影响现有

---

## 11. 工作量与风险评估

| 模块 | 复杂度 | 原因 |
|---|---|---|
| User/Session 数据模型 | S | 新建表，不涉及现有数据 |
| 认证中间件 | M | 需要覆盖所有 API 路由 |
| auth.ts 重构 | M | 从单用户改为多用户，JWT 添加角色 |
| 角色权限检查 | M | 每个 API 路由添加角色判断 |
| 前端权限控制 | M | 权限上下文、条件渲染、导航改造 |
| 用户管理（CRUD） | M | 新建 API 和页面 |
| 邀请码系统 | M | 新建数据模型、API、页面、防暴力枚举 |
| ContentItem 用户归属 | L | 添加字段 + 迁移历史数据 + 改造所有查询 |
| MaterialCard 用户归属 | M | 添加字段 + 迁移历史数据 |
| AsyncTask 用户关联 | M | 添加字段 + 任务执行时传递上下文 |
| AI 配置用户化 | L | 重构 ai.ts 服务层 + 缓存隔离 + 所有调用方 |
| IMA 配置用户化 | L | 重构 ima-sync.ts + 消除模块级常量 |
| WeWe RSS 配置用户化 | M | 服务层已是参数化，改动较小 |
| 多 IMA 目标 | L | 新建数据模型 + UI + 同步逻辑 |
| 审计日志 | M | 新建数据模型 + 记录逻辑 |
| 任务限额 | M | 并发控制 + 去重逻辑 |
| API 中间件统一 | M | 新建中间件 + 覆盖所有路由 |
| 前端登录/注册页 | M | 新建页面 + 表单 + 验证 |
| 数据迁移脚本 | L | 需要 dry-run + 回滚 + 大量测试 |
| E2E 测试更新 | L | 所有现有测试需要适配认证 |

---

## 12. 建议修改或放弃的需求

### 12.1 USER 和 VERIFIED_USER 是否有必要同时保留

**建议保留**，但简化命名：
- `USER` → 注册用户（可浏览、复习，不能采集和 AI 处理）
- `VERIFIED_USER` → 认证用户（可采集、AI 处理、同步）
- 理由：防止未验证用户消耗付费 AI API 额度

### 12.2 邀请码系统是否应第一阶段实现

**建议延后到第二阶段**。第一阶段先做管理员手动创建账号：
- 降低初始复杂度
- 管理员可控用户数量
- 邀请码的并发安全和防暴力枚举需要额外开发

### 12.3 多 IMA 是否应第一阶段实现

**建议延后到第三阶段**。理由：
- IMA 配置当前是纯环境变量，改造深度大
- 需要重构 `ima-sync.ts` 的核心架构
- 单 IMA 目标已能满足当前需求

### 12.4 管理员查看用户明文密钥是否建议保留

**强烈建议放弃**。理由：
- 安全风险过高（主密钥泄露 = 所有密钥泄露）
- 违反最小权限原则
- 替代方案：管理员只能重置密钥，不能查看

### 12.5 历史文章全部公开是否安全

**需要确认**。当前所有文章（包括 AI 评估结果、素材卡）都是全局可见的。如果转为多用户系统：
- 历史文章默认 `public` 是合理的（已采集的公开内容）
- 但 AI 评估结果和素材卡是否应默认 `public` 需要确认
- 建议：文章默认 public，素材卡默认 private

### 12.6 用户私有文章与公共文章的数据模型如何设计

**推荐"共享文章主体 + 用户关系表"模式**：
- `ContentItem` 保持全局（`originalUrl` UNIQUE 约束保留）
- 新建 `UserContentRelation` 表记录用户与内容的关系
- `visibility` 字段在 ContentItem 上（public/private）
- `ownerUserId` 在 ContentItem 上（第一个采集者）
- 素材卡独立：`MaterialCard.ownerUserId` 表示创建者

### 12.7 认证用户使用个人 WeWe RSS 是否与当前 WeWe RSS 架构兼容

**基本兼容**。当前 WeWe RSS 服务层已经是参数化设计：
- `wewe-rss-api.ts` 的所有函数接受 `baseUrl` 参数
- `wewe-rss.ts` 的 `listFeedsAuto()` 接受 `baseUrl` 和 `dbPath`
- 改为用户级配置只需从数据库读取用户的 baseUrl 传入

但需要注意：
- WeWe RSS sidecar 是共享服务，不是每个用户独立部署
- 用户的 WeWe RSS 实例地址不同，需要网络可达
- SQLite fallback 模式下，`dbPath` 指向服务器本地文件，多用户场景不适用

---

## 13. 需要用户确认的问题

### 13.1 历史文章的可见性默认值

**问题**：当前数据库中的所有历史文章是否应默认为 `public`？

**可选方案**：
- A：全部默认 `public`（访客可继续浏览）
- B：全部默认 `private`（只有管理员可见，需要手动发布）
- C：根据来源类型自动判断（verified 来源的文章默认 public，其余 private）

**推荐方案**：A（全部默认 public）

**理由**：当前系统所有内容都是公开的，改为 private 会破坏现有用户体验。

**不确认的影响**：如果选择错误，可能导致历史内容意外公开或意外隐藏。

### 13.2 素材卡的可见性

**问题**：素材卡是否应默认 `private`（只有创建者可见）？

**可选方案**：
- A：默认 `private`（每个用户独立）
- B：默认 `public`（所有认证用户可见）
- C：与关联文章的可见性一致

**推荐方案**：A（默认 private）

**理由**：素材卡包含用户的个人整理和编辑，应属于个人资产。

**不确认的影响**：如果选择错误，可能导致用户数据泄露或协作障碍。

### 13.3 同一篇文章是否允许被多个用户采集

**问题**：当用户 A 和用户 B 都想采集同一篇文章时，如何处理？

**可选方案**：
- A：共享模式 — 同一篇文章只有一条记录，多个用户通过关系表关联
- B：独立模式 — 每个用户有独立的文章副本（需要移除 originalUrl UNIQUE 约束）

**推荐方案**：A（共享模式）

**理由**：避免数据重复，保留去重能力，节省存储。

**不确认的影响**：如果选择独立模式，需要移除 UNIQUE 约束，可能影响去重逻辑。

### 13.4 管理员是否可以查看用户的 AI 使用情况

**问题**：管理员是否需要查看每个用户的 AI API 调用次数、消耗额度等？

**可选方案**：
- A：不查看（简化实现）
- B：查看汇总统计（总调用次数、总消耗）
- C：查看详细记录（每次调用的详情）

**推荐方案**：B（查看汇总统计）

**理由**：管理员需要了解系统资源使用情况，但不需要查看每次调用的细节。

**不确认的影响**：如果需要详细记录，需要增加审计日志的存储和查询开销。

### 13.5 用户被禁用后的数据处理

**问题**：当管理员禁用一个用户时，该用户创建的内容和素材卡如何处理？

**可选方案**：
- A：保留数据，仅禁止登录和操作
- B：数据标记为 archived，不对其他用户可见
- C：数据转移给管理员或其他用户

**推荐方案**：A（保留数据，禁止操作）

**理由**：数据不应因用户状态变化而丢失，管理员可以后续处理。

**不确认的影响**：如果选择 B 或 C，需要额外的数据迁移逻辑。

### 13.6 是否需要支持用户自助重置密码

**问题**：用户忘记密码时，是否支持自助重置（通过邮箱）？

**可选方案**：
- A：不支持（联系管理员重置）
- B：支持邮箱验证重置
- C：支持安全问题重置

**推荐方案**：A（联系管理员重置），后续版本再考虑 B

**理由**：邮箱验证需要集成邮件服务，增加部署复杂度。

**不确认的影响**：如果需要邮箱重置，需要添加邮件服务配置和相关 API。

---

## 14. 最终建议

### `建议调整部分需求后进入开发`

**理由**：

1. **项目架构适合增加权限体系**：Next.js App Router + Prisma + SQLite 的技术栈支持多用户扩展，现有代码结构清晰，分层合理。

2. **当前安全状况需要立即改善**：89% 的 API 端点无认证保护，管理后台 API 完全公开，这是一个严重的安全问题，不论是否实施多用户系统都需要修复。

3. **需求范围需要控制**：全部需求一次完成的复杂度过高（预估 6-10 周），建议分 4 个阶段实施，每阶段可独立验收。

4. **部分需求建议调整**：
   - 邀请码延后到第二阶段
   - 多 IMA 延后到第三阶段
   - 管理员查看明文密钥建议放弃
   - USER/VERIFIED_USER 区分保留但简化

5. **最大风险可控**：数据迁移和服务层重构是主要风险，但通过分阶段实施和充分测试可以控制。

---

## 附录：验证命令执行记录

| 命令 | 结果 | 是否影响评估 | 备注 |
|---|---|---|---|
| `find . -type f` | 已执行 | 是 | 建立文件清单 |
| 文件阅读（68 个文件） | 已完成 | 是 | 核心代码全覆盖 |
| 数据库 schema 分析 | 已完成 | 是 | 11 张表，无用户表 |
| API 路由认证检查 | 已完成 | 是 | 31/35 无认证 |
| 配置系统分析 | 已完成 | 是 | AI/IMA/WeWe RSS 配置方式 |
| 任务系统分析 | 已完成 | 是 | 进程内队列，无用户关联 |
