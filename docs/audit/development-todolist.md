# Development TodoList

生成日期：2026-06-13  
状态：Batch 1 权限与数据安全开发完成

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
  - `project-assessment.md` 状态已更新为“项目评估完成，等待进入开发执行”。
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
  - `src/components/SyncToIma.tsx` — `IMA_CONFIG_MISSING` 时显示“去配置”链接
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

- 状态：todo
- 目标：创建用户成功后表格立即显示新用户。
- 文件范围：
  - `src/app/admin/users/page.tsx`
  - `e2e/admin.spec.ts`
- 测试命令：
  - `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`
- 验收证据：toast 成功后新用户 cell 可见。
- 风险：并发请求 race。
- 关联提交：pending

### T3-002：Admin Users malformed JSON 返回 400

- 状态：todo
- 目标：POST/PUT 空 body 或坏 JSON 返回 400。
- 文件范围：
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/admin/users/[id]/route.ts`
  - route tests
- 测试命令：相关 route test。
- 验收证据：无 `Unexpected end of JSON input` 服务端异常。
- 风险：需要保持合法请求行为不变。
- 关联提交：pending

### T3-003：用户删除改禁用

- 状态：todo
- 目标：后台不提供删除用户，只提供禁用/启用。
- 文件范围：
  - `src/app/admin/users/page.tsx`
  - `src/app/api/admin/users/[id]/route.ts`
- 测试命令：
  - `pnpm exec playwright test e2e/admin.spec.ts -g "用户管理" --project=admin`
- 验收证据：UI 无删除入口；禁用撤销 session。
- 风险：旧测试可能断言删除行为。
- 关联提交：pending

### T3-004：AdminLogs key warning

- 状态：todo
- 目标：修复 fragment key warning。
- 文件范围：
  - `src/app/admin/logs/page.tsx`
  - `e2e/admin.spec.ts`
- 测试命令：
  - `pnpm exec playwright test e2e/admin.spec.ts -g "日志" --project=admin`
- 验收证据：console warning 消失。
- 风险：低。
- 关联提交：pending

## Stage 4 / Batch 3：学习状态与素材卡生命周期

### T4-001：用户私有文章学习状态

- 状态：todo
- 目标：阅读、收藏、忽略、复习状态从全局文章字段迁移到用户私有状态。
- 文件范围：
  - `prisma/schema.prisma`
  - articles/favorites/review API
  - article/review UI
- 测试命令：
  - migration dry-run
  - data-isolation E2E
- 验收证据：A 用户状态不影响 B 用户。
- 风险：schema migration。
- 关联提交：pending

### T4-002：素材卡归档箱

- 状态：todo
- 目标：软删除/归档、默认排除、可恢复。
- 文件范围：
  - `prisma/schema.prisma`
  - material card API/UI
  - search/review/IMA sync
- 测试命令：unit + cards/search/review E2E。
- 验收证据：归档后默认不可见，恢复后状态保留。
- 风险：schema migration。
- 关联提交：pending

### T4-003：重新生成覆盖流程

- 状态：todo
- 目标：已有卡复用，显式重新生成二次确认并重置复习状态。
- 文件范围：generate-card API、cards UI、review state。
- 测试命令：generate-card route tests + cards E2E。
- 验收证据：不重复堆卡，覆盖前确认。
- 风险：复习状态模型需先完成。
- 关联提交：pending

## Stage 5 / Batch 4：前台 IA 与移动端

### T5-001：`/articles` 合并入口

- 状态：todo
- 目标：`/articles` 提供全部/推荐/收藏，删除 discover/explore/my-articles。
- 文件范围：articles routes/components, nav, e2e。
- 测试命令：articles/search/review/mobile specs。
- 验收证据：主导航只有统一文章入口。
- 风险：旧 E2E 大量断言需更新。
- 关联提交：pending

### T5-002：角色化首页

- 状态：todo
- 目标：`/` 登录后按角色展示主任务；未登录跳 `/login`。
- 文件范围：`src/app/page.tsx`, nav/layout。
- 测试命令：auth/middleware/frontend E2E。
- 验收证据：USER/VERIFIED/ADMIN 首页差异正确。
- 风险：统计口径需从 owner 私有改为公共文章 + 个人资产组合。
- 关联提交：pending

### T5-003：响应式底部 Tab

- 状态：todo
- 目标：移动端前台底部 Tab，按角色显示。
- 文件范围：RootNav/layout/mobile tests。
- 测试命令：`pnpm exec playwright test e2e/mobile-responsive.spec.ts`
- 验收证据：390px 无横向溢出，Tab 正确。
- 风险：后台移动端仅基本可用，不做完整优化。
- 关联提交：pending

## Stage 6 / Batch 5：UI 改进（置后）

### T6-001：UI 组件库评估

- 状态：deferred
- 目标：评估 shadcn/Tailwind/lucide/Sonner/Zod 现状。
- 文件范围：package/components/app/e2e/tests。
- 备注：权限与数据安全稳定后再做。
- 关联提交：pending

### T6-002：UI 渐进式改造计划

- 状态：deferred
- 目标：统一基础组件、业务组件、后台、用户端、测试。
- 备注：不默认引入 AntD/HeroUI/TanStack/RHF。
- 关联提交：pending
