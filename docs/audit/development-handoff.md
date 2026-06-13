# Development Handoff

生成日期：2026-06-13  
状态：Batch 1-5 + 前端改造第一轮 (A1-A5) + 第二轮 (B-Phase 1-4) 全部完成  
适用：后续 agent 接手前恢复现场

## 1. 当前目标

Batch 1-5（权限、用户管理、学习状态、前台 IA、UI 评估）全部完成。前端改造第一轮（A1 学习状态展示、A2 Articles Tab、A3 旧路由清理、A4 归档箱 Tab、A5 重新生成确认弹窗）已完成。前端改造第二轮（B-Phase 1-4：基础组件 + 表单规范化 + 表格弹窗 + 视觉统一）已完成并通过验证，12 个 Task 全部交付。下一阶段可进入 Playwright E2E 全量回归、Prisma migration 应用，或进入下一轮功能迭代。

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

## 3. 进行中

当前没有业务代码开发进行中。所有计划内 Batch 和前端改造第一轮已完成。

## 4. 下一步

1. **应用 Prisma migration**：Docker/PostgreSQL 启动后运行 `npx prisma migrate deploy` 应用 `20260613_batch3_support` migration（archivedAt + UserContentState 表）。
2. **Playwright E2E 全量回归**：Docker 可用后运行 `pnpm exec playwright test`，重点关注 `auth.spec.ts`、`data-isolation.spec.ts`、`mobile-responsive.spec.ts` 受双登录页和路由变更影响的 spec。Round B 的 UI 组件迁移可能导致 E2E 断言选择器变化（如 data-slot 属性），需排查。
3. **E2E spec 清理**：`/discover`、`/explore`、`/my-articles` 旧路由已删除，9 个 E2E spec 文件可能引用已删除页面，需排查并更新断言。
4. **视觉回归检查**：Round B 中 Card 圆角从 rounded-xl 改为 rounded-lg、登录表单字段移除 rounded-xl 覆盖、按钮语义颜色丢失（admin 禁用/启用/重置按钮），需浏览器端人工确认视觉效果是否可接受。

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
- `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`：通过（Batch 1 阶段验证，20.2s）。
- `pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情" --project=admin`：6 个测试通过（Batch 1 阶段验证，31.2s）。
- `pnpm exec playwright test e2e/middleware.spec.ts --project=admin`：14 个测试通过（Batch 1 阶段验证，1.7m）。
- `pnpm seed:e2e-accounts`：幂等成功，3 个非 admin 账号同步。

## 8. 未验证风险

- **Prisma migration 未应用**：`20260613_batch3_support/migration.sql` 已创建但 Docker/PostgreSQL 未运行，`prisma migrate deploy` 未执行。应用前代码可构建但运行时涉及 `UserContentState` 或 `archivedAt` 的查询会报错。
- **Playwright E2E 未全量回归**：Batch 2-5 + Round A + Round B 改动后未跑完整 E2E。以下 spec 可能受影响：
  - `auth.spec.ts`：双登录页 + `/login` 路由变更。
  - `data-isolation.spec.ts`：学习状态私有化可能需更新断言。
  - `mobile-responsive.spec.ts`：新增 MobileBottomTab 可能需要新断言。
  - `admin.spec.ts`：用户删除改禁用，原断言删除行为的 test 需更新。
- **E2E spec 引用已删除路由**：`/discover`、`/explore`、`/my-articles` 路由页面已在 Round A 中删除，9 个 E2E spec 文件可能包含对这些路由的引用，需逐一排查清理。
- **Round B 视觉回归未验证**：Card 圆角从 rounded-xl 改为 rounded-lg（影响全局所有 Card 组件），登录/注册表单字段移除 rounded-xl 覆盖，Admin 表格操作按钮语义颜色（红/绿/琥珀）在迁移到 shadcn ghost variant 后丢失。需浏览器端人工确认。
- **FormField 缺少 htmlFor**：FormField 组件的 label 不使用 `htmlFor`/`id` 关联，可能影响无障碍审计。若后续有无障碍需求，需扩展 FormField 添加 `htmlFor` prop。
- **Prisma Client 已生成**：`npx prisma generate` 已执行，`src/generated/prisma` 包含 `UserContentState` 类型。
- **全局/私有字段并存**：文章详情页同时存在全局 `read/ignored/bookmarked`（toggle 按钮用）和 per-user `userRead/userIgnored/userBookmarked`（展示徽章用），toggle 操作仍修改全局字段。待后续统一为 per-user 字段。

## 9. 注意事项

- 后续 agent 必须从 `requirements-confirmation.md` 开始读。
- 不要创建 `src/middleware.ts`（Next.js 16 的 `proxy.ts` 已是 middleware）。
- 不要把 UI 组件库改造提前到权限/数据安全之前（已完成）。
- 不要对数据库做破坏性操作；需要清理/迁移时先 dry-run。
- 按 `development-plan.md` 和 `development-todolist.md` 执行后续工作。
- 前端改造第二轮（Round B）已完成。参考 `docs/superpowers/specs/2026-06-13-round-b-ui-unification-design.md` 和 `docs/superpowers/plans/2026-06-13-round-b-ui-unification.md`。不引入 AntD/HeroUI/TanStack/RHF。
- 新建的 UI 组件（EmptyState、LoadingSkeleton/LoadingIndicator、ErrorBoundary、FormField、PageHeader）遵循项目 convention：`data-slot` 属性、`cn()` 类名合并、`function` 声明 + 底部 `export`、`React.ComponentProps` props 转发。
- UI 改造参考 `docs/audit/ui-refactor-plan.md`。
- Docker/PostgreSQL 恢复后优先运行 `prisma migrate deploy` + Playwright 全量回归。
- E2E spec 清理需在 Playwright 可运行后进行，逐 spec 排查引用已删除路由的断言。
