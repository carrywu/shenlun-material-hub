# 申论素材采集台：生产化改造（服务器部署 + 管理后台化）设计与实施方案

本方案旨在将当前的「申论素材采集台」从单机本地运行升级为**适合服务器部署、具备多级安全保护、可长期稳定运行且易于管理维护的生产系统**。

---

## 一、 决策概要

1. **部署环境**：公网 Web 部署（支持 HTTPS 及公网访问，强化安全性）。
2. **访问控制**：
   - **前台（学习区）**：完全公开，任何人可访问首页、文章列表、详情、素材卡、复习等。
   - **后台（管理区 `/admin`）**：必须登录访问，包括对应的敏感数据管理 API。
3. **账户模型**：单管理员账号，由环境变量 `ADMIN_USERNAME` 与 `ADMIN_PASSWORD_HASH`（当前实现为 SHA-256 十六进制哈希）配置，免去复杂的账号注册和找回逻辑。
4. **认证方式**：轻量级 JWT (JSON Web Token) 存放在 HTTP-Only Cookie 中，由 Next.js `proxy.ts` 进行安全校验。
5. **数据库方案**：继续使用 **SQLite**。挂载宿主机数据卷（Docker Volume）保证持久化，并通过定时自动备份导出，既能满足个人/小团队需求，又免去了 PostgreSQL 部署开销。
6. **后台布局**：引入独立、现代的**左侧菜单导航布局**（Sidebar Layout），提供更加紧凑的管理面。

---

## 二、 关键注意事项与设计点

- **安全与认证拦截**：由于公网部署，所有涉及**添加/修改/删除/配置修改/爬虫触发/AI 模板修改**的 API（即 `/api/sources/*`, `/api/ai-config/*`, `/api/collectors/*` 等）将通过 Next.js `proxy.ts` 统一进行 JWT Cookie 强校验，避免非授权调用。
- **环境依赖**：部署阶段必须提供 `JWT_SECRET` 和 `ADMIN_PASSWORD_HASH`。生产环境缺失这些配置时，系统应直接拒绝启动或拒绝认证，而不是静默使用默认值。
- **数据备份机制**：备份导出包含 SQLite 数据库文件 `prisma/dev.db` 和静态媒体文件，导入操作支持 Dry-run 模拟，防止覆盖损坏生产数据。

---

## 三、 详细改造计划

### 1. 数据库模型扩展 (Database Schema)

- 新增 `SystemLog` 模型用于记录系统关键操作及爬虫/AI 调用报错：
  ```prisma
  model SystemLog {
    id        String   @id @default(uuid())
    level     String   // INFO | WARN | ERROR
    category  String   // SYSTEM | CRAWLER | AI | AUTH | BACKUP
    message   String
    detail    String?  // 堆栈或详细错误 JSON
    createdAt DateTime @default(now())
  }
  ```
- 新增 `AsyncTask` 模型用于追踪耗时的采集与评估任务：
  ```prisma
  model AsyncTask {
    id          String    @id @default(uuid())
    type        String    // WEWE_RSS_SYNC | WEB_CRAWL | AI_ASSESS
    status      String    // PENDING | RUNNING | COMPLETED | FAILED
    params      String?   // JSON 格式请求参数
    result      String?   // JSON 格式执行结果或错误原因
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
    completedAt DateTime?
  }
  ```

### 2. 认证与中间件拦截 (Authentication & Middleware)

- **Next.js 认证代理 (`src/proxy.ts`)**：
  - 拦截 `/admin/*`（登录页除外）以及 `/api/admin/*`、`/api/sources/*`、`/api/collectors/*` 等管理 API。
  - 从 `Cookie` 中解析 JWT 令牌，若失效或不存在则对于页面请求重定向到 `/admin/login`，对于 API 请求返回 `401 Unauthorized`。
- **API 接口**：
  - `/api/auth/login`：接收用户名和密码，在服务端比对环境变量 `ADMIN_USERNAME` 和经过哈希计算的密码。比对成功后签发 HTTP-only 的 JWT Cookie。
  - `/api/auth/logout`：清理 JWT Cookie，重置 Session。
  - `/api/auth/check`：供前端调用，判断当前登录态。
- **管理登录页 (`src/app/admin/login/page.tsx`)**：
  - 使用 Vanilla CSS/Tailwind 打造高品质、流畅的登录表单界面，提供醒目的报错提示。

### 3. 管理后台结构与布局 (Admin Area Layout & Dashboard)

- **左侧 Sidebar 布局 (`src/app/admin/layout.tsx`)**：
  - 管理后台专属布局，与前台的顶部 Nav 区分。
  - 菜单包含：📊 控制台 (Dashboard)、📄 文章管理、🌐 来源管理、💬 微信集成、⚙️ AI 配置、⏳ 异步任务、📋 系统日志、💾 数据备份。
- **控制台首页 (`src/app/admin/page.tsx`)**：
  - 展示文章总量、来源数、异常日志数、进行中任务等指标。
  - 展示 SQLite 数据库文件大小、可用磁盘容量、系统 CPU 与内存概览。
  - 提供快捷链接方便直达各管理功能。

### 4. 路由迁移与整合 (Feature Re-routing)

- **文章管理**：
  - 保留前台 `/articles` 作为纯阅读和检索页面，移除触发采集和评估等管理员专属交互。
  - 新建 `/admin/articles`，供管理员进行批量重新评估、批量删除等操作。
- **来源管理与微信集成**：
  - 迁移 `/sources` 及其子页到 `/admin/sources`。
  - 迁移 `/integrations/wewe-rss` 到 `/admin/integrations/wewe-rss`。
- **配置与记录**：
  - 迁移 `/settings/ai` 到 `/admin/settings/ai`。
  - 迁移 `/sync-records` 到 `/admin/sync-records`。
- **废弃旧路由**：
  - 清理或重定向上述前台对应的旧管理路径，确保整洁。

### 5. 采集异步任务队列与追踪 (Task Queue & Status Tracking)

- **轻量级异步处理**：
  - 避免前台同步发起长爬虫任务导致网关超时。
  - 在 `AsyncTask` 插入一条状态为 `PENDING` 的记录。
  - 在 Node.js 后台通过事件/子线程或简单的内部队列异步执行采集与 AI 处理，将状态设为 `RUNNING`。
  - 执行结束后，更新为 `COMPLETED` 或 `FAILED`。
- **任务管理 UI (`/admin/tasks`)**：
  - 展示所有后台任务的实时进度与执行详情。
  - 支持手动对特定来源重新跑同步任务，并提供单独的任务运行日志排查故障。

### 6. 系统日志与日志中心 (System Logs)

- **Logger 封装 (`src/lib/logger.ts`)**：
  - 封装全局日志方法，将重要活动写至控制台同时存储至数据库 `SystemLog` 表中。
- **日志管理页 (`/admin/logs`)**：
  - 支持按严重程度（ERROR/WARN/INFO）和业务模块进行筛选。
  - 提供快速清除过往日志的功能，保持数据库轻量。

### 7. 数据备份与恢复 (Database Backups)

- **备份功能 (`/api/admin/backup/export`)**：
  - 提供接口将 SQLite `dev.db` 文件和静态媒体文件一并打包压缩供管理员下载备份。
- **恢复功能与 Dry-run 校验 (`/api/admin/backup/import`)**：
  - 管理员上传备份文件后，后台先解密/解压并进行 Dry-run 分析。
  - 给出恢复预览（如“该备份包含 1200 篇文章，5 个来源，将覆盖当前系统中的 1000 篇文章”）。
  - 在管理员进行二次安全密码验证后才真正覆盖还原数据库。

### 8. 生产部署与环境检查 (Production Deployment)

- **Dockerfile**：
  - 编写多阶段构建 Dockerfile，在发布镜像中去除所有 Dev 依赖，支持独立包输出模式（standalone），减少容器体积。
- **docker-compose.yml**：
  - 配置持久化数据卷，将 `/prisma/dev.db` 和 `public/uploads` 挂载在外部宿主机，保证镜像更新时数据不丢失。
- **DEPLOY.md**：
  - 编写完整的服务器安装配置指引，包括 Docker 安装、环境变量填充（如 `JWT_SECRET`、`ADMIN_PASSWORD_HASH`）、Nginx 反向代理与 SSL 证书申请流程。

---

## 四、 验证与验收

1. **自动化测试**：
   - 增加中间件拦截相关的单元测试。
   - 增加 Playwright E2E 测试 `e2e/admin-auth.spec.ts` 验证强制拦截、登录校验、Cookie 留存。
   - 运行 `pnpm test` 和 `pnpm exec playwright test`。
2. **构建验证**：
   - 运行 `pnpm build` 确认 Next.js standalone 打包没有任何语法和依赖报错。
