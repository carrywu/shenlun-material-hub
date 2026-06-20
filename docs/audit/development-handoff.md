# Development Handoff

生成日期：2026-06-18
状态：Batch 1-5 + 前端改造第一轮 (A1-A5) + 第二轮 (B-Phase 1-4) + Playwright E2E 回归修复 + 全量审查 P0/P1 补修 (BA-1~BA-13) + Class D E2E flaky 清理 全部完成
适用：后续 agent 接手前恢复现场

## 1. 当前目标

Batch 1-5（权限、用户管理、学习状态、前台 IA、UI 评估）全部完成。前端改造第一轮（A1 学习状态展示、A2 Articles Tab、A3 旧路由清理、A4 归档箱 Tab、A5 重新生成确认弹窗）已完成。前端改造第二轮（B-Phase 1-4：基础组件 + 表单规范化 + 表格弹窗 + 视觉统一）已完成并通过验证，12 个 Task 全部交付。Playwright E2E 全量回归已完成修复（admin project：66 passed, 15 skipped, 0 failed），8 个 spec 文件已适配 Round B UI 变更。下一阶段可进行跨浏览器全量回归（5 project）、视觉回归快照重生成，或进入下一轮功能迭代。

## 2. 已完成

### 文档体系（Stage 0）
- 旧 `docs/audit/*.md` 已归档到 `docs/archive/2026-06-13-audit-reset/`。
- 保留 `docs/audit/screenshots/` 历史证据目录。
- 当前有效主文档：`requirements-confirmation.md`、`project-assessment.md`、`development-plan.md`。
- 当前现场文档：`development-handoff.md`、`development-todolist.md`。
- UI 评估文档：`docs/audit/ui-assessment.md`、`docs/audit/ui-refactor-plan.md`。

### 基础设施恢复
- `.env` 添加 `POSTGRES_PASSWORD="shenlun_dev"`。
- `src/lib/db.ts` 连接池加固：`connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 30000`, `max: 20`。
- `src/scripts/seed-e2e-accounts.ts` 添加连接预检 + 超时。
- `e2e/global-setup.ts` 从浏览器表单登录改为 API 登录 + cookie 注入，4 角色全部成功。

### Batch 1 开发（权限与数据安全）
- **T2-001 前台 /login**：新建 `src/app/login/page.tsx`，`proxy.ts` 双登录页分流，`/cards`/`/search`/`/review` 受保护。
- **T2-002 素材卡访问边界**：`material-cards/[id]` GET 非 owner 非 ADMIN 返回 404。
- **T2-003 reject 不删用户卡**：review route reject 仅删 `ownerUserId: null` 公共卡。
- **T2-004 IMA 禁止 env fallback**：`resolveImaConfig` 无配置抛错，前端显示配置引导。
- **T2-005 审计覆盖**：7 个路由补充 `auditLog()`，import 从 4 个增至 11 个。

### Batch 2 开发（用户管理与后台稳定性）
- **T3-001 Admin Users 创建后可见**：创建成功后 optimistic insert 新用户到 state 数组，然后 refetch。
- **T3-002 malformed JSON 400**：POST/PUT `request.json()` 包裹 try/catch，返回结构化 400；新建 6 个单元测试。
- **T3-003 用户删除改禁用**：前端移除删除按钮和 `handleDelete`，DELETE handler 返回 405。
- **T3-004 AdminLogs key warning**：`<>` 改为 `<Fragment key={log.id}>`。

### Batch 3 开发（学习状态与素材卡生命周期）
- **Schema 变更**：`MaterialCard` 添加 `archivedAt DateTime?`，新建 `UserContentState` 模型（userId+contentItemId unique），migration SQL 已生成。
- **T4-001 用户私有学习状态**：新建 `user-content-state` API（GET/POST upsert），`content-items/[id]` GET 和 `articles` GET 返回 `userRead/userIgnored/userBookmarked`。
- **T4-002 素材卡软删除**：DELETE 改为 `update({ archivedAt: new Date() })`，新增 PATCH handler 支持 archive/unarchive，列表/搜索/复习添加 `archivedAt: null` 过滤，favorites DELETE 同步改为 `updateMany`。
- **T4-003 重新生成覆盖**：`generate-card` 添加 `force` 参数，`force=true` 时更新已有卡而非 409。
- **AuditAction 扩展**：添加 `"archive"` 和 `"unarchive"` 到类型联合。

### Batch 4 开发（前台 IA 与移动端）
- **T5-001 导航与登录**：`RootNav.tsx` 按角色显示导航项（base: articles/review/settings，verified+: cards/search），未登录跳 `/login`。
- **T5-002 角色化首页**：`page.tsx` 按角色显示欢迎语和快捷操作，`proxy.ts` 移除旧 public 路由（/discover, /explore）。
- **T5-003 移动端底部 Tab**：新建 `MobileBottomTab.tsx`（md:hidden，固定底部，角色感知），layout 添加 `pb-16 md:pb-0`。

### Batch 5（UI 评估与计划）
- **T6-001 UI 组件库评估**：输出 `docs/audit/ui-assessment.md`，覆盖 12 个 shadcn 组件、26 个自定义业务组件、31 个裸 `<button>` 标签、缺少 ErrorBoundary、Zod 未使用等发现。
- **T6-002 UI 渐进式改造计划**：输出 `docs/audit/ui-refactor-plan.md`，4 阶段（基础组件加固 → 表单规范化 → 表格与列表 → 视觉统一），不引入 AntD/HeroUI/TanStack/RHF。

### 前端改造第一轮（Round A：功能补全）
- **设计文档**：`docs/superpowers/specs/2026-06-13-frontend-refactor-design.md`，两轮制改造（Round A 功能补全 + Round B UI 统一）。
- **实施计划**：`docs/superpowers/plans/2026-06-13-frontend-round-a.md`，5 个 Task 按依赖顺序执行。
- **A3 旧路由清理**：删除 `/discover`、`/explore`、`/my-articles` 三个废弃路由页面，共移除 1082 行代码，无重定向。
- **A2 Articles Tab 切换**：`/articles` 页面新增「全部/推荐/收藏」Tab 切换，API 添加 `filter` 参数（approved/favorites），匿名访问 favorites 静默降级。
- **A1 学习状态展示**：文章列表页和详情页显示「已读/已收藏/已忽略」状态徽章，使用 per-user 字段（userRead/userIgnored/userBookmarked）。
- **A4 归档箱 Tab**：`/cards` 页面新增「全部卡片/已归档」Tab，API 添加 `archivedOnly` 参数，归档视图显示归档日期和恢复按钮。
- **A5 重新生成确认弹窗**：新建 `alert-dialog.tsx` 组件（base-ui/react），文章详情页重新生成时若已有素材卡则弹出二次确认，支持 force 覆盖。

### 前端改造第二轮（Round B：UI 组件统一）
- **设计文档**：`docs/superpowers/specs/2026-06-13-round-b-ui-unification-design.md`，4 Phase 制改造（基础组件 → 表单 → 表格弹窗 → 视觉统一）。
- **实施计划**：`docs/superpowers/plans/2026-06-13-round-b-ui-unification.md`，12 个 Task 按依赖顺序执行。
- **Phase 1（基础组件 + 裸元素迁移）**：
  - Task 1：新建 EmptyState + LoadingSkeleton/LoadingIndicator 组件（data-slot、ARIA、export convention）。
  - Task 2：新建 ErrorBoundary 组件，layout.tsx 包裹 children。
  - Task 3：Admin 页面 18 个裸 button 迁移至 shadcn Button。
  - Task 4：前台与组件 12 个裸 button 迁移至 shadcn Button（登录页替换 SVG spinner 为 Loader2）。
  - Task 5：15 个裸 input + 1 个裸 select 迁移至 shadcn Input/Select。
  - Task 6：7 处内联空状态统一为 EmptyState 组件，AiConfigPage 纯文本 loading 升级为 LoadingIndicator。
- **Phase 2（表单规范化）**：
  - Task 7：新建 FormField 组件，login/admin-login/register 三个表单页面标准化（移除 register 页 rounded-xl 覆盖）。
  - Task 8：admin/users 创建用户弹窗 5 个字段 + 重置密码弹窗 1 个字段用 FormField 包裹。
- **Phase 3（表格 + 弹窗）**：
  - Task 9：admin/page.tsx 近期任务表（3 列）+ admin/users 用户管理表（7 列）迁移至 shadcn Table。
  - Task 10：admin/users 创建用户弹窗 + 重置密码弹窗 + UpgradeButton 付费弹窗迁移至 shadcn Dialog（@base-ui/react）。
- **Phase 4（视觉统一）**：
  - Task 11：新建 PageHeader 组件（title + description + actions）。
  - Task 12：6 个前台页面应用 PageHeader，Card 组件圆角统一为 rounded-lg，空状态文案标准化。
- **迁移排除项**：10 个 date picker input（type="date" + opacity-0 覆盖模式）、1 个 range slider、articles/[id] 图片预览全屏 modal、AdminShell 移动端侧边栏 overlay。

### 验证基线
- `pnpm lint`：0 errors / 17 warnings（全部为预存 warning）。
- `pnpm test`：55 files / 386 tests 全部通过。
- `pnpm build`：通过。

### Playwright E2E 回归修复
- **初始回归结果**：1158 passed, 163 failed, 96 skipped（5 project × 26 spec）。
- **失败分类**：7 类（A-G），涵盖 auth 选择器过期、admin Radix Select 迁移、articles 断言变化、已删除路由引用、middleware 路由列表、we-mp-rss 基础设施依赖、visual-regression 路由删除。
- **修复后结果（admin project）**：66 passed, 15 skipped（预期跳过：explore/discover/my-articles 页面已移除 + we-mp-rss 服务不可用）, 0 failed。
- **修复的 spec 文件**：
  - `e2e/auth.spec.ts`：登录按钮文案 `'登 录'` → `'登录管理后台'`（4 处），导航链接名称适配 Round B（首页/文章/素材卡/检索/复习/设置），添加 `exact: true` 和 banner scoping 避免首页快捷卡片误匹配，添加缺失 `page.goto()` 调用修复 serial mode 级联失败，sidebar locator 从 `'aside, nav, [data-sidebar]'` 改为 `'aside'`，logout 重定向从 `/admin/login` 改为 `/`，register 页占位符和按钮文案更新，邀请码改为可选字段。
  - `e2e/admin.spec.ts`：原生 `<select>` 断言改为 Radix Select combobox 模式（`getByRole('combobox')` + `getByRole('option')`）。
  - `e2e/articles.spec.ts`：移除 "共 X 篇" 副标题断言（PageHeader 迁移后不再渲染）。
  - `e2e/explore-discover.spec.ts`：两个 describe 块添加 `test.skip()`（/explore 和 /discover 页面已在 Round A 删除）。
  - `e2e/frontend-experience.spec.ts`：公共页面 describe 块和 `/my-articles` 测试添加 `test.skip()`。
  - `e2e/middleware.spec.ts`：公开页面 console error 检查移除 `/explore` 和 `/discover`。
  - `e2e/visual-regression.spec.ts`：截图路由数组移除 `/explore` 和 `/discover`。
  - `e2e/we-mp-rss.spec.ts`：同步测试前添加基础设施可用性检查（`http://localhost:8001` health check），不可用时自动跳过。

## 3. 进行中

当前没有业务代码开发或 E2E 修复进行中。所有计划内 Batch、前端改造第一轮、第二轮以及 E2E 回归修复（admin project）已完成。

## 4. 下一步

1. **跨浏览器全量回归**：E2E 修复已在 admin project（chromium）验证通过（284 passed, 0 failed, 4 flaky, 17 skipped）。需在 5 个 browser project（chromium、firefox、webkit、mobile-chrome、mobile-safari）上跑全量回归确认修复无遗漏。命令：`pnpm exec playwright test`。
2. **视觉回归快照重生成**：`e2e/visual-regression.spec.ts` 已移除已删除路由（/explore、/discover），但剩余页面的截图快照仍为旧版，需用 `--update-snapshots` 重新生成基线。命令：`pnpm exec playwright test e2e/visual-regression.spec.ts --update-snapshots --project=chromium`。
3. **we-mp-rss 同步测试验证**：`e2e/we-mp-rss.spec.ts` 已添加基础设施 health check 跳过逻辑，待 we-mp-rss 服务（localhost:8001）可用后验证同步功能。
4. **Round B 视觉人工确认**：Card 圆角从 rounded-xl 改为 rounded-lg、登录表单字段移除 rounded-xl 覆盖、admin 表格操作按钮语义颜色丢失（ghost variant），需浏览器端人工确认视觉效果是否可接受。
5. **4 flaky 测试竞态修复**：bookmark toggle、auth login redirect、sidebar collapse、ES-006 metrics 500 偶发 flaky，属逻辑竞态非选择器脆弱，需单独排查。

## 5. 关键决策

- **Next.js 16 中 `proxy.ts` 即 middleware**：不需要额外创建 `src/middleware.ts` re-export，创建会导致构建冲突。
- **双登录页架构**：前台 `/login`（蓝色主题）+ 后台 `/admin/login`（紫色主题），middleware 按路径分流。
- **global-setup API 登录**：用 `fetch()` + cookie 注入替代浏览器表单登录，避免 Playwright 对 Next.js client-side routing 的不可靠检测。
- **素材卡软删除**：使用 `archivedAt` 字段而非硬删除，所有查询默认 `archivedAt: null` 过滤。
- **用户学习状态私有化**：新建 `UserContentState` 模型替代 `ContentItem.read/bookmarked/ignored` 全局字段，通过 userId+contentItemId unique 约束。
- **force 参数控制重新生成**：`generate-card` 通过 `force=true` 显式覆盖已有卡，默认不重复。
- **UI 改进置后**：在权限/数据/核心闭环稳定后才做 UI 评估，不引入新 UI 框架（AntD/HeroUI/TanStack/RHF）。
- **当前只维护主文档 + 现场文档 + UI 评估文档**。

## 6. 修改文件

### Batch 1 新增/修改

新建：
- `src/app/login/page.tsx`

修改：
- `.env`
- `src/lib/db.ts`
- `src/scripts/seed-e2e-accounts.ts`
- `src/proxy.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/content-items/review/route.ts`
- `src/app/api/admin/content-items/review/__tests__/route.test.ts`
- `src/app/api/material-cards/[id]/route.ts`
- `src/app/api/settings/ima-targets/route.ts`
- `src/app/api/sync/route.ts`
- `src/services/ima-sync.ts`
- `src/components/SyncToIma.tsx`
- `src/app/cards/[id]/page.tsx`
- `e2e/global-setup.ts`
- `e2e/helpers/auth.ts`
- `e2e/middleware.spec.ts`

### Batch 2 新增/修改

新建：
- `src/app/api/admin/users/__tests__/route.test.ts`（6 个 malformed JSON 测试）

修改：
- `src/app/admin/users/page.tsx`（optimistic insert + 移除删除按钮）
- `src/app/api/admin/users/route.ts`（try/catch JSON + type assertions）
- `src/app/api/admin/users/[id]/route.ts`（try/catch JSON + DELETE 返回 405）
- `src/app/admin/logs/page.tsx`（Fragment key）

### Batch 3 新增/修改

新建：
- `prisma/migrations/20260613_batch3_support/migration.sql`
- `src/app/api/user-content-state/route.ts`

修改：
- `prisma/schema.prisma`（archivedAt + UserContentState 模型）
- `src/app/api/material-cards/[id]/route.ts`（soft-delete + PATCH archive/unarchive）
- `src/app/api/material-cards/[id]/__tests__/route.test.ts`（更新 mock）
- `src/app/api/material-cards/route.ts`（archivedAt: null 过滤）
- `src/app/api/search/route.ts`（archivedAt: null 过滤）
- `src/app/api/review/route.ts`（archivedAt: null 过滤）
- `src/app/api/favorites/[id]/route.ts`（updateMany 替代 deleteMany）
- `src/app/api/favorites/[id]/__tests__/route.test.ts`（更新 mock）
- `src/app/api/content-items/[id]/generate-card/route.ts`（force 参数）
- `src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts`（force 测试）
- `src/app/api/content-items/[id]/route.ts`（UserContentState + ArticleFavorite 查询）
- `src/app/api/content-items/[id]/__tests__/route.test.ts`（新增 mock）
- `src/app/api/articles/route.ts`（per-user state batch 查询）
- `src/app/api/articles/__tests__/route.test.ts`（新增 mock）
- `src/lib/audit-logger.ts`（添加 archive/unarchive action）
- `src/types/index.ts`（UserContentState 接口）

### Batch 4 新增/修改

新建：
- `src/components/MobileBottomTab.tsx`

修改：
- `src/components/RootNav.tsx`（角色化导航项 + 登录链接）
- `src/app/page.tsx`（角色化欢迎语 + 快捷操作 + 未登录跳 /login）
- `src/proxy.ts`（移除旧 public 路由）
- `src/app/layout.tsx`（MobileBottomTab + pb-16）

### Batch 5 新增

- `docs/audit/ui-assessment.md`
- `docs/audit/ui-refactor-plan.md`

### 前端改造第一轮（Round A）新增/修改

新建：
- `src/components/ui/alert-dialog.tsx`（AlertDialog 组件，base-ui/react 原语）
- `src/app/api/material-cards/__tests__/route.test.ts`（4 个归档过滤测试）
- `docs/superpowers/specs/2026-06-13-frontend-refactor-design.md`
- `docs/superpowers/plans/2026-06-13-frontend-round-a.md`

删除：
- `src/app/discover/page.tsx`
- `src/app/explore/page.tsx`
- `src/app/my-articles/page.tsx`
- `src/components/my-articles/MyArticlesPage.tsx`

修改：
- `src/app/api/articles/route.ts`（添加 filter 参数：approved/favorites）
- `src/app/api/articles/__tests__/route.test.ts`（3 个新测试）
- `src/components/articles/ArticlesPage.tsx`（Tab 切换 + 状态图标）
- `src/app/articles/[id]/page.tsx`（已读/已收藏/已忽略 Badge）
- `src/app/api/material-cards/route.ts`（archivedOnly 参数）
- `src/app/cards/page.tsx`（归档 Tab + 恢复按钮）
- `src/components/ArticleDetail.tsx`（重新生成确认弹窗）

### 文档更新
- `docs/audit/development-todolist.md`
- `docs/audit/development-handoff.md`

### Playwright E2E 回归修复（2026-06-14）

修改：
- `e2e/auth.spec.ts`（登录按钮、导航链接、注册页、sidebar、logout 适配 Round B UI）
- `e2e/admin.spec.ts`（Radix Select combobox 替代原生 select）
- `e2e/articles.spec.ts`（移除 PageHeader 迁移后失效的副标题断言）
- `e2e/explore-discover.spec.ts`（skip 已删除的 /explore 和 /discover 页面）
- `e2e/frontend-experience.spec.ts`（skip 已删除的公共页面和 /my-articles）
- `e2e/middleware.spec.ts`（移除已删除路由的 console error 检查）
- `e2e/visual-regression.spec.ts`（移除已删除路由的截图条目）
- `e2e/we-mp-rss.spec.ts`（添加基础设施 health check 跳过逻辑）

### 前端改造第二轮（Round B）新增/修改

新建：
- `src/components/ui/empty-state.tsx`（EmptyState 组件）
- `src/components/ui/loading-skeleton.tsx`（LoadingSkeleton + LoadingIndicator 组件）
- `src/components/ui/error-boundary.tsx`（ErrorBoundary 错误边界组件）
- `src/components/ui/form-field.tsx`（FormField 表单字段组件）
- `src/components/ui/page-header.tsx`（PageHeader 页面标题组件）
- `docs/superpowers/specs/2026-06-13-round-b-ui-unification-design.md`
- `docs/superpowers/plans/2026-06-13-round-b-ui-unification.md`

修改（按 Phase）：
- Phase 1：`src/app/layout.tsx`（ErrorBoundary 包裹）、`src/app/admin/users/page.tsx`（button/input/select/empty state）、`src/app/admin/page.tsx`（button）、`src/components/admin/AdminShell.tsx`（button）、`src/app/page.tsx`（empty state）、`src/components/ai/AiConfigPage.tsx`（input/button/loading/empty state）、`src/app/login/page.tsx`（button/input/FormField）、`src/app/admin/login/page.tsx`（button/input/FormField）、`src/app/register/page.tsx`（button/input/FormField）、`src/components/UpgradeButton.tsx`（input/dialog）、`src/components/subscriptions/SubscriptionsPage.tsx`（empty state）、`src/components/ArticleDetail.tsx`（empty state）、`src/components/CollectDialog.tsx`（empty state）、`src/components/articles/ArticlesPage.tsx`（empty state）、`src/components/__tests__/CollectDialog.test.tsx`（更新断言文案）
- Phase 2：（login/admin-login/register 已列在 Phase 1）、`src/app/admin/users/page.tsx`（FormField 包裹）
- Phase 3：`src/app/admin/page.tsx`（Table）、`src/app/admin/users/page.tsx`（Table + Dialog）、`src/components/UpgradeButton.tsx`（Dialog）
- Phase 4：`src/app/cards/page.tsx`、`src/app/search/page.tsx`、`src/app/review/page.tsx`、`src/app/settings/page.tsx`、`src/components/sync/SyncRecordsPage.tsx`、`src/components/articles/ArticlesPage.tsx`（PageHeader）、`src/components/ui/card.tsx`（rounded-xl → rounded-lg）

## 7. 测试结果

- `pnpm lint`：通过，0 errors / 17 warnings。
- `pnpm test`：通过，55 files / 386 tests。
- `pnpm build`：通过。
- `pnpm seed:e2e-accounts`：幂等成功，3 个非 admin 账号同步。
- **Playwright E2E 初始回归**（2026-06-14）：1158 passed, 163 failed, 96 skipped（5 project × 26 spec）。163 个失败分为 7 类（auth/admin/articles/explore/middleware/we-mp-rss/visual-regression）。
- **Playwright E2E 修复后回归**（2026-06-14，admin project）：66 passed, 15 skipped, 0 failed。
  - 15 个 skip 均为预期：explore/discover/my-articles 页面已在 Round A 删除（`test.skip()` 标注），we-mp-rss 服务不可用（health check 自动跳过）。
  - 修复涉及 8 个 spec 文件：`auth.spec.ts`、`admin.spec.ts`、`articles.spec.ts`、`explore-discover.spec.ts`、`frontend-experience.spec.ts`、`middleware.spec.ts`、`visual-regression.spec.ts`、`we-mp-rss.spec.ts`。
  - 验证命令：`pnpm exec playwright test --project=admin`。
- **Batch 1 阶段验证**（历史）：
  - `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`：通过（20.2s）。
  - `pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情" --project=admin`：6 个测试通过（31.2s）。
  - `pnpm exec playwright test e2e/middleware.spec.ts --project=admin`：14 个测试通过（1.7m）。

## 8. 未验证风险

- **跨浏览器回归未验证**：E2E 修复仅在 admin project（chromium）上验证，firefox/webkit/mobile-chrome/mobile-safari 4 个 project 未跑。理论上选择器修复（banner scoping、exact、Radix combobox）应跨浏览器一致，但需全量确认。
- **视觉回归快照过期**：`visual-regression.spec.ts` 已移除已删除路由，但剩余页面的截图快照仍为 Round B 前旧版，需 `--update-snapshots` 重生成。
- **Round B 视觉回归未人工确认**：Card 圆角从 rounded-xl 改为 rounded-lg（影响全局所有 Card 组件），登录/注册表单字段移除 rounded-xl 覆盖，Admin 表格操作按钮语义颜色（红/绿/琥珀）在迁移到 shadcn ghost variant 后丢失。需浏览器端人工确认。
- **FormField 缺少 htmlFor**：FormField 组件的 label 不使用 `htmlFor`/`id` 关联，可能影响无障碍审计。若后续有无障碍需求，需扩展 FormField 添加 `htmlFor` prop。
- **全局/私有字段并存**：文章详情页同时存在全局 `read/ignored/bookmarked`（toggle 按钮用）和 per-user `userRead/userIgnored/userBookmarked`（展示徽章用），toggle 操作仍修改全局字段。待后续统一为 per-user 字段。
- **we-mp-rss 测试依赖外部服务**：已添加 health check 跳过逻辑，但同步功能本身未被 E2E 验证（取决于 localhost:8001 可用性）。

## 9. 注意事项

- 后续 agent 必须从 `requirements-confirmation.md` 开始读。
- 不要创建 `src/middleware.ts`（Next.js 16 的 `proxy.ts` 已是 middleware）。
- 不要把 UI 组件库改造提前到权限/数据安全之前（已完成）。
- 不要对数据库做破坏性操作；需要清理/迁移时先 dry-run。
- 按 `development-plan.md` 和 `development-todolist.md` 执行后续工作。
- 前端改造第二轮（Round B）已完成。参考 `docs/superpowers/specs/2026-06-13-round-b-ui-unification-design.md` 和 `docs/superpowers/plans/2026-06-13-round-b-ui-unification.md`。不引入 AntD/HeroUI/TanStack/RHF。
- 新建的 UI 组件（EmptyState、LoadingSkeleton/LoadingIndicator、ErrorBoundary、FormField、PageHeader）遵循项目 convention：`data-slot` 属性、`cn()` 类名合并、`function` 声明 + 底部 `export`、`React.ComponentProps` props 转发。
- UI 改造参考 `docs/audit/ui-refactor-plan.md`。
- Docker/PostgreSQL 恢复后优先运行 `prisma migrate deploy`（已应用过则跳过）+ Playwright 跨浏览器全量回归。
- E2E spec 中已删除路由（/discover、/explore、/my-articles）的测试已添加 `test.skip()` 标注，代码保留以备参考。
- Playwright E2E 修复已完成 admin project 验证，跨浏览器回归优先跑 `pnpm exec playwright test`。

## 10. 2026-06-18 全量审查 + Batch A 残留 P0 补修

> ⚠️ 本节纠正上文 §1-§9 的过期叙事。上文停留在「Batch1-5+Round A/B 全完成」，
> 未记录分支上的全量审查与 P0/P1 修复。事实以本节 + 两份报告为准。

- **全量审查**：《全量审查报告-2026-06-18.md》(Report A) 发现 5 个 P0 + 4 个 P1（静态代码审查确证）。
- **P0/P1 修复**：《修复报告-2026-06-18.md》(Report B) 修复 P0-1/2/4/5 + P1-1/2/3，vitest 720 通过。
- **残留 P0 补修（Batch A，本轮）**：harness-review 发现 Report B 对 P0-3 仅修了读路径，写路径未修。已补：
  - `syncMaterialCard` service 层 owner + archived 防线（A5）。
  - `syncArticle` 过滤他人/归档卡（A4）。
  - 服务层 A/B owner 隔离测试（+5 用例）。
  - 验证：vitest 75 files / 725 通过；lint 0 errors / 67 warnings；build 通过；api-security + sync-records e2e（admin）40 passed / 0 failed。
  - 详见 `development-todolist.md` Stage 10（BA-1/BA-2/BA-3）。

### 当前仍未解决（下一批）

（harness-review 列出的 P0/P1 残留 + E2E 基础设施债均已关闭。无阻塞性遗留。）

> P1-残留-1（`/api/articles` 强制登录）已于 2026-06-18 修复，见 Stage 11（BA-4）。
> P1-残留-2（个人 IMA 同步查询 ADMIN 按 owner 隔离 + 后台运维重同步接口）已于 2026-06-18 修复，见 Stage 12（BA-5/BA-6）。
> E2E 基础设施债（admin fixture token 持久化 P2-1 + RBAC/helper 静态 import + RBAC-PAGE-002 修正）已于 2026-06-18 修复，见 Stage 13（BA-7/BA-8）。
> 类 D（硬编码等待 + 选择器脆弱）已于 2026-06-18 全量完成，见 Stage 14（BA-13）。

## 11. Class D E2E Flaky 清理（2026-06-18）

> ⚠️ Stage 14 BA-13 从 deferred 改为 done。全量 7 阶段执行完毕。

- **根因**：703 failed 中 674 是 "element not found" — 选择器脆弱，非时序/网络问题。
- **Phase 0**：18+ 组件文件添加 `data-testid`（admin 7 页面 + AdminShell + settings/ai-config/wechat-rss/article-detail + SelectTrigger/日期输入消歧义）。
- **Phase 1**：4 spec 用已有 testid 替换标题选择器（review/articles/articles-enhanced/search）。
- **Phase 2**：7+ spec 用新 testid 替换标题选择器（admin/auth/ai-config/wechat-rss/settings/admin-invitations/articles-enhanced detail）。
- **Phase 3**：位置选择器 `.first()`/`.nth()` → testid（admin combobox/auth sidebar/review select/articles 日期）。
- **Phase 4**：**全部 64 个 `waitForTimeout` → 条件等待**（`expect(locator).toBeVisible({timeout})`）。
- **Phase 5**：**全部 24 个 `networkidle` → `domcontentloaded` + 内容断言**（error-states/articles-enhanced/rbac-capability-matrix）。
- **Phase 6**：全量回归 + 额外修复（data-isolation/article-detail/sync-records/sources/admin-dashboard-p16/wechat-rss/mobile-responsive 的残余脆弱选择器）。
- **修改文件**：41 files, +396/-325（19 组件 + 22 spec）。
- **验收**：
  - `pnpm lint`：0 errors / 17 warnings。
  - `pnpm test`：76 files / 735 tests 全通过。
  - `pnpm build`：通过。
  - `pnpm exec playwright test --project=admin --retries=2`：**284 passed, 0 failed, 4 flaky, 17 skipped, 5 did not run**。
  - 4 flaky 为固有竞态（bookmark toggle / login redirect / sidebar collapse / ES-006 metrics 500），非选择器根因。
- **有意排除**：`dead-link.spec.ts` 的 `locator('h1')` 用于 404 检测，属合法模式。
- **未验证风险**：
  - 全量 5-project 回归未重跑（1.7h，仅 admin project 验证）。
  - 4 flaky 测试仍有偶发失败（非选择器根因，需单独排查逻辑竞态）。

---

## 2026-06-18 补充：交互状态契约（Class E）— 4 flaky 根因修复

详见 `docs/handoff/e2e-flaky-state-contract-handoff.md`。

- **范围**：通过 `data-state`/`data-pending`/`aria-*`/`disabled` 属性建立交互状态契约，4 个原 flaky 测试（bookmark toggle / login redirect / sidebar collapse / ES-006 metrics 500）改等待真实状态变化。
- **关键改动**：登录页改服务端组件 `redirect()`；收藏/已读按钮加 pending guard；侧边栏加 `data-state`/`aria-expanded`；ES-006 用 `mockApiError` helper + storageState。
- **验收**：lint 0 errors / test 735 passed / build 通过；4 目标测试隔离运行 ×15-20 全 0 flaky。
- **遗留**：高并发同跑仍有环境性 timeout（非逻辑 flaky，`--retries=1` 可吸收）；5-project 全量长跑未重跑。

---

## 2026-06-20 补充：广东省政府网来源采集质量优化 + AI 全量评估

详见 `docs/superpowers/specs/2026-06-20-guangdong-source-quality-design.md` 与计划 `docs/superpowers/plans/2026-06-20-guangdong-source-quality.md`。

### 1. AI 全量评估（560 篇）
- **背景**：404 篇文章从未做 AI 评估，需识别"无效文章"。
- **执行**：新增 `scripts/ops/assess-pending-standalone.mjs`（自包含，纯 `pg`+`openai`+`node:crypto`，无 `@/` 业务依赖，cp 进 app 容器跑，复刻 `src/services/ai.ts` 的 assessRelevance+scoreContentItem 逻辑）。
- **结果**：评估 402 篇 → accept 340 / reject 58 / skip 4 / error 0。全局终态 accept 454 / reject 93。
- **写库差异**：accept 直接 `adminReviewStatus=approved`+`publicVisibleAt`（自动上架，非默认 pending_admin）；reject 标 filtered/rejected 隐藏。
- **教训**：生产服务器磁盘紧张，**禁止**在其宿主机 pnpm install（曾致 SSH 卡死重启 ECS）。连库用 `docker exec psql` 或自包含脚本进容器跑，不用本地 SSH 隧道（ECONNRESET）。

### 2. 删除无内容/被封禁文章（9 条）
- 已删 9 条（blocked 4 + filtered 过短 5），保留 AI 拒绝。备份 `shenlun-purge-20260619-211950.dump`。

### 3. 广东源栏目优化
- **根因**：广东源通过率仅 64%（212 篇拒 77），3 个栏目都在 `/gdywdt/`（新闻动态），AI 判拒全对（ordinary_news 58 / meeting_news 11 / notice 7）。
- **改动**（纯配置，未动 collector/content-filter 代码）：
  - 停用「部门动态」(`/gdywdt/bmdt/`，拒率 61%)；
  - 「地市动态」maxPages 3→1；
  - 新增「政府文件库」(`/zwgk/wjk/qbwj/`)、「政策解读（部门）」(`/zwgk/zcjd/bmjd/`) 政策类栏目。
- **删旧**：删除该源 77 篇 AI reject（事务，备份 `shenlun-gdquality-20260620-090223.dump`）。删后该源 reject=0，剩 185 篇全 accept/未评估。
- **同步**：`src/scripts/seed-channels.ts` 已更新（部门动态入 DEPRECATED；新栏目命名「政策解读（部门）」避开 DEPRECATED 同名冲突）。commit `5efdc0c`。
- **可采性验证**：文件库列表页有本栏目真实文章链接（`content/post_xxx`），正文页 200+正文可提取；collector 通用 urlPattern 兼容，无需改代码。
- **遗留**：新栏目 `collectedCount=0`，等下次手动/定时采集验证入库量与 AI 通过率；列表页顶部「要闻」推荐链接会被 collector 误抓（既有行为，非本次引入，有去重兜底）。


---

## 文章正文格式修复（2026-06-20，rawHtml + 结构化 fullText）

### 背景
网站采集的文章在详情页正文全部挤成一大段，段落/标题/列表/引用/图片位置丢失。
根因：5 个网站采集器 + 基类 `extractArticleDetail()` 全用 cheerio `.text()` 抠正文，
且从不生成/存储 `rawHtml`。DB 列 `rawHtml`（自 `0_init`）、API、渲染器都已就绪，
只差采集端产出。本地库 476 篇 web_collector 文章，0 篇有 rawHtml。

### 改动（按阶段小步提交）
1. **统一提取器** `src/services/collectors/content-extractor.ts`（新增）：选择器优先级 + 父子去重，
   清洗噪声（nav/footer/广告/分享/相关推荐按完整词 class），修图（懒加载 data-src 等、相对 URL、
   占位图删除），同时产出 `rawHtml`（清洗 HTML）+ 结构化 `fullText`（块级 `\n\n`、`<br>`→`\n`）+
   `effectiveTextLength`。复用 `content-filter` 的 `computeContentHash`，与 wechat 语义一致。
   18 个 fixture 单测覆盖段落/标题/列表/引用/表格/图片/懒加载/父子去重/特殊字符等。
2. **传播 rawHtml**：`RawArticle` 加 `rawHtml`；`extractArticleDetail` 返回 rawHtml（5 采集器 + 基类）；
   `base.ts` RSS 分支（content:encoded 保留为 rawHtml + extractPlainText 生成结构化 fullText）、
   `collectFromChannel`、`normalizeToContentItem` 两处 create 写入 rawHtml；
   `contentHash`/`effectiveTextLength` 改用统一纯函数。微信链路不动（已正确双写）。
3. **导航过滤器回归保护**：`checkNavigationContentFilter` 改按段落块（`\n\n`）统计短文本比例
   （原按单 `\n` 行会把含 `<br>` 折行的短段真实文章误判为导航页）；新增回归 fixture。
4. **渲染器降级**：`splitParagraphs` 先双换行分段、仅单段时降级按单换行拆（兼容无 rawHtml 旧文章）。
5. **回填脚本** `scripts/backfill-article-format.ts`（新增）：`--dry-run`(默认)/`--execute`/`--limit`/
   `--source`/`--article-id`/`--delay-ms`。普通文章用对应采集器重抓（复用选择器+fetchWithRetry，
   含 hunan HTTP 降级）；RSS 类不重抓直接转；只更新 5 个正文字段，不触碰 ai*/审核/收藏/批注/素材卡；
   孤儿跳过、单篇失败不终止、竞态保护。
6. **E2E** `e2e/article-format.spec.ts`（新增）：rawHtml 多段渲染、段落间距、HTML 不外泄、
   `<script>` 清洗、旧文章 fullText 降级、移动端不溢出。

### 验收证据
- `pnpm lint`：所改文件 **0 errors**（仅遗留 archived legacy spec + pre-existing warnings）。
- `pnpm test`：**77 files / 761 passed**（含 18 个新 extractor fixture + 更新后的 6 个采集器断言 +
  content-filter 回归 + 渲染器降级）。
- `pnpm build`：**通过**（Compiled successfully, 91/91 static pages）。
- `pnpm exec playwright test e2e/article-format.spec.ts`：**4 passed**。
- 回填脚本真实 dry-run（本地库）：人民网观点/湖南/广东 各 3 篇 = **9/9 OK**，
  全部新增 rawHtml + contentHash 变化，确认选择器对实时 HTML 仍命中。

### contentHash 变化策略（已与用户确认）
回填会重算 contentHash（fullText 从「挤成一段」→「`\n\n` 分段」）→ 已评估过的文章显示
「评估过期」（`page.tsx:254` hashStale），**不自动重评**（需手动触发）。这是预期行为，
未静默同步 `aiContentHash`。

### 数据库变更
**无 Prisma migration**——`rawHtml String?` 列自 `0_init` 已存在。

### 手动验证步骤
1. 新采集：触发任一网站采集 → 详情页应有多段落/标题/列表/图片在原位置。
2. 历史回填：`pnpm tsx scripts/backfill-article-format.ts --dry-run --source=人民网观点` 看汇总，
   确认后 `--execute` 写入。
3. 旧文章降级：未回填的 web 文章详情页走 fullText 分段（不挤成一段）。
4. 微信/RSS 文章渲染无回归。

### 风险/遗留
- 回填 `--execute` 后大量旧文章会同时显示「评估过期」（可见现象，非 bug）。
- 现有 `e2e/article-detail.spec.ts` 的 `getByText('正文')` 因 hash 标签（评估正文 hash/当前正文 hash）
  触发 strict-mode 是**既有问题**（page.tsx 未改动），与本任务无关。
- 表格 `caption`/`colgroup`、gov 图片防盗链是 DOMPurify/已有局限，本轮未处理。

---

## 文章导出 PDF / Word（2026-06-20，Issue #7）

### 背景
新增文章导出功能：详情页"导出"下拉菜单支持 PDF（无批注/带批注）+ Word `.docx`（无批注/带批注）共 4 种。
开发指令书：`docs/agent/article-export-development-prompt.md`。

### 关键实现
- **PDF**：`react-to-print` v3（`useReactToPrint` hook）→ 浏览器原生打印窗口 → 用户选"另存为 PDF"。A4 打印样式在 `ArticlePrintableContent.tsx` 内联。**不引入服务端 Chromium**（文档硬约束）。
- **Word**：`docx` v9（Document/Paragraph/TextRun/ImageRun/Packer.toBlob）生成**真实 .docx**，非 HTML 伪装。单图失败/不支持格式（webp）降级为 `[图片加载失败]` 占位。
- **批注**：核心难点 `build-annotated-content.ts`。复用 `ArticleContentRenderer` 的归一化匹配思路，但作用于 ExportBlock 结构。编号**按正文首次出现位置排序**（不按 createdAt），同文本多批注 `[1][2]`，未命中归入文末并标"未定位到正文位置"。PDF 与 Word 共用同一套算法（不两套）。
- **正文转换**：`build-export-content.ts` 复用现有 `sanitizeArticleHtml`（含微信图片代理替换），**不复制漂移清洗逻辑**。fullText 无 HTML 时走双换行分段降级。
- **权限**：零改动。导出只消费详情接口已返回的批注（`route.ts:28-62` 非 ADMIN 已过滤他人批注 + 防御性二次过滤），不扩大数据访问范围。
- **交互**：`ArticleExportMenu` 共享 pending 状态防重复点击，trigger `data-pending` + disabled；无批注文章选带批注版 toast 降级提示后仍导出；空正文禁用导出。

### 修改文件
- 新增 `src/lib/article-export/{types,filename,build-export-content,build-annotated-content,download-file,image-loader,build-docx}.ts` + 6 个 `__tests__`
- 新增 `src/components/articles/{ArticlePrintableContent,ArticleExportMenu}.tsx` + 2 个 `__tests__`
- 新增 `e2e/article-export.spec.ts`（8 条，含项目首个 `expect(download)` 下载断言）
- 修改 `src/app/articles/[id]/page.tsx`（工具栏接入 + import）
- 修改 `package.json`/`pnpm-lock.yaml`（react-to-print / docx / file-saver / @types/file-saver）

### 验收证据
- `pnpm lint`：**0 errors**（70 pre-existing warnings）
- `pnpm test`：**85 files / 816 passed**（基线 77/761，新增 8 文件 55 测试，无回归）
- `pnpm build`：**Compiled successfully, 91/91 pages**
- `pnpm exec playwright test e2e/article-export.spec.ts --project=admin --workers=1`：**8 passed / 0 flaky**

### 图片限制阈值（写明，见 development-prompt §七）
- 单图上限 `MAX_SINGLE_IMAGE_BYTES = 3 MB`
- 累计上限 `MAX_TOTAL_IMAGE_BYTES = 15 MB`
- 单图超时 `IMAGE_FETCH_TIMEOUT_MS = 8000ms`
（针对 2 核共享生产主机保守取值；超出降级为文字占位，不中断整篇）

### 手工验证步骤
1. 登录 → 进任一文章详情页 → 顶部应见"导出"按钮。
2. 点"导出" → 下拉含 PDF/Word × 无批注/带批注 4 项。
3. Word 无批注/带批注 → 触发 `.docx` 下载，文件名 `{标题}_{无批注|带批注}.docx`，Word/WPS 能打开。
4. PDF 无批注 → 弹浏览器打印窗口 → 选"另存为 PDF" → 确认 A4、中文字体正常、无批注痕迹。
5. PDF 带批注（对有批注的文章）→ 打印窗口预览正文有 `[n]` 编号 + 文末"文章批注"章节。
6. 无批注文章选带批注版 → 应见 toast"该文章暂无批注，将按不带批注版导出"且仍导出。

### 风险/遗留
- PDF 最终文件排版/中文字体依赖浏览器打印引擎，未自动化（组件单测 + E2E 验证打印 DOM；最终 PDF 手工）。
- Word 真实微信图片经代理嵌入由单测 1×1 PNG 验证，真实图需手工抽查。
- 全量 5-project E2E 未重跑，仅导出专项 + standard 全量。
