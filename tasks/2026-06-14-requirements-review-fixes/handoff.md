# 交接记录

## 当前目标

执行需求核对修复：采集权限收口、后台采集弹窗、首页口径、复习页空态、文章列表跳详情、个人 AI 测试连接和 WeWe RSS 用户侧提示。

## 当前步骤

实现已完成，验证已记录。剩余事项为既有测试配置/历史 lint 问题，不阻塞本次需求逻辑。

## 已完成

- [x] 创建任务目录。
- [x] 写入 PRD、计划和 TodoList 初稿。
- [x] 将网页采集 POST 收紧为 ADMIN-only。
- [x] 确认微信与 MediaCrawler 采集 POST 已是 ADMIN-only。
- [x] `/admin/articles` 采集按钮改为打开来源选择弹窗，弹窗完成后刷新列表。
- [x] 首页移除采集入口。
- [x] 首页内容条目和最近内容改为全站已审核公开文章。
- [x] 首页素材卡统计保持当前用户个人口径。
- [x] 顶部导航恢复“复习”，顺序为首页/文章/素材卡/检索/复习/设置。
- [x] 复习页无卡空状态按角色引导：USER 去账号设置升级，VERIFIED_USER/ADMIN 去文章页生成卡。
- [x] 文章列表移除侧边详情状态和渲染。
- [x] 前台/后台文章列表行点击和标题点击跳转 `/articles/[id]`。
- [x] `/api/ai-config/test` 使用 VERIFIED_USER 权限且只更新当前用户个人 AI 配置。
- [x] `/settings/ai` 未保存或未启用个人配置时禁用测试连接并说明。
- [x] 非管理员直达 `/settings/integrations/wewe-rss` 时提示仅管理员可用并回到 `/settings`。
- [x] 更新文章列表、复习页、AI 配置和采集权限 E2E/API 覆盖。
- [x] 运行 lint、test、build 和定向 Playwright 验证。

## 已修改文件

- `tasks/2026-06-14-requirements-review-fixes/prd.md` - 记录最终需求与验收标准。
- `tasks/2026-06-14-requirements-review-fixes/plan.md` - 记录实施步骤和文件范围。
- `tasks/2026-06-14-requirements-review-fixes/todolist.md` - 细颗粒度执行清单。
- `tasks/2026-06-14-requirements-review-fixes/handoff.md` - 当前交接状态。
- `src/app/api/collectors/web/collect/route.ts` - POST 权限从 VERIFIED_USER 收紧到 ADMIN。
- `src/components/articles/ArticlesPage.tsx` - 管理后台采集按钮改为打开 `CollectDialog`。
- `src/app/page.tsx` - 移除首页采集入口，调整首页统计与最近内容口径。
- `src/components/RootNav.tsx` - 恢复复习入口并保持素材卡角色可见性。
- `src/app/review/page.tsx` - 复习页空状态按角色显示不同说明和跳转。
- `src/components/articles/ArticlesPage.tsx` - 文章列表改为跳转详情页，并保留后台采集弹窗。
- `src/app/api/ai-config/test/route.ts` - 个人 AI 测试不再回写全局配置，缺个人配置返回明确错误。
- `src/app/settings/ai/page.tsx` - 未配置时禁用测试连接并显示说明。
- `src/app/settings/integrations/page.tsx` - 非管理员直达时 toast 提示并重定向设置页。
- `e2e/articles.spec.ts` - 文章列表行点击改为断言详情页跳转，后台采集断言弹窗。
- `e2e/review.spec.ts` - 按角色覆盖复习页无卡空状态。
- `e2e/ai-config.spec.ts` - 覆盖用户 AI 未配置禁用测试和个人配置测试失败提示。
- `e2e/api-security.spec.ts` - 覆盖 VERIFIED_USER 调采集 POST 被拒绝。

## 验证

- `pnpm build`：通过。
- `pnpm exec playwright test e2e/articles.spec.ts e2e/review.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --project=admin --workers=1`：通过，`64 passed`，`2 skipped`。
- `pnpm lint`：未完全通过，剩余为既有 `tests/e2e` 下 `no-explicit-any` 错误；本次新增 lint 错误已修复。
- `pnpm test`：未完全通过，Vitest 收集到 `tests/e2e` Playwright spec 后报 `Playwright Test did not expect test.describe() to be called here`；386 条 Vitest 测试已执行通过，失败点为既有测试收集配置问题。
- 详细输出与原因见 `validation.md`。

## 未解决问题

- `tests/e2e` 目录仍有既有 `@typescript-eslint/no-explicit-any` lint 错误。
- Vitest 当前会错误收集 `tests/e2e` Playwright specs，需要后续调整测试 include/exclude 或目录约定。
- 首次 Playwright 复用了一个无响应的既有 `localhost:3001` Next 服务；已停止后用干净 webServer 重跑通过。

## 下一步唯一行动

单独处理测试基础设施：修复 `tests/e2e` lint 类型问题，并调整 Vitest 配置避免收集 Playwright specs。
