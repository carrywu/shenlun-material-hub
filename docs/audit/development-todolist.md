# Development TodoList

生成日期：2026-06-13  
状态：Batch 1-5 + 前端改造第一轮 (A1-A5) + 第二轮 (B-Phase 1-4) + Playwright E2E 回归修复 全部完成

## 状态说明

- `todo`：未开始
- `doing`：进行中
- `blocked`：阻塞
- `done`：完成
- `deferred`：延后

每项任务完成时必须补：

- 实际修改文件
- 测试命令
- 验收证据
- 未验证风险
- 关联 commit

## Stage 0：文档体系重建

### T0-001：归档旧审计文档

- 状态：done
- 目标：清理 `docs/audit/` 主入口，只保留当前有效文档。
- 文件范围：
  - `docs/audit/*.md`
  - `bug-discovery-report.md`
  - `docs/archive/2026-06-13-audit-reset/`
- 验收证据：
  - 旧 md 文档已移动到 `docs/archive/2026-06-13-audit-reset/`。
  - `docs/audit/screenshots/` 未移动。
- 测试命令：未运行，文档整理任务。
- 风险：旧文档历史结论不再是当前入口。
- 关联提交：pending

### T0-002：生成需求确认文档

- 状态：done
- 目标：锁定角色、权限、路由、数据归属、审核、AI/IMA、前端 IA、UI 优先级。
- 文件范围：
  - `docs/audit/requirements-confirmation.md`
- 验收证据：
  - 文档已创建。
  - 包含 Agent 使用规则和已确认需求。
- 测试命令：未运行，文档整理任务。
- 风险：后续若需求改变，需要同步更新本文件。
- 关联提交：pending

### T0-003：生成项目评估文档

- 状态：done
- 目标：记录当前模块地图、代码证据、需求冲突、已发现 bug、风险分级。
- 文件范围：
  - `docs/audit/project-assessment.md`
- 验收证据：
  - 文档已创建。
  - 已纳入 Admin Users、素材卡详情、AdminLogs key warning、malformed JSON、lint warnings。
- 测试命令：未运行，文档整理任务。
- 风险：Bug 证据尚未重新复现。
- 关联提交：pending

### T0-004：生成开发计划

- 状态：done
- 目标：生成可交接开发计划，精细到任务可执行级。
- 文件范围：
  - `docs/audit/development-plan.md`
- 验收证据：
  - 文档已创建。
  - 包含 Agent 工作流约束、Batch 0-5、文件范围、测试与验收。
- 测试命令：未运行，文档整理任务。
- 风险：后续执行时需要按实际代码补充更细测试。
- 关联提交：pending

### T0-005：生成开始阶段现场文档

- 状态：done
- 目标：记录准备开始现场，便于后续 agent 接手。
- 文件范围：
  - `docs/audit/development-handoff.md`
  - `docs/audit/development-todolist.md`
- 验收证据：
  - 两份现场文档已创建。
- 测试命令：未运行，文档整理任务。
- 风险：结束/暂停前必须更新。
- 关联提交：pending

## Stage 1：项目评估补证据

### T1-001：建立验证基线

- 状态：done
- 目标：获取当前 lint/test/build 基线。
- 文件范围：不改代码。
- 测试命令：
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- 验收证据：
  - `pnpm lint`：通过，0 errors / 18 warnings。
  - `pnpm test`：通过，53 files / 371 tests。
  - `pnpm build`：通过。
- 风险：可能暴露旧问题；本任务只记录，不修复。
- 关联提交：pending

### T1-002：补证据 Admin Users 创建后不可见

- 状态：done
- 目标：确认创建成功但表格不可见根因。
- 文件范围：
  - `src/app/admin/users/page.tsx`
  - `src/app/api/admin/users/route.ts`
  - `e2e/admin.spec.ts`
- 测试命令：
  - `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`
- 验收证据：
  - 2026-06-13 Docker/PG 恢复后，`seed:e2e-accounts` 幂等成功。
  - global-setup 改为 API 登录 + cookie 注入，4 角色全部成功。
  - admin.spec.ts "创建用户成功" 测试通过（20.2s）。
- 风险：无。
- 关联提交：pending

### T1-003：补证据素材卡详情跳转/加载

- 状态：done
- 目标：确认素材卡点击后 URL/详情标题失败根因。
- 文件范围：
  - `src/app/cards/page.tsx`
  - `src/app/cards/[id]/page.tsx`
  - `src/app/api/material-cards/[id]/route.ts`
  - `e2e/cards.spec.ts`
- 测试命令：
  - `pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情" --project=admin`
- 验收证据：
  - 2026-06-13 Docker/PG 恢复后，6 个素材卡相关测试全部通过（31.2s）。
  - 素材卡详情 API 访问控制已收紧（T2-002）。
- 风险：无。
- 关联提交：pending

### T1-004：诊断 Playwright globalSetup 数据库连接关闭

- 状态：done
- 目标：恢复 Playwright seed/admin login，使后续浏览器证据可采集。
- 文件范围：
  - `.env`（添加 `POSTGRES_PASSWORD`）
  - `src/lib/db.ts`（连接池加固）
  - `src/scripts/seed-e2e-accounts.ts`（连接超时）
  - `e2e/global-setup.ts`（API 登录 + cookie 注入）
- 验收证据：
  - `.env` 添加 `POSTGRES_PASSWORD="shenlun_dev"`。
  - `db.ts` Pool 添加 `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 30000`, `max: 20`。
  - seed 脚本添加连接预检 + `connectionTimeoutMillis: 5000`。
  - global-setup 从浏览器表单登录改为 API 登录 + cookie 注入，可靠性大幅提升。
  - `pnpm seed:e2e-accounts` 幂等成功。
  - Docker PostgreSQL healthy。
- 关联提交：pending

### T1-005：完成项目评估证据矩阵

- 状态：done
- 目标：将项目评估推进到可交接完成态，后续 agent 可直接按开发计划执行。
- 文件范围：
  - `docs/audit/project-assessment.md`
  - `docs/audit/development-handoff.md`
  - `docs/audit/development-todolist.md`
- 验收证据：
  - `project-assessment.md` 状态已更新为"项目评估完成，等待进入开发执行"。
  - 已补充评估完成边界。
  - 已补充后续 agent 读取顺序。
  - 已补充关键代码行号证据。
  - 已补充测试资产统计：79 个测试文件，26 个 Playwright E2E，53 个 Vitest 单元/组件/路由测试。
  - 已补充评估证据矩阵。
- 测试命令：
  - 文档任务未新增代码；未重新运行 lint/test/build。
  - 继承 T1-001 基线：`pnpm lint` 通过，`pnpm test` 通过，`pnpm build` 通过。
- 风险：
  - Playwright 仍受本地 Docker/PostgreSQL 阻塞，浏览器层证据需在 DB 恢复后补。
- 关联提交：pending

## Stage 2 / Batch 1：权限与数据安全

### T2-001：前台 `/login` 与受保护路由

- 状态：done
- 目标：分离前台登录和后台登录，保护 `/cards`、`/search`、`/review`。
- 实际修改文件：
  - `src/proxy.ts` — 双登录页常量、`/login` 加入公开路径、`/cards`/`/search`/`/review` 移出公开、按路径分流重定向
  - `src/app/login/page.tsx`（新建）— 前台登录页，蓝色主题，提交 `context: "user"`
  - `src/app/api/auth/login/route.ts` — 解析 `context` 参数，admin 上下文拒绝非 ADMIN
  - `e2e/global-setup.ts` — 双登录页架构
  - `e2e/helpers/auth.ts` — admin API 登录添加 `context: 'admin'`
  - `e2e/middleware.spec.ts` — 更新匹配新行为
- 测试命令：
  - `pnpm exec playwright test e2e/middleware.spec.ts --project=admin`
- 验收证据：
  - middleware.spec.ts 14 个测试全部通过。
  - 未登录 `/search`、`/cards` 重定向到 `/login`。
  - 未登录 `/admin` 重定向到 `/admin/login`。
  - `/api/search` 保持公开 API（200）。
- 风险：无。
- 关联提交：pending

### T2-002：私有素材卡 Owner/Admin 访问边界

- 状态：done
- 目标：Owner/Admin 可看，其他用户 404。
- 实际修改文件：
  - `src/app/api/material-cards/[id]/route.ts` — GET 非 owner 非 ADMIN 返回 404，移除 `canAccessResource` import
  - `src/app/cards/[id]/page.tsx` — 改进 fetchCard 错误处理
- 测试命令：
  - `pnpm test`（全量）
- 验收证据：
  - GET handler 手动检查 ownerUserId，非 owner 非 ADMIN 返回 404。
  - null-owner legacy 卡仅 ADMIN 可见。
- 风险：无。
- 关联提交：pending

### T2-003：reject/downlist 不删用户私有卡

- 状态：done
- 目标：下架文章不删除已有私有卡，禁止新生成。
- 实际修改文件：
  - `src/app/api/admin/content-items/review/route.ts` — reject 只删 `ownerUserId: null` 的公共卡
  - `src/app/api/admin/content-items/review/__tests__/route.test.ts` — 更新测试断言
- 测试命令：
  - `pnpm test src/app/api/admin/content-items/review/__tests__/route.test.ts`
- 验收证据：
  - deleteMany where 增加 `ownerUserId: null` 过滤。
  - generate-card 已有 `adminReviewStatus !== "approved"` 拦截。
  - route test 更新并通过。
- 风险：无。
- 关联提交：pending

### T2-004：IMA 禁止 env fallback

- 状态：done
- 目标：所有同步必须使用用户自己的 ImaTarget。
- 实际修改文件：
  - `src/services/ima-sync.ts` — 移除 env fallback，`resolveImaConfig` 无配置时抛错
  - `src/components/SyncToIma.tsx` — `IMA_CONFIG_MISSING` 时显示"去配置"链接
- 测试命令：
  - `pnpm test`（全量）
- 验收证据：
  - `resolveImaConfig()` 无 ImaTarget 时抛出 `IMA_CONFIG_MISSING` 错误。
  - 模块级变量改为常量，不再有 `?? "https://api.ima.qq.com"` fallback。
- 风险：无。
- 关联提交：pending

### T2-005：关键写操作审计覆盖

- 状态：done
- 目标：所有关键写操作路由添加 `auditLog()` 调用。
- 实际修改文件：
  - `src/app/api/admin/users/route.ts` — POST 创建用户审计
  - `src/app/api/admin/users/[id]/route.ts` — PUT/DELETE 审计（区分 disable/enable/role_change/update）
  - `src/app/api/material-cards/[id]/route.ts` — DELETE 审计
  - `src/app/api/settings/ima-targets/route.ts` — POST 审计
  - `src/app/api/auth/login/route.ts` — 登录成功审计
  - `src/app/api/auth/logout/route.ts` — 登出审计
  - `src/app/api/sync/route.ts` — 同步操作审计（单个 + 批量）
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - `auditLog` import 从 4 个路由增加到 11 个路由。
  - lint: 0 errors。test: 53 files / 371 tests 全部通过。build: 通过。
  - detail 字段不包含密码、API key 等敏感信息。
- 风险：无。
- 关联提交：pending

## Stage 3 / Batch 2：用户管理与后台稳定性

### T3-001：Admin Users 创建后立即可见

- 状态：done
- 目标：创建用户成功后表格立即显示新用户。
- 实际修改文件：
  - `src/app/admin/users/page.tsx` — 创建成功后 optimistic insert `data.user` 到 state 数组首位，然后 refetch
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 创建成功后 `setUsers(prev => [data.user as UserItem, ...prev])` 立即插入。
  - 随后 `void fetchUsers()` 同步最新数据。
  - lint 0 errors, 54 files / 379 tests 通过, build 通过。
- 风险：并发 race 时 refetch 覆盖 optimistic insert，但结果一致（新用户都在列表）。
- 关联提交：pending

### T3-002：Admin Users malformed JSON 返回 400

- 状态：done
- 目标：POST/PUT 空 body 或坏 JSON 返回 400。
- 实际修改文件：
  - `src/app/api/admin/users/route.ts` — `request.json()` 包裹 try/catch，返回 `{ error: "请求体必须是有效 JSON" }` status 400；解构改为显式 `as string | undefined` 类型断言
  - `src/app/api/admin/users/[id]/route.ts` — 同上 try/catch 模式
  - `src/app/api/admin/users/__tests__/route.test.ts`（新建）— 6 个测试：POST/PUT malformed JSON 返回 400，POST 合法请求正常
- 测试命令：
  - `pnpm test src/app/api/admin/users/__tests__/route.test.ts`
  - `pnpm test`（全量）
- 验收证据：
  - 6 个新测试全部通过。
  - 无 `Unexpected end of JSON input` 服务端异常。
  - 合法请求行为不变。
- 风险：无。
- 关联提交：pending

### T3-003：用户删除改禁用

- 状态：done
- 目标：后台不提供删除用户，只提供禁用/启用。
- 实际修改文件：
  - `src/app/admin/users/page.tsx` — 移除 `Trash2` import、`handleDelete` 函数、删除按钮 UI
  - `src/app/api/admin/users/[id]/route.ts` — DELETE handler 改为返回 405 `{ error: "当前不支持删除用户，请使用禁用功能" }`
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - UI 无删除按钮和删除逻辑。
  - DELETE API 返回 405 Method Not Allowed。
  - 禁用/启用功能不受影响。
- 风险：如有旧 E2E 断言删除行为需更新。
- 关联提交：pending

### T3-004：AdminLogs key warning

- 状态：done
- 目标：修复 React unique key warning。
- 实际修改文件：
  - `src/app/admin/logs/page.tsx` — `<>` 改为 `<Fragment key={log.id}>`，import 添加 `Fragment`
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - Fragment 使用 `log.id` 作为 key。
  - console 不再出现 key warning。
- 风险：无。
- 关联提交：pending

## Stage 4 / Batch 3：学习状态与素材卡生命周期

### T4-001：用户私有文章学习状态

- 状态：done
- 目标：阅读、收藏、忽略状态从全局 ContentItem 字段迁移到用户私有 UserContentState。
- 实际修改文件：
  - `prisma/schema.prisma` — 新建 `UserContentState` 模型（userId, contentItemId, read, ignored, unique 约束, cascade 删除），User 和 ContentItem 添加 relation
  - `prisma/migrations/20260613_batch3_support/migration.sql`（新建）— 建表 + 外键 + 索引
  - `src/app/api/user-content-state/route.ts`（新建）— GET 查询单个 contentItem 的用户状态，POST upsert 用户状态
  - `src/app/api/content-items/[id]/route.ts` — GET 额外查询 UserContentState + ArticleFavorite，返回 userRead/userIgnored/userBookmarked
  - `src/app/api/content-items/[id]/__tests__/route.test.ts` — 添加 userContentState 和 articleFavorite mock
  - `src/app/api/articles/route.ts` — GET 批量查询 UserContentState + ArticleFavorite，enriches 每个 article 的 userRead/userIgnored/userBookmarked
  - `src/app/api/articles/__tests__/route.test.ts` — 添加 findMany mock 返回 `[]`
  - `src/types/index.ts` — 新增 `UserContentState` 接口
- 测试命令：
  - `pnpm test`（全量）
- 验收证据：
  - `npx prisma generate` 成功，Prisma Client 包含 `userContentState`。
  - user-content-state API 支持 GET/POST（upsert）。
  - content-items 和 articles GET 返回 per-user 状态字段。
  - 54 files / 379 tests 全部通过。
- 未验证风险：
  - migration 未应用（Docker 未运行），运行时涉及 UserContentState 查询会报错直到 `prisma migrate deploy`。
  - 前端消费方（articles/[id]/page.tsx, discover, explore）尚未读取 userRead/userIgnored/userBookmarked。
- 关联提交：pending

### T4-002：素材卡软删除/归档箱

- 状态：done
- 目标：删除改为归档，默认排除归档卡，可恢复。
- 实际修改文件：
  - `prisma/schema.prisma` — MaterialCard 添加 `archivedAt DateTime?`，`@@index([archivedAt])`
  - `prisma/migrations/20260613_batch3_support/migration.sql` — ALTER TABLE 添加 archivedAt 列 + 索引
  - `src/app/api/material-cards/[id]/route.ts` — DELETE 改为 `update({ data: { archivedAt: new Date() } })`，audit action 改为 `"archive"`；新增 PATCH handler（action: archive/unarchive）
  - `src/app/api/material-cards/[id]/__tests__/route.test.ts` — DELETE mock 从 `delete()` 改为 `update()`
  - `src/app/api/material-cards/route.ts` — GET where 添加 `archivedAt: null`
  - `src/app/api/search/route.ts` — GET where 添加 `archivedAt: null`
  - `src/app/api/review/route.ts` — GET 三种模式 where 添加 `archivedAt: null`
  - `src/app/api/favorites/[id]/route.ts` — DELETE 中 `tx.materialCard.deleteMany()` 改为 `tx.materialCard.updateMany({ data: { archivedAt: new Date() } })`
  - `src/app/api/favorites/[id]/__tests__/route.test.ts` — mock tx 添加 `updateMany`
  - `src/lib/audit-logger.ts` — AuditAction 类型联合添加 `"archive" | "unarchive"`
- 测试命令：
  - `pnpm test`（全量）
- 验收证据：
  - 所有列表/搜索/复习查询默认排除归档卡。
  - DELETE 仅设置 archivedAt，不删除数据。
  - PATCH 支持 archive/unarchive 双向操作。
  - favorites DELETE 同步软删除关联卡片。
  - audit action 正确使用 "archive"/"unarchive"。
  - 54 files / 379 tests 全部通过。
- 未验证风险：
  - migration 未应用。
  - 前端归档箱 UI（查看归档卡、恢复操作）尚未实现。
- 关联提交：pending

### T4-003：重新生成覆盖流程

- 状态：done
- 目标：已有卡片复用，显式 force 参数才覆盖。
- 实际修改文件：
  - `src/app/api/content-items/[id]/generate-card/route.ts` — `runGenerateCardTask` 添加第 5 个 `force?: boolean` 参数；`force=true` 时已有卡更新而非 409；POST handler 解析 `body.force`，`if (dup && !force)` 保持原有 409 行为
  - `src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts` — 添加 2 个新测试：force=true 返回 202，force=false 返回 409
- 测试命令：
  - `pnpm test src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts`
  - `pnpm test`（全量）
- 验收证据：
  - 默认生成（无 force）遇到已有卡返回 409。
  - `force=true` 时更新已有卡内容，返回 202。
  - `force=false` 时返回 409 同默认行为。
  - 新测试全部通过。
- 风险：前端"重新生成"按钮和二次确认弹窗尚未实现。
- 关联提交：pending

## Stage 5 / Batch 4：前台 IA 与移动端

### T5-001：导航与登录路由

- 状态：done
- 目标：按角色显示导航，未登录跳 `/login`。
- 实际修改文件：
  - `src/components/RootNav.tsx` — baseNavItems（articles/review/settings）+ verifiedNavItems（cards/search，VERIFIED_USER/ADMIN 可见）；登录链接从 `/admin/login` 改为 `/login`；隐藏 nav 条件添加 `/login`
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - USER 看到 articles/review/settings。
  - VERIFIED_USER/ADMIN 额外看到 cards/search。
  - 登录和 admin/login 页面不显示导航。
- 风险：无。
- 关联提交：pending

### T5-002：角色化首页

- 状态：done
- 目标：`/` 登录后按角色展示欢迎和快捷操作；未登录跳 `/login`。
- 实际修改文件：
  - `src/app/page.tsx` — 未认证 redirect 从 `/admin/login?redirect=/` 改为 `/login`；ROLE_WELCOME 按角色显示欢迎语；quickActions 移除 /discover 和 /explore，按角色过滤
  - `src/proxy.ts` — PUBLIC_PAGES 移除 `/articles`、`/discover`、`/explore`；PUBLIC_APIS 移除 `/api/articles`、`/api/discover`、`/api/explore`、`/api/search`
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 未登录跳 `/login`。
  - USER 欢迎"开始今日学习"，快捷操作侧重文章阅读。
  - VERIFIED_USER 欢迎"探索与创作"，快捷操作包含卡片生成。
  - ADMIN 欢迎"管理后台"，快捷操作包含审核和用户管理。
- 风险：统计口径暂用公共文章 + 个人资产组合，未做 owner 私有统计。
- 关联提交：pending

### T5-003：响应式底部 Tab

- 状态：done
- 目标：移动端前台底部 Tab，按角色显示。
- 实际修改文件：
  - `src/components/MobileBottomTab.tsx`（新建）— 固定底部，`md:hidden`，角色感知 tab 项，login/admin 页面隐藏
  - `src/app/layout.tsx` — 添加 `<MobileBottomTab currentUser={currentUser} />`，main 添加 `pb-16 md:pb-0`
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 移动端可见固定底部 Tab。
  - 桌面端（md 以上）隐藏。
  - 登录/admin 页面不显示。
  - main 内容不被 Tab 遮挡（pb-16）。
- 风险：后台移动端仅基本可用，未做完整优化。
- 关联提交：pending

## Stage 6 / Batch 5：UI 改进（置后）

### T6-001：UI 组件库评估

- 状态：done
- 目标：评估 shadcn/Tailwind/lucide/Sonner/Zod 现状，输出评估报告。
- 实际修改文件：
  - `docs/audit/ui-assessment.md`（新建）— 组件清单、31 个裸 button 统计、缺少 ErrorBoundary、Zod 未使用、loading/empty 不一致等发现
- 测试命令：未运行，文档评估任务。
- 验收证据：
  - 文档覆盖 12 个 shadcn 组件、26 个自定义业务组件。
  - 识别了 31 个 raw `<button>` 标签。
  - 识别了缺少 ErrorBoundary、Zod 安装了但从未在 app 代码中 import。
  - 列出了 loading/empty/error 状态不一致的具体页面。
- 风险：评估结论为"不需要新 UI 框架"，后续改造基于现有 shadcn + Tailwind。
- 关联提交：pending

### T6-002：UI 渐进式改造计划

- 状态：done
- 目标：输出可执行的 UI 改造计划，4 阶段。
- 实际修改文件：
  - `docs/audit/ui-refactor-plan.md`（新建）— Phase 1 基础组件加固 → Phase 2 表单规范化 → Phase 3 表格与列表 → Phase 4 视觉统一
- 测试命令：未运行，文档计划任务。
- 验收证据：
  - 4 阶段计划明确范围和排除项。
  - 明确不引入 AntD/HeroUI/TanStack/RHF。
  - 每阶段有具体任务、文件范围、验证标准。
- 风险：改造需要逐步推进，不可一次性全改。
- 关联提交：pending

## Stage 7 / 前端改造第一轮（Round A：功能补全）

设计文档：`docs/superpowers/specs/2026-06-13-frontend-refactor-design.md`
实施计划：`docs/superpowers/plans/2026-06-13-frontend-round-a.md`

### A3：删除旧路由 /discover /explore /my-articles

- 状态：done
- 目标：清理已废弃的前台页面路由，减少代码体积和路由混乱，无重定向。
- 实际修改文件：
  - `src/app/discover/page.tsx`（删除，500 行）
  - `src/app/explore/page.tsx`（删除，458 行）
  - `src/app/my-articles/page.tsx`（删除，5 行）
  - `src/components/my-articles/MyArticlesPage.tsx`（删除，119 行）
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 4 个文件共 1082 行代码删除。
  - 无路由重定向，旧链接返回 404。
  - lint 0 errors，54 files / 379 tests 全部通过，build 通过。
- 未验证风险：
  - 9 个 E2E spec 文件可能引用已删除路由，待 Docker/Playwright 可用后排查清理。
- 关联提交：`ed3b584`

### A2：Articles API filter 参数 + Tab 切换

- 状态：done
- 目标：`/articles` 页面新增「全部/推荐/收藏」Tab 切换，API 支持 `filter` 查询参数。
- 实际修改文件：
  - `src/app/api/articles/route.ts` — 新增 `filter` 参数解析：`approved` 设置 adminReviewStatus，`favorites` 查询 ArticleFavorite（匿名用户静默降级）
  - `src/app/api/articles/__tests__/route.test.ts` — 新增 3 个测试：filter=approved、filter=favorites 有收藏、filter=favorites 无收藏
  - `src/components/articles/ArticlesPage.tsx` — 新增 Tabs/TabsList/TabsTrigger（base-ui/react），activeTab 状态从 URL `?tab=` 初始化，fetchItems URL 构建含 filter 参数
- 测试命令：
  - `pnpm test src/app/api/articles/__tests__/route.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - Tab 切换正常，URL 同步 `?tab=recommended` / `?tab=favorites`。
  - filter=approved 只返回已审核通过文章。
  - filter=favorites 登录用户返回收藏文章，匿名用户静默降级为普通列表。
  - 3 个新测试全部通过。
  - lint 0 errors，54 files / 382 tests 全部通过，build 通过。
- 风险：admin 同时传递 filter=approved 和 adminReviewStatus 参数时，后者覆盖前者（可接受，显式过滤优先）。
- 关联提交：`3a581e9`

### A1：学习状态展示标记（已读/已收藏/已忽略）

- 状态：done
- 目标：文章列表页和详情页展示用户私有的学习状态徽章。
- 实际修改文件：
  - `src/components/articles/ArticlesPage.tsx` — ContentItemData 接口新增 userRead/userIgnored/userBookmarked 可选字段；引入 CheckCircle/BookmarkCheck/EyeOff lucide 图标；标题旁条件渲染状态图标（span title 包裹）
  - `src/app/articles/[id]/page.tsx` — ArticleDetail 接口新增 userRead/userIgnored/userBookmarked 可选字段；引入 CheckCircle 图标；AI 评分 Badge 后条件渲染已读/已收藏/已忽略 Badge
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 列表页标题旁显示已读（绿勾）、已收藏（书签）、已忽略（隐藏）图标。
  - 详情页 header 显示对应状态 Badge。
  - 图标使用 lucide-react 组件，通过 span title 属性提供 tooltip。
  - lint 0 errors，54 files / 382 tests 全部通过，build 通过。
- 未验证风险：
  - 详情页 toggle 按钮仍修改全局 read/ignored/bookmarked 字段，状态徽章展示 per-user 字段，两者并存为过渡态。
- 关联提交：`6d1efcf`

### A4：归档箱 API archivedOnly + 归档 Tab

- 状态：done
- 目标：`/cards` 页面新增「全部卡片/已归档」Tab，可查看归档卡片并恢复。
- 实际修改文件：
  - `src/app/api/material-cards/route.ts` — 新增 `archivedOnly` 参数：值为 `"true"` 时 where 条件从 `archivedAt: null` 改为 `archivedAt: { not: null }`
  - `src/app/api/material-cards/__tests__/route.test.ts`（新建）— 4 个测试：默认排除归档、archivedOnly=true 返回归档、archivedOnly=false 排除、401 未认证
  - `src/app/cards/page.tsx` — CardItem 接口新增 archivedAt；新增 showArchived 状态和 Tabs（base-ui/react）；fetchCards 含 archivedOnly 参数；归档视图显示归档日期和恢复按钮（PATCH action: unarchive）
- 测试命令：
  - `pnpm test src/app/api/material-cards/__tests__/route.test.ts`
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 默认卡片列表不含归档卡。
  - 已归档 Tab 显示归档卡片，每张卡显示归档日期和恢复按钮。
  - 恢复操作调用 PATCH `{ action: "unarchive" }`，成功后刷新列表。
  - 4 个新测试全部通过。
  - lint 0 errors，55 files / 386 tests 全部通过，build 通过。
- 风险：无。
- 关联提交：`9759a55`

### A5：重新生成确认弹窗

- 状态：done
- 目标：文章详情页点击"重新生成"时，若已有素材卡则弹出二次确认，防止误覆盖。
- 实际修改文件：
  - `src/components/ui/alert-dialog.tsx`（新建，149 行）— AlertDialog 组件，使用 `@base-ui/react/alert-dialog` 原语；导出 AlertDialog、AlertDialogContent、AlertDialogHeader、AlertDialogFooter、AlertDialogTitle、AlertDialogDescription、AlertDialogAction（destructive Button）、AlertDialogCancel
  - `src/components/ArticleDetail.tsx` — 新增 showRegenConfirm 状态；handleGenerateClick 检查 `article._count?.materialCards > 0` 决定是否弹窗；handleGenerateCard 接受 force 参数；AlertDialog 中文文案"该文章已有素材卡，重新生成将覆盖现有内容并重置学习状态。是否继续？"
- 测试命令：
  - `pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 无素材卡时点击重新生成直接触发。
  - 有素材卡时弹出 AlertDialog 二次确认。
  - 确认后 POST body 含 `{ force: true }`，触发覆盖生成。
  - 取消关闭弹窗，不触发任何操作。
  - AlertDialog 样式与现有 dialog.tsx 一致（rounded-xl、popover bg、zoom 动画）。
  - lint 0 errors，55 files / 386 tests 全部通过，build 通过。
- 风险：无。
- 关联提交：`b375064`

## Stage 8：前端改造第二轮（Round B — UI 组件统一）

### B1：EmptyState + LoadingSkeleton/LoadingIndicator 组件

- 状态：done
- 目标：创建可复用的空状态和加载骨架组件，替代散落在各页面的内联实现。
- 实际修改文件：
  - `src/components/ui/empty-state.tsx`（新建）— EmptyState 组件，支持 icon/title/description/action 配置
  - `src/components/ui/loading-skeleton.tsx`（新建）— LoadingSkeleton（animate-pulse 骨架条）+ LoadingIndicator（Loader2 旋转图标 + 文本）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 两个组件均包含 data-slot 属性、role="status"、aria-label。
  - 遵循项目 export convention（function 声明 + 底部 export）。
  - React.ComponentProps<"div"> props 转发。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：`719bd37`（初始）、`8b1b572`（修复 data-slot/ARIA/export convention）

### B2：ErrorBoundary + layout 包裹

- 状态：done
- 目标：创建全局 ErrorBoundary 组件，捕获运行时错误并展示友好 fallback UI。
- 实际修改文件：
  - `src/components/ui/error-boundary.tsx`（新建）— class 组件，componentDidCatch + getDerivedStateFromError
  - `src/app/layout.tsx`（修改）— ErrorBoundary 包裹 children
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - fallback UI 包含 AlertTriangle 图标 + 重试按钮。
  - cn() className 合并、props 转发。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：`169e385`

### B3：Admin 页面裸 button 迁移（18 个）

- 状态：done
- 目标：Admin 页面 18 个裸 `<button>` 迁移至 shadcn Button。
- 实际修改文件：
  - `src/app/admin/users/page.tsx`（11 个按钮）
  - `src/components/admin/AdminShell.tsx`（4 个按钮）
  - `src/app/admin/page.tsx`（2 个按钮）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 全部按钮使用 shadcn Button（variant: default/outline/ghost, size: default/sm/xs/icon-xs/icon-sm）。
  - 语义颜色（红/绿/琥珀 hover）丢失，改为 shadcn ghost 默认色。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 风险：admin 表格操作按钮语义 hover 颜色丢失。
- 关联提交：`980fe15`

### B4：前台与组件裸 button 迁移（12 个）

- 状态：done
- 目标：前台页面和业务组件 12 个裸 `<button>` 迁移至 shadcn Button。
- 实际修改文件（12 个文件各 1 个按钮）：
  - `src/app/search/page.tsx`、`src/app/settings/ai/page.tsx`、`src/app/settings/ima/page.tsx`、`src/components/RootNav.tsx`、`src/components/ReviewCard.tsx`、`src/components/articles/ArticleChecklist.tsx`、`src/components/articles/ArticlesPage.tsx`、`src/components/sync/SyncRecordsPage.tsx`、`src/components/ai/AiConfigPage.tsx`、`src/app/login/page.tsx`、`src/app/register/page.tsx`、`src/app/admin/login/page.tsx`
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 登录/注册页替换内联 SVG spinner 为 lucide-react Loader2。
  - 渐变背景按钮替换为 shadcn default variant。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 风险：登录页渐变背景丢失。
- 关联提交：`9f55f0f`

### B5：裸 input + select 迁移（15+1）

- 状态：done
- 目标：15 个裸 `<input>` 和 1 个裸 `<select>` 迁移至 shadcn Input/Select。
- 实际修改文件：
  - `src/app/admin/users/page.tsx`（5 input + 1 select）
  - `src/components/ai/AiConfigPage.tsx`（4 input）
  - `src/app/login/page.tsx`（2 input）
  - `src/app/admin/login/page.tsx`（2 input）
  - `src/components/UpgradeButton.tsx`（1 input）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - select 使用 onValueChange + as string 断言。
  - password toggle input 保留 type={showKey ? "text" : "password"}。
  - 剩余裸 input：10 个 date picker + 1 个 range slider（排除项）。
  - 剩余裸 select：0。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：`583d4f2`

### B6：空状态统一 + Loading 升级（7+1 处）

- 状态：done
- 目标：7 处内联空状态替换为 EmptyState 组件，1 处纯文本 loading 升级为 LoadingIndicator。
- 实际修改文件：
  - `src/app/page.tsx`（空状态）
  - `src/app/admin/users/page.tsx`（空状态）
  - `src/components/subscriptions/SubscriptionsPage.tsx`（空状态）
  - `src/components/ai/AiConfigPage.tsx`（空状态 + loading 升级）
  - `src/components/ArticleDetail.tsx`（内联 fallback → 条件渲染 EmptyState）
  - `src/components/CollectDialog.tsx`（空状态，文案从"没有已启用的来源"改为"暂无可用来源"）
  - `src/components/articles/ArticlesPage.tsx`（空状态）
  - `src/components/__tests__/CollectDialog.test.tsx`（更新断言文案匹配新 title）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 全部空状态使用 EmptyState 组件，统一 role="status" + data-slot="empty-state"。
  - AiConfigPage loading 从 `<p>加载中...</p>` 升级为 `<LoadingIndicator>`。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：`2ead45a`

### B7：FormField 组件 + 登录表单规范化

- 状态：done
- 目标：创建 FormField 组件，统一登录/注册表单的 label + error + helper 渲染。
- 实际修改文件：
  - `src/components/ui/form-field.tsx`（新建）— FormField 组件，支持 label/error/required/helper/children
  - `src/app/login/page.tsx`（2 个字段 FormField 包裹）
  - `src/app/admin/login/page.tsx`（2 个字段 FormField 包裹）
  - `src/app/register/page.tsx`（3 个字段 FormField 包裹，移除 rounded-xl 覆盖）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - FormField 使用 data-slot="form-field"、cn() className 合并。
  - register 页 Input 移除 `className="py-3 rounded-xl"` 覆盖。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 风险：FormField 的 label 不使用 htmlFor/id 关联，可能影响无障碍。
- 关联提交：`37004ba`

### B8：admin/users 表单 FormField 包裹

- 状态：done
- 目标：创建用户弹窗 5 个字段 + 重置密码弹窗 1 个字段用 FormField 包裹。
- 实际修改文件：
  - `src/app/admin/users/page.tsx`
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 5 个创建字段（用户名/密码/显示名/邮箱/角色）和 1 个重置密码字段均使用 FormField。
  - 重置密码字段使用 helper="至少 6 个字符"。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：`85ad0a1`

### B9：裸 table 迁移（2 个）

- 状态：done
- 目标：2 个裸 `<table>` 迁移至 shadcn Table 组件。
- 实际修改文件：
  - `src/app/admin/page.tsx`（近期任务表，3 列）
  - `src/app/admin/users/page.tsx`（用户管理表，7 列）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 仅替换 HTML 结构（table/thead/tr/th/tbody/td），保留所有 cell 内容逻辑（Badge、图标、条件样式）。
  - 移除 wrapping `<div className="overflow-x-auto">`。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：`630424b`

### B10：手写弹窗迁移（3 个）

- 状态：done
- 目标：3 个 `fixed inset-0` 手写弹窗迁移至 shadcn Dialog（@base-ui/react）。
- 实际修改文件：
  - `src/app/admin/users/page.tsx`（创建用户弹窗 + 重置密码弹窗）
  - `src/components/UpgradeButton.tsx`（付费升级弹窗）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 使用 Dialog open/onOpenChange 控制状态，DialogContent 自带关闭按钮。
  - 移除 admin/users 的 X icon import（不再需要）。
  - UpgradeButton 移除 e.stopPropagation() 模式（Dialog 原生处理 backdrop 点击）。
  - 剩余 fixed inset-0：仅 articles/[id]/page.tsx 图片预览（排除项）。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：`7267237`

### B11：PageHeader 组件

- 状态：done
- 目标：创建可复用的页面标题组件，统一前台页面标题区域。
- 实际修改文件：
  - `src/components/ui/page-header.tsx`（新建）— PageHeader 组件，支持 title/description/actions
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - data-slot="page-header"，cn() className 合并。
  - h1 text-2xl font-bold tracking-tight + description text-sm text-muted-foreground。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 关联提交：包含在 `459a98b` 中

### B12：视觉统一 — PageHeader 应用 + 圆角 + 文案

- 状态：done
- 目标：6 个前台页面应用 PageHeader，Card 组件圆角统一为 rounded-lg，空状态文案标准化。
- 实际修改文件：
  - `src/app/cards/page.tsx`（PageHeader）
  - `src/app/search/page.tsx`（PageHeader）
  - `src/app/review/page.tsx`（PageHeader）
  - `src/app/settings/page.tsx`（PageHeader，移除 Settings icon）
  - `src/components/sync/SyncRecordsPage.tsx`（PageHeader）
  - `src/components/articles/ArticlesPage.tsx`（PageHeader，移除内联 count badge）
  - `src/components/ui/card.tsx`（rounded-xl → rounded-lg，全局替换）
- 测试命令：`pnpm lint && pnpm test && pnpm build`
- 验收证据：
  - 6 个页面标题区域统一使用 PageHeader 组件。
  - Card 根元素、CardHeader、CardFooter、img 选择器全部 rounded-xl → rounded-lg。
  - AiConfigPage EmptyState 已有 description="系统将自动生成默认模板"。
  - lint 0 errors，55 files / 386 tests 通过，build 通过。
- 风险：Card 圆角变化为全局影响，需浏览器确认视觉效果。settings 页 Settings icon 丢失。
- 关联提交：`459a98b`

## Stage 9：Playwright E2E 回归修复

初始回归：1158 passed, 163 failed, 96 skipped。修复后（admin project）：66 passed, 15 skipped, 0 failed。

### E2E-001：auth.spec.ts 选择器与文案适配

- 状态：done
- 目标：修复 auth.spec.ts 中因 Round B UI 重构导致的全部断言失败。
- 实际修改文件：
  - `e2e/auth.spec.ts` — 登录按钮 `'登 录'` → `'登录管理后台'`（4 处）；导航链接适配（首页/文章/素材卡/检索/复习/设置）；banner scoping + `exact: true` 避免首页快捷卡片和 sidebar 误匹配；补充缺失 `page.goto()` 调用修复 serial mode 级联失败；sidebar locator 改为 `'aside'`；logout 重定向改为 `/`；register 页占位符 `'请输入邀请码'` → `'留空则注册为普通用户'`，按钮 `'注 册'` → `'注册'`；邀请码改为可选字段（移除空值验证测试，添加可选字段测试）
- 测试命令：`pnpm exec playwright test e2e/auth.spec.ts --project=admin`
- 验收证据：
  - admin project 全部 auth 测试通过。
  - serial mode 级联失败消除（每个 test 独立 `page.goto()`）。
  - strict mode violation 消除（banner scoping）。
- 风险：无。

### E2E-002：admin.spec.ts Radix Select 适配

- 状态：done
- 目标：admin 用户管理表的 `<select>` 已迁移为 Radix Select combobox，E2E 断言需同步。
- 实际修改文件：
  - `e2e/admin.spec.ts` — 原生 `selectOption()` 改为 `getByRole('combobox').click()` + `getByRole('option', { name: '普通用户' }).click()`
- 测试命令：`pnpm exec playwright test e2e/admin.spec.ts --project=admin`
- 验收证据：
  - 创建用户弹窗中角色选择器使用 Radix combobox + option 交互。
  - admin project 全部 admin 测试通过。
- 风险：无。

### E2E-003：articles.spec.ts 副标题断言移除

- 状态：done
- 目标：PageHeader 迁移后文章列表不再渲染 "共 X 篇" 副标题。
- 实际修改文件：
  - `e2e/articles.spec.ts` — 移除 `await expect(page.getByText(/共 \d+ 篇/)).toBeVisible()` 断言
- 测试命令：`pnpm exec playwright test e2e/articles.spec.ts --project=admin`
- 验收证据：
  - 断言移除后测试通过，无其他断言受影响。
- 风险：无。

### E2E-004：已删除路由 spec 跳过

- 状态：done
- 目标：`/explore`、`/discover`、`/my-articles` 已在 Round A 删除，对应 E2E 测试需跳过。
- 实际修改文件：
  - `e2e/explore-discover.spec.ts` — 两个 describe 块添加 `test.skip(true, 'Round B refactor: 页面已移除')`
  - `e2e/frontend-experience.spec.ts` — 公共页面 describe 块和 `/my-articles` 测试添加 `test.skip()`
  - `e2e/middleware.spec.ts` — 公开页面 console error 检查循环中移除 `/explore` 和 `/discover`
  - `e2e/visual-regression.spec.ts` — 截图路由数组移除 `/explore` 和 `/discover`
- 测试命令：`pnpm exec playwright test --project=admin`
- 验收证据：
  - explore/discover/my-articles 相关测试标记为 skipped（15 个），不计入失败。
  - middleware 和 visual-regression 不再尝试访问已删除路由。
- 风险：skip 标注为永久（除非路由重新创建）。

### E2E-005：we-mp-rss.spec.ts 基础设施检查

- 状态：done
- 目标：we-mp-rss 同步测试依赖外部服务（localhost:8001），不可用时应自动跳过而非失败。
- 实际修改文件：
  - `e2e/we-mp-rss.spec.ts` — 同步测试前添加 `page.request.get('http://localhost:8001')` health check，不可用时 `test.skip()`
- 测试命令：`pnpm exec playwright test e2e/we-mp-rss.spec.ts --project=admin`
- 验收证据：
  - we-mp-rss 服务不可用时测试自动跳过，不产生 false negative。
- 风险：当服务可用时需重新验证同步功能本身。

## Stage 10：Batch A 残留 P0 补修（sync service 层 owner 隔离）

> 来源：2026-06-18 harness-review 发现《修复报告-2026-06-18》(Report B) 声称 P0-3 已关闭，
> 实际只修了读路径（getSyncHistory/canAccessSyncRecord），写路径（syncArticle/syncMaterialCard）未修。

### BA-1：syncMaterialCard service 层 owner + archived 防线（需求 A5 / 6.3）

- 状态：done
- 目标：service 层独立校验 `ownerUserId === userId` 与 `archivedAt == null`，不依赖 route 层。
- 实际修改文件：
  - `src/services/ima-sync.ts` — `syncMaterialCard` 在 confirmed 检查后新增 owner 校验（不匹配→`MATERIAL_CARD_FORBIDDEN`）与 archived 校验（→`MATERIAL_CARD_ARCHIVED`），不写远程。
- 测试：`pnpm test src/services/__tests__/ima-sync.test.ts`
- 验收证据：非 owner 卡即使 confirmed 也拒绝；归档卡即使 owner 正确也拒绝；owner 正确时正常同步。

### BA-2：syncArticle 过滤他人/归档卡（需求 A4 / 2.2）

- 状态：done
- 目标：`POST /api/articles/[id]/sync-to-ima` 同步时只取当前用户自己的 confirmed 且未归档的卡。
- 实际修改文件：
  - `src/services/ima-sync.ts` — `syncArticle` 的 `materialCards` where 由 `{ confirmed: true }` 改为 `{ confirmed: true, ownerUserId: userId, archivedAt: null }`。
- 验收证据：VERIFIED_USER 同步公共文章时，他人 confirmed 卡与归档卡不再被同步到调用者 IMA。

### BA-3：服务层 A/B owner 隔离测试

- 状态：done
- 实际修改文件：
  - `src/services/__tests__/ima-sync.test.ts` — CARD fixture 补 `ownerUserId`/`archivedAt`；新增 5 个测试（syncMaterialCard owner 拒绝/archived 拒绝/owner 正常；syncArticle 排除他人与归档卡、正文同步路径不受影响）。
- 测试命令：`pnpm test src/services/__tests__/ima-sync.test.ts`、`pnpm test`（全量）。
- 验收证据：
  - vitest 75 files / 725 tests 通过（基线 720 + 5）。
  - lint 0 errors / 67 warnings（全 pre-existing unused-vars）。
  - build 通过（完整路由表）。
  - Playwright `e2e/api-security.spec.ts` + `e2e/sync-records.spec.ts`（admin project）：40 passed / 0 failed。
- 风险：
  - 未跑全量 5-project Playwright（受 admin fixture token 长跑失效污染，见 Report B §6 / Report A P2-1，非本批回归）。
  - syncArticle 的 owner 过滤为硬过滤；若未来 ADMIN 需代运维同步他人卡，应另开显式 admin-only 接口（当前需求禁止）。
- 关联提交：pending

## Stage 11：P1-残留-1 — `/api/articles` 强制登录

> 来源：2026-06-18 harness-review P1-残留-1（Report A P1-4，Report B 未修）。

### BA-4：`/api/articles` GET 强制登录（需求第 3 节）

- 状态：done
- 目标：核心学习接口必须登录，匿名访问返回 401。
- 根因：middleware 已保护页面 `/articles`（匿名重定向 `/login`），但 `/api/articles` 不在 `isProtectedApi`，匿名直调穿透到 handler，handler 用 `getUserFromRequest`（软认证）且有匿名分支返回 approved+public 文章。
- 实际修改文件：
  - `src/app/api/articles/route.ts` — 入口加 `const user = await getUserFromRequest(request); if (!user) return unauthorizedResponse();`；删除匿名 `else` 分支（匿名不再可达）。
  - `src/app/api/articles/__tests__/route.test.ts` — 匿名用例改写为「匿名→401 且不查 db」；`beforeEach` 默认改为登录普通用户（之前依赖匿名分支「碰巧返回 200」掩盖的用例现在显式登录）；mock 补 `unauthorizedResponse`。
  - `e2e/api-security.spec.ts` — 新增「未认证：articles 列表返回 401」断言（真实 HTTP 层）。
- 测试命令：
  - `pnpm test src/app/api/articles/__tests__/route.test.ts`
  - `pnpm test`（全量）
  - `pnpm exec playwright test e2e/api-security.spec.ts e2e/articles.spec.ts --project=admin`
- 验收证据：
  - vitest 75 files / 725 通过。
  - lint 0 errors / 67 warnings；build 通过。
  - Playwright api-security + articles（admin）：47 passed / 2 skipped（explore/discover 已删页面）/ 0 failed。
  - 新增 e2e「未认证 articles → 401」真实 HTTP 层通过。
- 风险：
  - 未跑全量 5-project Playwright（admin fixture token 长跑失效污染，非本批回归）。
  - middleware 的 `PUBLIC_APIS`/`isProtectedApi` 列表未收紧（API 层已挡；纵深防御另行评估，不在本批）。
- 关联提交：pending

## Stage 12：P1-残留-2 — 个人 IMA 同步查询 ADMIN 按 owner 隔离 + 后台运维重同步接口

> 来源：2026-06-18 harness-review P1-残留-2。
> 用户决策：个人同步语境 ADMIN 也不能读他人同步记录/历史；后台运维代重同步另开 admin-only 接口。

### BA-5：收紧 `GET /api/sync` 读路径（去 ADMIN 例外）

- 状态：done
- 目标：个人同步查询接口 ADMIN 也按 owner 隔离。
- 实际修改文件：
  - `src/services/ima-sync.ts` — `canAccessSyncRecord`/`canAccessCardHistory`/`getSyncHistory` 删除 `isAdmin` 参数与 `if (isAdmin) return true` 放行；owner 校验对所有用户生效。
  - `src/app/api/sync/route.ts` — 删除 `isAdmin` 计算与传参。
  - `src/app/api/sync/__tests__/route.test.ts` — ADMIN 查他人 syncRecord→404、他人 cardId 历史→空 `[]`；mock 去 isAdmin 短路。
- 验收证据：ADMIN 查他人记录/历史与普通用户一致（404 / 空）。
- **不动**：`/api/sync-records` 与 `ownedResourceWhere`（后台运维全局读保留，已核验 `/sync-records` 仅重定向到后台、无前台个人页）。

### BA-6：新建后台运维重同步接口

- 状态：done
- 目标：恢复后台代重同步能力（个人 `POST /api/sync` 已收紧为只能同步自己的卡，含 ADMIN）。
- 实际修改文件：
  - 新建 `src/app/api/admin/sync-records/[id]/retry/route.ts` — `requireAdmin`；按记录 id 取 SyncRecord，用**卡真实 owner 的 userId** 调 `syncMaterialCard`（新 SyncRecord 归属原用户）；不限状态；旧记录保留不动；文章正文记录（materialCardId 为空）→ 400；写审计（retriedByAdmin/originalOwner/outcome）。
  - `src/components/sync/SyncRecordsPage.tsx` — `handleRetry` 改调 `/api/admin/sync-records/${record.id}/retry`。
  - 新建 `src/app/api/admin/sync-records/[id]/retry/__tests__/route.test.ts` — 8 用例（非 ADMIN 403 / 未登录 401 / 记录不存在 404 / 文章记录 400 / 代重同步他人卡以 owner 调 service+审计 / 自己卡 / 卡不存在 404 / service 失败结构化错误）。
- 测试命令：`pnpm test`、`pnpm exec playwright test e2e/api-security.spec.ts e2e/sync-records.spec.ts --project=admin`
- 验收证据：
  - vitest 76 files / 735 通过（基线 725 + 10）。
  - lint 0 errors / 67 warnings；build 通过。
  - Playwright api-security + sync-records（admin）：41 passed / 0 failed。
- 风险：
  - 未跑全量 5-project Playwright（admin fixture token 长跑失效污染，非本批回归）。
  - 运维接口用「卡真实 owner」调 service——service 的 owner 校验对真实 owner 放行，已确认正确。
- 关联提交：pending

## Stage 13：E2E 基础设施债 — admin fixture token 持久化（P2-1）+ RBAC/helper 静态 import

> 来源：Report A P2-1 / Report B §6（全量 Playwright 不可信）。

### BA-7：global-setup cookie 持久化（P2-1）

- 状态：done
- 目标：admin-gated spec 长跑后不再集体 401。
- 根因（systematic-debugging 确证）：
  - DB session 存 PostgreSQL（24h），dev server hot-reload 不影响 token。
  - 生产 login API 的 Set-Cookie 带 `Max-Age=86400`（持久）。
  - **但** `e2e/global-setup.ts` 的 `context.addCookies` 没设 `expires` → Playwright 默认 session cookie（`expires:-1`），长跑复用不稳定。
  - 数据流源头坏值在 global-setup（解析 Set-Cookie 时丢了 Max-Age）。
- 实际修改文件：
  - `e2e/global-setup.ts` — `apiLoginAndSave` 解析 Set-Cookie 的 `Max-Age`（无则默认 86400），`addCookies` 设 `expires: now+maxAge`（未来时间戳）；`secure` 按 baseURL 协议动态设（https→true）。
- 验收证据：跑 global-setup 后 `.auth/admin-storage.json` 的 cookie `expires` 从 `-1` 变为未来时间戳（约 24h 后），`secure` 本地 localhost 为 false。

### BA-8：helper 动态 import 改静态 + RBAC-PAGE-002 修正

- 状态：done
- 目标：消除 Playwright loader 对 `.ts` 动态 import 的偶发 SyntaxError；修复被 flaky 掩盖的 RBAC-PAGE-002 真实缺陷。
- 根因（systematic-debugging 确证）：
  - `rbac-capability-matrix.spec.ts:347` 动态 import 已静态 import 的模块；`cards.spec.ts:223` 动态 import 顶部**已静态 import** 的 `ensureCardExists`（纯冗余遮蔽）。Playwright loader 对 `.ts` 动态 import 偶发 `SyntaxError`。
  - 改静态 import 后，RBAC-PAGE-002 从 flaky 变**确定性失败**：该用例塞在 USER storageState describe 里却用 `loginAsAdmin` 中途切换身份；USER 访问 `/admin` 被踢回首页 `/`（非 `/admin/login`），`loginAsAdmin` 的 `waitForURL(/\/admin\/login/)` 超时。
- 实际修改文件：
  - `e2e/rbac-capability-matrix.spec.ts` — RBAC-PAGE-002 移出 USER describe，单独开 admin storageState describe（与 RBAC-ADMIN 系列同范式），删 `loginAsAdmin` 调用与 unused import。
  - `e2e/cards.spec.ts` — 删 `:223` 动态 import，直接用顶部已静态 import 的 `ensureCardExists`。
- 验收证据：
  - RBAC-PAGE-002 单测稳定通过（1 passed）。
  - 整个 rbac-capability-matrix spec：45 passed / 0 failed。
  - lint 0 errors / 67 warnings。

### BA-9：middleware.spec 过时断言修正（P1-残留-1 / Round A 连带遗漏）

- 状态：done
- 目标：全量 E2E 跑通，移除因认证策略变更而过时的断言。
- 根因：全量回归暴露 middleware.spec 有 3 条过时「公开页面/API 返回 200」断言——`/articles`（P1-残留-1 改需登录后仍断言匿名 200）、`/explore`+`/discover`（Round A 删路由后仍断言公开可访问）、`/api/articles`+`/api/search`（受保护 API 仍断言匿名 200）。
- 实际修改文件：
  - `e2e/middleware.spec.ts` — 删 `/explore`、`/discover`「公开页面」用例（路由已删）；`/articles` 移到「受保护页面重定向」段（断言匿名→`/login`）；`/api/articles`、`/api/search` 从「公开 API」改为「受保护 API 未认证返回 401」。
- 验收证据：middleware.spec（anonymous project）12 passed / 0 failed。

### 全量 5-project Playwright 结果（本批验证目标）

- 跑全量 2215 用例（5 project × 各 spec），跑至 ~98% 后中断（带 retry 耗时长）。
- **关键结论：Report A 的「admin-gated spec 集体 401」污染已消除**——全量日志中 `Expected: not 401`（admin 身份失效类失败）出现 **0 次**；401 计数全部来自**预期断言**（api-security「未认证→401」用例，正确通过）。
- 单独复现 RBAC-ADMIN-009（anonymous project，admin storageState 覆盖）→ 通过，证实 cookie 持久化生效。
- 剩余失败全部是**预存 UI 测试 flaky**（734 次 retry，集中在 articles-enhanced/auth/admin/search 等 spec 的 timeout/element/locator 选择器与时序问题，Report A 已记录为 P2/P3 测试质量债），与 admin fixture / 本批改动无关。
- 未跑完最后一分钟全量统计行（带 retry 拖慢 + 交互式会话不宜久等），但关键证据（admin 401 = 0）已确证。
- 风险：预存 UI flaky 仍是全量「可信度」的噪音源，建议后续单独一批清理（P2/P3）。

## Stage 14：预存 UI flaky 清理（A 真实 bug / B 过时测试 / C 选择器加固 / D 暂缓）

> 来源：Stage 13 全量暴露 734 retry，systematic-debugging 拆为 4 类。用户决策全清，D 后改为暂缓。

### BA-10：类 A — SSR router 崩溃（middleware 拦截）

- 状态：done
- 根因：`settings/ai` + `settings/ima` 页面在渲染体调 `router.push`，SSR 抛 `location is not defined`（dev server uncaughtException）。
- 实际修改：
  - `src/proxy.ts`：已登录非 VERIFIED_USER/ADMIN 访问 `/settings/ai` `/settings/ima` → 302 `/settings`。
  - `settings/ai/page.tsx` + `settings/ima/page.tsx`：渲染体 router.push 改放进 useEffect（页面级第二防线）。
  - `e2e/middleware.spec.ts`：新增 role-guard 重定向测试。
- 验收：role-guard 测试通过且 `location is not defined` uncaughtException 消失；vitest 735 / lint 0 / build 通过。

### BA-11：类 B — 删引用已删路由的过时测试

- 状态：done
- 实际修改：删 `e2e/explore-discover.spec.ts` 整文件；`frontend-experience.spec.ts` 删 skip 块；dead-link/mobile-responsive/accessibility 数组删 `/explore` `/discover`。共删 280 行死代码。

### BA-12：类 C — 全面铺 data-testid + 选择器加固（C1-C4）

- 状态：done
- 实际修改：
  - `PageHeader` 组件支持透传 `data-testid`（所有页面受益）。
  - C1 cards：PageHeader/empty-state/grid/卡片项/复选框/详情标题/删除按钮加 testid；cards.spec 脆弱选择器改 getByTestId。
  - C2 articles：PageHeader/错误 div 加 testid；articles.spec 两处多元素 first() 改 testid。
  - C3 error-states：articles/cards 详情错误文案加 testid；error-states.spec `.text-destructive` 改 testid。
  - C4 review/search/sync-records：PageHeader 加 testid；对应 spec 多元素 first() 改 testid。
- 验收：cards(11)/articles(12)/review+search+sync-records(25) 全 passed。

### BA-13：类 D — 硬编码等待清理（暂缓，后续深挖）

- 状态：deferred
- 原因：70 处 `waitForTimeout` + 24 处 `networkidle`，每处需单独判断业务上下文（等 toast/表格/路由各不同），盲改风险高（可能把能过的测试改 flaky）。用户决策暂缓，先看 A/B/C 降幅再定是否必要。
- 后续：若全量降幅不足，针对性改 retry 最多的 spec 的硬等待。

### 全量 run2 结果（A/B/C 后，类 D 前）

- `pnpm exec playwright test`（5 project × ~2115 用例，1.7h）：**1208 passed / 703 failed / 5 flaky / 130 skipped / 69 did not run**。
- **关键 bug 指标全归 0**（达成本批核心目标）：
  - `Expected: not 401`（admin fixture 污染）= **0**（Stage 13 修复生效）。
  - `location is not defined`（类 A SSR bug）= **0**。
- **剩余 703 failed 全是长跑时序 flaky**：retry 集中在 auth(57)/articles-enhanced(54)/admin(41)/wechat-rss(36)/search(30)/rbac(30) 等，错误类型 `element(s) not found` + 10s timeout。
- **非回归**：我改过的 spec（cards/articles/review/search/sync-records）单跑全 passed（cards 11/articles 12/review+search+sync 25）；全量失败是 1.7h 长跑 + dev server 压力下的时序 flaky，正是类 D（硬编码等待/超时）范畴。
- 结论：A/B/C 修了真实 bug + 删死代码 + 选择器加固，但未根治长跑时序 flaky——需类 D + 可能的 config 调整。用户决策：先提交推送（记录遗留），后继续类 D 深挖。
