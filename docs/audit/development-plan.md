# shenlun-material-hub 开发计划

生成日期：2026-06-13  
状态：当前有效开发计划  
使用方式：后续 agent 必须按本文件执行，不允许跳过文档直接开发。

## 1. Agent 工作流约束

### 1.1 接手前必须阅读

按顺序阅读：

1. `docs/audit/requirements-confirmation.md`
2. `docs/audit/project-assessment.md`
3. `docs/audit/development-plan.md`
4. 若开发已开始，再读：
   - `docs/audit/development-handoff.md`
   - `docs/audit/development-todolist.md`

### 1.2 开发规则

- 不允许上来直接改代码。
- 不允许只看当前报错就局部修。
- 不允许重新发明需求。
- 当前 Batch 内开发。
- 同模块、同风险面的新 bug 可纳入当前任务。
- 跨模块或低优先级问题记录到 `development-todolist.md`，不打断当前任务。
- 每个任务必须先明确测试和验收标准。
- 有代码改动必须跑对应验证。
- 未验证必须写 `Not-tested` 和原因。
- 暂停、完成、切换 agent 前更新 `development-handoff.md` 和 `development-todolist.md`。

### 1.3 提交规则

- 小步提交，保持可回滚。
- 一个独立 bug 尽量一个 commit。
- commit message 使用项目 Lore protocol：
  - 第一行写为什么。
  - 需要时写 `Constraint:`、`Rejected:`、`Confidence:`、`Scope-risk:`、`Tested:`、`Not-tested:`。

## 2. 总体阶段

### Stage 0：文档体系重建

目标：

- 清理旧审计文档。
- 生成三份主文档。
- 生成两份现场文档。

当前状态：进行中。

### Stage 1：补充项目评估证据

目标：

- 不修代码。
- 复查关键冲突。
- 建立验证基线。

命令：

- `git status --short`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- 聚焦 Playwright：
  - `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`
  - `pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情：页面加载" --project=admin`

验收：

- 更新 `project-assessment.md` 的证据状态。
- 更新 `development-todolist.md` 的任务状态。

### Stage 2：分批修复与开发

总体优先级：

1. 权限与数据安全。
2. 用户资产不丢失。
3. 登录/用户管理稳定。
4. 核心学习闭环。
5. 前端 IA 与移动端。
6. UI 组件库改造。

## 3. Batch 0：项目评估补证据

### Task 0.1：建立验证基线

目标：

- 获取当前 lint/test/build 状态。

文件范围：

- 不改文件。

命令：

- `pnpm lint`
- `pnpm test`
- `pnpm build`

验收：

- 记录通过/失败结果。
- 记录 warnings 数量和关键项。

风险：

- 只建立事实，不修复。

### Task 0.2：Admin Users 创建后不可见补证据

目标：

- 确定创建成功后表格不可见的根因。

文件范围：

- `src/app/admin/users/page.tsx`
- `src/app/api/admin/users/route.ts`
- `e2e/admin.spec.ts`

验证：

- 聚焦运行 admin 创建用户测试。
- 捕获 POST 和后续 GET 响应。

验收：

- 明确是刷新 race、排序、筛选、分页、测试选择器还是 API 返回问题。

### Task 0.3：素材卡详情跳转补证据

目标：

- 确定点击素材卡后 URL/详情加载失败的根因。

文件范围：

- `src/app/cards/page.tsx`
- `src/app/cards/[id]/page.tsx`
- `src/app/api/material-cards/[id]/route.ts`
- `e2e/cards.spec.ts`

验证：

- 聚焦运行 cards 详情测试。
- 记录 network、console、page error。

验收：

- 明确是路由、数据状态、权限、请求 pending 还是测试选择器问题。

## 4. Batch 1：权限与数据安全

### Task 1.1：前台登录路由与保护页面

目标：

- 新增/启用 `/login`。
- 未登录访问 `/`、`/cards`、`/search`、`/review` 跳 `/login`。
- `/admin/*` 仍跳 `/admin/login`。
- `/admin/login` 只允许 ADMIN。

文件范围：

- `src/proxy.ts`
- `src/app/admin/login/page.tsx`
- 新增或调整 `src/app/login/page.tsx`
- `src/app/api/auth/login/route.ts`
- `e2e/auth.spec.ts`
- `e2e/middleware.spec.ts`

实现要点：

- 前台和后台登录入口分离。
- 非 ADMIN 不应通过 `/admin/login` 进入后台。
- 前台登录页提供注册入口。

验收：

- 匿名 `/cards`、`/search`、`/review` 跳 `/login`。
- 匿名 `/admin` 跳 `/admin/login`。
- USER/VERIFIED_USER 使用 `/admin/login` 正确密码仍提示无后台权限。

测试：

- `pnpm exec playwright test e2e/auth.spec.ts e2e/middleware.spec.ts`
- `pnpm test src/app/api/auth/login/__tests__/route.test.ts`

### Task 1.2：私有素材卡详情 Owner/Admin 边界

目标：

- Owner 可访问自己的卡片详情。
- ADMIN 可访问任意卡片详情。
- 非 owner 返回 404。

文件范围：

- `src/app/api/material-cards/[id]/route.ts`
- `src/app/cards/[id]/page.tsx`
- `e2e/material-card-ownership.spec.ts`

实现要点：

- 普通用户跨 owner 访问隐藏资源存在性。
- 页面错误态不要泄露目标卡片信息。

验收：

- A 用户不能看 B 用户卡片。
- ADMIN 能看 A/B 卡片。

### Task 1.3：审核 reject/downlist 不删除用户私有卡

目标：

- reject/downlist 只下架文章。
- 已有用户私有卡保留。
- 禁止后续新生成。

文件范围：

- `src/app/api/admin/content-items/review/route.ts`
- `src/app/api/content-items/[id]/generate-card/route.ts`
- `prisma/schema.prisma` 如需新增下架字段
- `src/app/api/admin/content-items/review/__tests__/route.test.ts`

实现要点：

- 移除 reject 时 `materialCard.deleteMany`。
- 标记文章 rejected/downlisted。
- 下架文章不进入普通搜索/文章列表。
- 收藏过的用户历史入口只读展示并标记下架。

验收：

- reject 后已有卡片仍存在。
- reject 后生成卡返回明确错误。
- 强制 approve 必填原因并入审计。

### Task 1.4：IMA 禁止 env fallback

目标：

- 所有用户包括 ADMIN 都必须使用自己的 `ImaTarget`。
- 没有可用 target 时返回明确错误。

文件范围：

- `src/services/ima-sync.ts`
- `src/app/api/settings/ima-targets/route.ts`
- `src/components/SyncToIma.tsx`
- `src/components/sync/SyncRecordsPage.tsx`

实现要点：

- `resolveImaConfig(userId)` 没有 target 时抛业务错误。
- 不使用 `IMA_API_KEY` 等 env fallback 作为用户同步配置。

验收：

- 无 target 时前端提示配置个人 IMA。
- ADMIN 无个人 target 也不能同步。

### Task 1.5：关键写操作审计覆盖

目标：

- 覆盖用户管理、审核、危险操作、配置变更。
- 敏感字段脱敏。

文件范围：

- `src/lib/audit-logger.ts`
- `src/app/api/admin/users/*`
- `src/app/api/admin/content-items/review/route.ts`
- 设置/集成相关 API

实现要点：

- AdminLog/AuditLog 记录操作者、动作、目标、摘要、原因。
- AI/IMA key、cookie、authorization 不入明文日志。

验收：

- 关键写操作可在日志中追踪。
- 密钥类只记录是否存在或掩码。

## 5. Batch 2：用户管理与后台稳定性

### Task 2.1：Admin Users 创建后立即可见

目标：

- 创建用户成功后，新用户必须立即显示在表格。

文件范围：

- `src/app/admin/users/page.tsx`
- `src/app/api/admin/users/route.ts`
- `e2e/admin.spec.ts`

实现要点：

- 创建成功后刷新到包含新用户的视图。
- 避免旧请求覆盖新状态。
- 必要时清空筛选或插入新用户到列表首位。

验收：

- toast 成功后表格中可见新用户名。

### Task 2.2：Admin Users JSON 400

目标：

- 空 body / 坏 JSON 返回 400。

文件范围：

- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/users/route.ts`
- route tests

实现要点：

- 用共享 helper 或局部 try/catch 解析 JSON。
- 避免服务端异常日志。

验收：

- PUT/POST malformed JSON 返回结构化 400。

### Task 2.3：用户删除改禁用

目标：

- 本阶段不提供删除用户。
- UI/API 使用禁用/启用。

文件范围：

- `src/app/admin/users/page.tsx`
- `src/app/api/admin/users/[id]/route.ts`

实现要点：

- 删除按钮移除或改为禁用。
- 如保留 DELETE，返回 405 或仅 ADMIN 内部不可见。

验收：

- UI 不提供删除用户入口。
- 禁用用户 session 立即失效。

### Task 2.4：AdminLogsPage key warning

目标：

- 消除 React unique key warning。

文件范围：

- `src/app/admin/logs/page.tsx`
- `e2e/admin.spec.ts`

实现要点：

- `<>` 改为 `<Fragment key={log.id}>`。

验收：

- console guard 不再捕获 key warning。

## 6. Batch 3：学习状态与素材卡生命周期

### Task 3.1：用户私有文章学习状态

目标：

- 阅读、收藏、忽略、复习状态全部用户私有。

文件范围：

- `prisma/schema.prisma`
- favorites/review/articles API
- `src/app/articles/*`
- `src/app/review/page.tsx`

实现要点：

- 不再用 `ContentItem.read/bookmarked/ignored` 表示个人状态。
- ArticleFavorite 或新表承载复习状态。

验收：

- A 用户状态不影响 B 用户。

### Task 3.2：素材卡软删除/归档箱

目标：

- 删除改为归档。
- 默认列表/搜索/复习/IMA 排除归档卡。
- 归档箱可查看和恢复。

文件范围：

- `prisma/schema.prisma`
- material-cards API
- `/cards` 页面
- `/search`、`/review`、IMA sync

验收：

- 归档后默认不可见。
- 恢复后学习状态保留。

### Task 3.3：重新生成覆盖流程

目标：

- 已有卡片复用/打开。
- 显式重新生成才覆盖。
- 覆盖前二次确认。
- 覆盖后重置复习状态。

文件范围：

- generate-card API
- card detail/list UI
- review state

验收：

- 普通生成不重复堆卡。
- 重新生成行为可预期且有确认。

## 7. Batch 4：前台 IA 与移动端

### Task 4.1：`/articles` 合并文章入口

目标：

- `/articles` 提供 `全部 / 推荐 / 收藏` Tab。
- 删除 `/discover`、`/explore`、`/my-articles`。

文件范围：

- `src/app/articles/page.tsx`
- `src/components/articles/ArticlesPage.tsx`
- 删除旧路由页面
- e2e articles/search/review

验收：

- 主导航只保留 `/articles`。
- 推荐为人工精选/置顶。
- 收藏 Tab 用于管理和继续阅读。

### Task 4.2：角色化首页

目标：

- `/` 登录后保留角色化首页。
- 未登录跳 `/login`。

文件范围：

- `src/app/page.tsx`
- `src/components/RootNav.tsx`

验收：

- USER 首页突出文章学习。
- VERIFIED_USER 首页突出文章到卡片闭环。
- ADMIN 有后台入口但不混入前台审核动作。

### Task 4.3：响应式前台与底部 Tab

目标：

- 同项目响应式移动端。
- 前台移动底部 Tab 按角色显示。

文件范围：

- `src/components/RootNav.tsx`
- 全局 layout/nav
- `e2e/mobile-responsive.spec.ts`

验收：

- 390px 宽度无横向溢出。
- USER/VERIFIED_USER/ADMIN 底部入口正确。

## 8. Batch 5：UI 改进置后

目标：

- 在权限/数据/核心闭环稳定后再做。

范围：

- UI 技术栈评估。
- shadcn/Tailwind 组件规范。
- loading/empty/error 统一。
- 表格/表单规范。
- 不默认引入 AntD/HeroUI/TanStack/RHF。

验收：

- 单独输出 UI assessment/refactor plan/todolist。
- 不影响 Batch 1-4 主线。

## 9. 全局验证命令

小任务验证：

- 相关 route/component 单测。
- 相关 Playwright spec。

标准验证：

- `pnpm lint`
- `pnpm test`
- `pnpm build`

UI/前端任务额外：

- `pnpm exec playwright test <relevant spec>`
- 必要时移动端截图或 console guard。

完整回归：

- `pnpm exec playwright test`

若全量 E2E 未跑完，必须在 handoff 中写明未验证范围。
