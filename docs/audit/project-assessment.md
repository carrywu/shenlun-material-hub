# shenlun-material-hub 项目评估文档

生成日期：2026-06-13  
状态：项目评估完成，等待进入开发执行  
评估方式：代码静态阅读 + 既有测试/构建结果 + 已发现 Playwright 失败证据

## 1. 执行摘要

项目已经具备主要业务链路：三角色登录、文章采集/审核、素材卡、收藏、复习、IMA、后台管理和 E2E/单测体系。但当前实现与最新确认需求存在多处冲突，尤其集中在：

- 前台路由权限和登录入口。
- 用户私有学习状态与全局文章字段混用。
- 素材卡私有资产生命周期。
- reject/downlist 误删用户私有卡。
- AI/IMA fallback 到 env。
- 后台用户管理和审计边界。
- 旧前台路由仍存在。

当前优先级应是权限与数据安全，其次是核心学习闭环稳定性，最后才是 UI 体系化改造。

评估完成边界：

- 已完成：代码结构、核心业务模块、权限/数据安全冲突、已知 bug、测试资产、验证基线、开发批次和交接入口。
- 已完成：对无法继续浏览器复现的原因做系统诊断，确认当前阻塞在本地 Docker/PostgreSQL 服务健康状态。
- 未完成且不作为“项目评估完成”的前置条件：业务代码修复、数据库 schema 迁移、UI 改造、Playwright 全量通过。
- 后续开发必须从 `docs/audit/development-plan.md` 和 `docs/audit/development-todolist.md` 接续，不应重新发散规划。

## 2. 文档状态

已清理：

- 旧 `docs/audit/*.md` 已归档到 `docs/archive/2026-06-13-audit-reset/`。
- 根目录临时 `bug-discovery-report.md` 已归档。
- `docs/audit/screenshots/` 保留作为历史浏览器证据。

当前有效文档入口：

- `docs/audit/requirements-confirmation.md`
- `docs/audit/project-assessment.md`
- `docs/audit/development-plan.md`
- `docs/audit/development-handoff.md`
- `docs/audit/development-todolist.md`

后续 agent 读取顺序：

1. `docs/audit/requirements-confirmation.md`
2. `docs/audit/project-assessment.md`
3. `docs/audit/development-plan.md`
4. `docs/audit/development-todolist.md`
5. `docs/audit/development-handoff.md`

## 3. 当前模块地图

### 认证与 RBAC

证据：

- `src/lib/auth.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/upgrade/route.ts`
- `src/proxy.ts`
- `prisma/schema.prisma`

当前实现：

- `User.role` 支持 `ADMIN | VERIFIED_USER | USER`。
- `User.status` 支持 `ACTIVE | DISABLED`。
- `validateSession()` 会拒绝 DISABLED 用户。
- 用户禁用/密码重置时有 `revokeAllUserSessions()`。
- 注册无邀请码为 USER，有邀请码为 VERIFIED_USER，并自动创建 session。

主要冲突：

- 当前只有 `/admin/login`，前台 `/login` 未按新需求建立。
- `src/proxy.ts` 使用 `/admin/login` 作为全站未登录跳转。
- `/admin/login` 当前不是后台专用登录入口。

### 路由权限

证据：

- `src/proxy.ts:5` 当前全站登录页常量为 `/admin/login`。
- `src/proxy.ts:16` 到 `src/proxy.ts:24` 将 `/search`、`/review`、`/cards`、旧 `/discover`、`/explore` 放入公开页面。
- `src/proxy.ts:27` 到 `src/proxy.ts:34` 将 `/api/search` 放入公开 API。
- `src/proxy.ts:110` 到 `src/proxy.ts:113` 未登录统一跳 `/admin/login`。
- `src/components/RootNav.tsx:12` 到 `src/components/RootNav.tsx:22` 仍展示旧前台导航。
- `src/components/RootNav.tsx:101` 到 `src/components/RootNav.tsx:106` 未登录入口仍指向 `/admin/login`。
- `src/app/page.tsx`

当前实现：

- `PUBLIC_PAGES` 包含 `/articles`、`/discover`、`/explore`、`/search`、`/review`、`/cards`、`/register`。
- `PUBLIC_APIS` 包含 `/api/search`。
- `/` 未登录跳 `/admin/login?redirect=/`。

需求冲突：

- `/cards` 应登录后私有列表，不能公开。
- `/search` 应登录后可用，不能公开。
- `/review` 应登录后可用。
- `/discover`、`/explore`、`/my-articles` 后续删除。
- `/` 未登录应跳 `/login`，不是 `/admin/login`。

### 文章与审核

证据：

- `prisma/schema.prisma:173` 到 `prisma/schema.prisma:176` 的 `bookmarked/read/ignored` 是全局字段。
- `src/app/api/admin/content-items/review/route.ts:65` 到 `src/app/api/admin/content-items/review/route.ts:80` reject 时删除全部关联素材卡。
- `src/app/api/articles/route.ts`
- `src/app/api/content-items/[id]/generate-card/route.ts`

当前实现：

- `ContentItem.adminReviewStatus` 支持 `pending_ai / pending_admin / approved / rejected`。
- force approve 已要求 note。
- 非 ADMIN 内容可见性有 `adminReviewStatus=approved` 过滤。

需求冲突：

- reject 当前执行 `tx.materialCard.deleteMany({ where: { contentItemId: { in: ids } } })`，会删除用户私有卡。
- 需求要求 reject/downlist 下架不删卡，禁止新生成，并标记下架。
- `ContentItem.read/bookmarked/ignored` 是全局字段，不符合用户私有学习状态要求。

### 素材卡

证据：

- `prisma/schema.prisma:220` 到 `prisma/schema.prisma:252` 定义 `MaterialCard`，有 `ownerUserId`，但没有 `archivedAt/deletedAt`。
- `src/app/cards/page.tsx`
- `src/app/cards/[id]/page.tsx`
- `src/app/api/material-cards/[id]/route.ts`
- `src/app/api/content-items/[id]/generate-card/route.ts`

当前实现：

- `MaterialCard.ownerUserId` 已存在。
- 私有卡有 partial unique index 注释。
- generate-card 路由要求 `requireVerifiedUser`。

风险/冲突：

- 详情跳转在 Playwright 中不稳定。
- 普通跨 owner 访问应返回 404，需要确认当前 API 和页面全链路一致。
- 删除语义需求为软删除/归档，但 schema 当前没有 `archivedAt/deletedAt` 字段。
- 重新生成覆盖、二次确认、复习状态重置尚需落地。

### 收藏与复习

证据：

- `prisma/schema.prisma:254` 到 `prisma/schema.prisma:267` 的 `ArticleFavorite` 仅有收藏关系，没有复习状态字段。
- `src/app/api/favorites/*`
- `src/app/review/page.tsx`
- `src/app/api/review/route.ts`

当前实现：

- `ArticleFavorite` 已存在，但字段只有 `id/userId/contentItemId/createdAt`。

需求缺口：

- 收藏文章复习需要用户独立复习状态。
- 当前 ArticleFavorite 缺少掌握状态、下次复习时间等复习字段。
- `/review` 需要“收藏文章 / 素材卡”Tab，按角色展示。

### AI 配置

证据：

- `src/services/ai.ts`
- `src/app/api/content-items/[id]/generate-card/route.ts`
- `src/app/settings/ai/page.tsx`

当前实现：

- 用户生成卡片时传 owner userId，服务层要求用户 AI 配置。
- 当前方向基本符合“个人 AI key”。

需核查：

- 缺个人 AI 配置时前端是否明确引导配置。
- USER 是否完全看不到 AI 配置入口。

### IMA 同步

证据：

- `src/services/ima-sync.ts:20` 到 `src/services/ima-sync.ts:47` 明确写着优先用户配置、回退环境变量。
- `src/services/ima-sync.ts:124` 到 `src/services/ima-sync.ts:174` 上传仍可使用 env fallback。
- `src/services/ima-sync.ts:218` 到 `src/services/ima-sync.ts:253` 主同步入口当前围绕素材卡。
- `src/app/settings/ima/page.tsx`
- `src/app/api/settings/ima-targets/route.ts`
- `prisma/schema.prisma`

当前实现：

- `ImaTarget` 已存在。
- `resolveImaConfig(userId)` 优先找用户 target。

需求冲突：

- 找不到用户 target 后 fallback 到 `IMA_API_BASE/IMA_API_KEY/IMA_KNOWLEDGE_BASE_ID` env。
- 需求要求所有用户包括 ADMIN 都必须使用自己的 `ImaTarget`，不允许 env fallback。
- 需求要求 IMA 同步文章 + 素材卡；当前主链路偏素材卡同步。

### WeWe RSS 与来源

证据：

- `src/app/integrations/wewe-rss/page.tsx:1` 到 `src/app/integrations/wewe-rss/page.tsx:5` 公开路径直接 redirect 到后台管理路径。
- `src/app/admin/integrations/wewe-rss/page.tsx`
- `src/app/api/settings/integrations/wewe-rss/*`
- `src/app/api/integrations/wewe-rss/*`

当前实现：

- `/integrations/wewe-rss` 当前直接 redirect 到 `/admin/integrations/wewe-rss`。

需求冲突：

- `/integrations/wewe-rss` 应是公开权限说明页。
- 真正管理和同步只允许 ADMIN 在 `/admin/integrations/wewe-rss`。

### 管理后台

证据：

- `src/components/admin/AdminShell.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/api/admin/users/[id]/route.ts:54` 到 `src/app/api/admin/users/[id]/route.ts:56` 直接 `await request.json()`。
- `src/app/api/admin/users/[id]/route.ts:132` 到 `src/app/api/admin/users/[id]/route.ts:172` 仍提供物理删除用户。
- `src/app/admin/logs/page.tsx:230` 到 `src/app/admin/logs/page.tsx:259` map 返回 Fragment shorthand，key 放在内部 `TableRow`。

当前实现：

- AdminShell 客户端校验 ADMIN。
- 用户管理支持创建、角色/状态修改、密码重置、删除。
- 最后一个 ADMIN 降级/禁用有保护。

需求冲突/缺陷：

- 本阶段不允许删除用户，应以禁用代替。
- Admin Users 创建成功后新用户必须立即可见，当前 Playwright 发现不可见。
- `PUT /api/admin/users/[id]` 空/坏 JSON 会触发 request.json 异常。
- AdminLogsPage map 返回 Fragment shorthand，key warning。
- 审计日志应覆盖所有关键写操作并脱敏，目前需要全量核查。

## 4. 已发现 Bug 与证据

### P1：Admin Users 创建用户后表格不显示新用户

证据：

- 失败测试：`e2e/admin.spec.ts` 创建用户成功场景。
- 现象：toast 成功，但表格未出现新用户名。
- 代码路径：`src/app/admin/users/page.tsx` 创建后调用 `fetchUsers()`。
- 2026-06-13 重新运行聚焦 Playwright 前，global setup 被数据库连接问题阻塞，未进入该场景断言。

预期：

- 创建成功后新用户必须立即可见。

待补证据：

- 捕获 POST `/api/admin/users` 响应。
- 捕获创建后 GET `/api/admin/users` 响应。
- 判断是否为刷新 race、排序、分页、筛选或测试选择器问题。

### P1：素材卡详情跳转/加载不稳定

证据：

- 失败测试：`e2e/cards.spec.ts` 点击卡片跳转详情、详情页加载。
- 现象：点击后 URL 不变或详情页停留 `加载中...`。
- 代码路径：`src/app/cards/page.tsx`、`src/app/cards/[id]/page.tsx`、`src/app/api/material-cards/[id]/route.ts`。
- 2026-06-13 重新运行聚焦 Playwright 前，global setup 被数据库连接问题阻塞，未进入该场景断言。

预期：

- 点击素材卡进入 `/cards/[id]`。
- 详情标题/内容与被点击卡片一致。
- Owner/Admin 可见；其他用户 404。

### P2：AdminLogsPage React key warning

证据：

- `src/app/admin/logs/page.tsx`
- `data.map()` 返回 `<>...</>`。
- key 放在内部 `TableRow` 上，不在 Fragment 上。

预期：

- 使用 `<Fragment key={log.id}>`。
- console 不再出现 unique key warning。

### P1：`PUT /api/admin/users/[id]` malformed JSON 产生服务端异常

证据：

- `src/app/api/admin/users/[id]/route.ts` 直接 `await request.json()`。
- 空 body / 坏 JSON 会抛 `Unexpected end of JSON input`。

预期：

- 返回 400 `{ error: "请求体必须是有效 JSON" }`。
- 不产生服务端异常日志。

相关：

- `POST /api/admin/users` 也需检查是否有相同问题。

### P1：Playwright globalSetup 被数据库连接关闭阻塞

证据：

- 命令：`pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`
- 结果：失败于 global setup，未进入 Admin Users 场景。
- 命令：`pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情：页面加载" --project=admin`
- 结果：失败于 global setup，未进入素材卡场景。
- 共同错误：Prisma `P1017`，`Server has closed the connection`。
- seed 位置：`src/scripts/seed-e2e-accounts.ts:55`，`prisma.user.findUnique`。
- 登录 setup 位置：`e2e/global-setup.ts:122`，等待 admin 登录跳转超时。
- 第二次运行还出现 `/api/auth/login` 中 `ensureInitialAdmin()` 的 `db.user.count()` 触发 `P1017`，以及 `src/lib/logger.ts:35` 写 `SystemLog` 触发同类错误。
- 单独运行 `pnpm seed:e2e-accounts` 也稳定失败于同一 Prisma `P1017`，说明问题不依赖 Playwright 浏览器或目标 spec。
- 使用 `pg` 客户端直接执行 `select 1` 返回 `ECONNRESET`，说明连接在 PostgreSQL 握手/查询层被重置。
- `DATABASE_URL` 脱敏解析结果：host=`localhost`，port=`5432`，database=`shenlun_material_hub`，user=`shenlun`。
- TCP 探测 `localhost:5432` 成功，但 SQL 查询失败，说明端口开放不等于数据库服务可用。
- `docker compose ps` 在未补 `POSTGRES_PASSWORD` 时提示 compose 环境变量缺失；从 `DATABASE_URL` 临时派生密码后，`docker compose ps` 和 `docker ps` 仍 5 秒无响应。

预期：

- Playwright global setup 可以稳定 seed 测试账号并生成 admin storage state。
- global setup 阻塞解除后，再重新采集 Admin Users 和素材卡详情的浏览器证据。

当前判断：

- 直接根因不是 Playwright 选择器、业务 UI 或 Prisma 模型语句，而是本地 Docker/PostgreSQL 服务状态或 compose 环境状态异常。
- 按项目规则，不能自动启动 Docker 或执行数据库破坏性操作；需先恢复本地 Postgres 服务健康，再继续浏览器证据采集。

### P3：`pnpm lint` unused warnings

当前基线：

- 2026-06-13 重新运行 `pnpm lint`：0 errors / 18 warnings。

分类：

- 多数是清理问题。
- `enqueueAsyncTask`、`checkHealth`、`filteredCount` 等需判断是否逻辑遗漏。

## 5. 需求/代码冲突清单

| 优先级 | 冲突 | 证据 | 风险 |
|---|---|---|---|
| P0 | `/cards`、`/search`、`/review` 当前公开 | `src/proxy.ts` | 私有资产/学习入口权限错误 |
| P0 | 前台 `/login` 缺失，全站跳 `/admin/login` | `src/proxy.ts`, `src/app/page.tsx` | 前后台登录混淆 |
| P0 | reject 删除所有关联素材卡 | `src/app/api/admin/content-items/review/route.ts` | 用户私有资产丢失 |
| P0 | IMA fallback 到 env | `src/services/ima-sync.ts` | 用户数据同步到错误目标 |
| P1 | 全局 read/bookmarked/ignored | `prisma/schema.prisma` | 多用户学习状态污染 |
| P1 | Playwright globalSetup DB 连接关闭 | `src/scripts/seed-e2e-accounts.ts`, `e2e/global-setup.ts` | 阻塞浏览器证据采集 |
| P1 | `/integrations/wewe-rss` 直接跳后台 | `src/app/integrations/wewe-rss/page.tsx` | 公开说明页缺失 |
| P1 | 后台用户删除仍存在 | `src/app/api/admin/users/[id]/route.ts` | 与“禁用优先”冲突 |
| P1 | 旧路由仍存在 | `src/app/discover`, `src/app/explore`, `src/app/my-articles` | 前端 IA 分裂 |
| P2 | 素材卡软删除缺模型字段 | `prisma/schema.prisma` | 无法实现归档箱 |
| P2 | 收藏文章复习状态缺模型字段 | `ArticleFavorite` | USER 复习闭环不完整 |

## 6. 测试与验证现状

当前基线（2026-06-13 已重新运行）：

- `pnpm lint` 通过：0 errors / 18 warnings。
- `pnpm test` 通过：53 files / 371 tests。
- `pnpm build` 通过。
- 聚焦 Playwright 已尝试重新运行，但当前被 global setup 的 Prisma `P1017` 阻塞，未进入目标场景。

聚焦 Playwright 尝试结果：

- `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`：失败于 global setup；`seed:e2e-accounts` 在 `prisma.user.findUnique` 处报 `P1017`；admin 登录等待 `/admin` 跳转超时。
- `pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情：页面加载" --project=admin`：失败于 global setup；同样出现 `P1017`，并在 `/api/auth/login` 的初始管理员检查与日志写入处暴露数据库连接关闭。
- `pnpm seed:e2e-accounts`：单独运行失败，同样是 `P1017`。
- Node `pg` 最小查询：TCP 可连，SQL 查询 `ECONNRESET`。
- Docker/Compose 只读诊断：`docker ps`、补齐 `POSTGRES_PASSWORD` 后的 `docker compose ps` 均 5 秒无响应。

重点测试资产：

- 当前仓库测试资产统计：79 个测试文件，其中 26 个 Playwright E2E，53 个 Vitest 单元/组件/路由测试。
- `e2e/admin.spec.ts`
- `e2e/cards.spec.ts`
- `e2e/middleware.spec.ts`
- `e2e/api-security.spec.ts`
- `e2e/material-card-ownership.spec.ts`
- `e2e/data-isolation.spec.ts`
- `e2e/review.spec.ts`
- `e2e/search.spec.ts`
- `e2e/mobile-responsive.spec.ts`

测试覆盖判断：

- 单元/路由测试数量充足，适合先锁权限、审核、JSON 解析、IMA fallback、数据隔离等回归。
- E2E 已覆盖管理、卡片、文章、搜索、复习、移动端和错误态，但当前受本地数据库服务阻塞，不能作为完成证据继续扩大。
- 前端稳定选择器不统一：部分页面已有 `data-testid`，例如 `src/components/articles/ArticlesPage.tsx` 的来源筛选；但大量 E2E 仍依赖文本、CSS 或角色选择器，后续 UI 改造时需统一补稳定选择器。
- loading/empty/error 状态存在但不统一；空状态下一步行动需要按用户要求补齐，文章为空时应提示联系管理员。

## 7. 评估证据矩阵

| 范围 | 结论 | 关键证据 | 完成状态 |
|---|---|---|---|
| 文档入口 | 当前只保留 5 份有效 audit 文档，旧文档归档 | `docs/audit`, `docs/archive/2026-06-13-audit-reset/` | 已完成 |
| 权限路由 | 前台登录与保护路由不符合新需求 | `src/proxy.ts:5`, `src/proxy.ts:16`, `src/proxy.ts:110` | 已完成 |
| 前台 IA | 旧 `/discover`、`/explore`、`/my-articles` 仍在导航和路由中 | `src/components/RootNav.tsx:12`, `src/app/discover`, `src/app/explore`, `src/app/my-articles` | 已完成 |
| 数据安全 | reject 会删除用户素材卡 | `src/app/api/admin/content-items/review/route.ts:65` | 已完成 |
| 私有学习状态 | 文章阅读/收藏/忽略仍有全局字段，收藏复习字段不足 | `prisma/schema.prisma:173`, `prisma/schema.prisma:254` | 已完成 |
| 素材卡生命周期 | 有 owner 字段，缺软删除/归档字段 | `prisma/schema.prisma:235`, `prisma/schema.prisma:220` | 已完成 |
| IMA | 用户 target 后仍 fallback env，不符合确认需求 | `src/services/ima-sync.ts:20`, `src/services/ima-sync.ts:40` | 已完成 |
| WeWe RSS | 公开说明页缺失，路径直接跳后台 | `src/app/integrations/wewe-rss/page.tsx:1` | 已完成 |
| 后台用户 | 仍有物理删除，PUT malformed JSON 未统一 400 | `src/app/api/admin/users/[id]/route.ts:55`, `src/app/api/admin/users/[id]/route.ts:165` | 已完成 |
| AdminLogs | React key warning 有明确代码位置 | `src/app/admin/logs/page.tsx:230` | 已完成 |
| 测试基线 | lint/test/build 通过，Playwright 被 DB 阻塞 | 命令输出已写入本节 | 已完成 |
| 浏览器复现 | Admin Users/素材卡详情未重新触达断言 | Prisma `P1017`、Node `pg` `ECONNRESET` | 受环境阻塞，已记录 |

## 8. 风险分级

### P0：必须优先

- 路由权限错误。
- 前后台登录入口混乱。
- reject/downlist 删除用户私有卡。
- IMA env fallback。
- 私有素材卡跨 owner 访问。
- 禁用用户 session 立即失效全链路验证。

### P1：核心功能稳定性

- Admin Users 创建后不可见。
- 素材卡详情跳转/加载。
- malformed JSON 400。
- WeWe 公开说明页。
- 全局学习状态迁移方案。
- 后台用户删除改为禁用。

### P2：体验与数据模型完善

- 素材卡归档箱。
- 文章收藏复习状态。
- `/articles` Tab 合并。
- 旧路由删除。
- 移动端底部 Tab。
- 空状态下一步行动。

### P3：代码质量与 UI 改造

- lint unused warnings。
- UI 组件规范。
- TanStack/RHF 远期评估。
- visual regression 策略。

## 9. 建议执行顺序

1. 恢复本地 Docker/PostgreSQL 健康，只做非破坏性恢复。
2. 重新运行 T1-002/T1-003 聚焦 Playwright，补浏览器证据。
3. Batch 1：权限与数据安全。
4. Batch 2：用户与后台管理稳定性。
5. Batch 3：学习状态与素材卡生命周期。
6. Batch 4：前台 IA 与移动端。
7. Batch 5：UI 体系化改造。

## 10. 未验证风险

- 当前已重新运行 `pnpm lint/test/build`，均通过。
- 当前已尝试聚焦 Playwright，但被 global setup 数据库连接问题阻塞，Admin Users 与素材卡详情原始断言尚未重新触达。
- 部分旧文档中的历史结论可能已经被后续 commit 修复，只能作为参考，不能覆盖当前代码事实。
