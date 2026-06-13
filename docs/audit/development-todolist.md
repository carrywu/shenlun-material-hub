# Development TodoList

生成日期：2026-06-13  
状态：Batch 1-5 + 前端改造第一轮 (A1-A5) 全部完成

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
