# 需求核对修复实施计划

## 当前状态

当前项目已具备管理员后台、文章审核、素材卡与复习页。待修点集中在权限收口与交互口径：

- `src/app/api/collectors/web/collect/route.ts` 的 POST 仍允许 VERIFIED_USER。
- `/admin/articles` 采集按钮直接触发网站采集，没有来源选择弹窗。
- 首页对非管理员用 `ownerUserId=currentUser.id` 取内容，导致无私有内容用户首页空。
- `/review` 空状态只说没有素材卡，不能指导 USER 升级或认证用户生成卡。
- `RootNav` 当前本地改动移除了复习入口，需要恢复到确认后的导航顺序。
- 文章列表仍使用 `detailItem` 打开侧边详情。
- `/settings/ai` 测试连接需要只测试个人配置，未配置时禁用并说明。

## 实施步骤

1. 建立执行文档与细颗粒度 TodoList。
2. 收紧采集权限，迁移后台采集交互到弹窗。
3. 调整首页内容统计与最近内容口径。
4. 调整导航与复习页角色空状态。
5. 调整文章列表点击跳转。
6. 修个人 AI 测试连接与 WeWe RSS 用户侧重定向提示。
7. 更新测试并运行验证。
8. 更新 handoff 与 validation。

## 文件范围

预计涉及文件：

- `tasks/2026-06-14-requirements-review-fixes/*`
- `src/app/api/collectors/web/collect/route.ts`
- `src/components/articles/ArticlesPage.tsx`
- `src/app/page.tsx`
- `src/components/RootNav.tsx`
- `src/app/review/page.tsx`
- `src/app/settings/ai/page.tsx`
- `src/app/settings/integrations/page.tsx`
- `src/app/api/ai-config/test/route.ts`
- `e2e/articles.spec.ts`
- `e2e/review.spec.ts`
- `e2e/ai-config.spec.ts`
- `e2e/api-security.spec.ts`

除非在 `handoff.md` 记录范围扩大的原因，否则不要编辑列表外文件。

## 数据 / API / Schema 变更

- 无 schema 变更。
- `POST /api/collectors/web/collect` 权限从 VERIFIED_USER 收紧为 ADMIN。
- `POST /api/ai-config/test` 只测试当前用户个人 AI 配置，缺个人配置返回可展示错误。

## 测试计划

- 定向：
  - `pnpm test -- --run src/app/api/collectors/web/collect/__tests__/route.test.ts`
  - `pnpm exec playwright test e2e/articles.spec.ts e2e/review.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --workers=1`
- 全量：
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`

## 回滚计划

所有改动集中在 UI、API 权限和测试。若需回滚，回退本任务修改文件即可；无数据库迁移和外部服务状态变更。
