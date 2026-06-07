# 下一步开发 TodoList

## P0 阶段 — ✅ 全部完成 (2026-06-06)

- [x] P0-001：修复 Playwright admin 认证 storageState ✅
  - 修复 `waitForURL` 正则 + cookie 验证 + storageState 空 cookie fallback
  - 涉及文件：`e2e/global-setup.ts`, `e2e/helpers/auth.ts`, `e2e/auth.spec.ts`, `e2e/admin.spec.ts`
  - 验证：160 passed / 0 failed / 12 did not run

- [x] P0-002：修复 `/cards` 请求失败 ✅
  - 区分 401 和其他错误，显示友好提示 + 登录链接
  - 涉及文件：`src/app/cards/page.tsx`
  - 验证：cards spec 全部通过

- [x] P0-003：修复 admin 页面 heading 语义 ✅
  - AdminShell 提供 h1，子页面 h1 → h2
  - 涉及文件：`src/app/admin/users/page.tsx`, `src/app/admin/clean/page.tsx`
  - 验证：admin spec 全部通过

- [x] P0-004：修复 AI/IMA 设置接口 500 ✅
  - 添加 `hasEncryptionKey()` + 密钥缺失返回 503
  - 涉及文件：`src/lib/crypto.ts`, 3 个 AI config route, `playwright.config.ts`
  - 验证：ai-config + settings spec 全部通过

> **详细验证报告**: `docs/testing/p0-e2e-validation-report.md`

## P1 阶段 — ✅ 全部完成 (2026-06-07)

- [x] P1-001：重写 dead-link 检测，去除 Next dev 404 字符串误报 ✅
  - 改用 `page.title()` + `h1` 精确匹配，移除 `body.textContent` 误报
  - 涉及文件：`e2e/dead-link.spec.ts`
  - 验证：174 passed / 0 failed / 2 flaky (pre-existing)

- [x] P1-002：修复 `/admin/tasks` 表格 key warning ✅
  - `<>` Fragment → `<Fragment key={task.id}>`，消除 React key warning
  - 涉及文件：`src/app/admin/tasks/page.tsx`, `e2e/admin.spec.ts`
  - 验证：consoleGuard 无 key warning，admin spec 全部通过

- [x] P1-003：同步记录失败原因中文化 ✅
  - 新建 `src/lib/error-messages.ts`（`translateSyncError()`），在 SyncToIma + SyncRecordsPage 前端显示层翻译
  - 涉及文件：`src/lib/error-messages.ts` (新建), `src/components/SyncToIma.tsx`, `src/components/sync/SyncRecordsPage.tsx`
  - 验证：sync-records spec 中文检查通过，错误消息不包含原始英文 API 错误

- [x] P1-004：为空素材卡/搜索/复习增加下一步 CTA ✅
  - Search 初始状态和无结果状态添加跳转链接；Review 空状态添加"查看素材卡"按钮
  - 涉及文件：`src/app/search/page.tsx`, `src/app/review/page.tsx`
  - 验证：search + review spec CTA 链接测试通过

- [x] P1-005：文章列表移动端响应式适配 ✅
  - 表格列 `hidden md:table-cell` 隐藏次要列；详情面板移动端全屏 overlay；筛选区 `grid-cols-2 md:grid-cols-4`
  - 涉及文件：`src/components/articles/ArticlesPage.tsx`
  - 验证：mobile-responsive spec 文章列表无横向溢出，iPhone 13 + iPad Pro 均通过

## P2 阶段
- [ ] P2-001：重建 visual regression 截图策略和基线
  - 原因：`/explore`、`/discover` full-page 高度与 720px baseline 冲突。
  - 涉及文件：`e2e/visual-regression.spec.ts`, `e2e/__screenshots__/*`
  - 验收标准：明确 fullPage/viewport 两类断言，14 个 visual tests 稳定通过。
  - 推荐测试：`pnpm exec playwright test e2e/visual-regression.spec.ts`

- [ ] P2-002：设置页增加 onboarding checklist
  - 原因：新用户不知道先配置 AI、来源、采集还是 IMA。
  - 涉及文件：`src/app/settings/page.tsx`, `src/components/settings/*`
  - 验收标准：首次进入能看到 5 步工作流和每步状态。
  - 推荐测试：Playwright 截图 + `pnpm lint`

- [ ] P2-003：为危险操作建立临时库 E2E profile
  - 原因：来源删除、清洗、备份、用户禁用不能在真实状态随意执行。
  - 涉及文件：`playwright.config.ts`, `e2e/admin.spec.ts`, `e2e/sources.spec.ts`
  - 验收标准：临时库可跑取消、预览、确认路径，运行后可丢弃。
  - 推荐测试：临时 `DATABASE_URL` 下运行相关 spec。

## P3 阶段
- [ ] P3-001：建立 CI 分层门禁
  - 原因：全量 E2E 成本高且失败时反馈过大。
  - 涉及文件：`.github/workflows/*`, `package.json`
  - 验收标准：lint/unit/build/a11y/smoke/visual 分层报告。
  - 推荐测试：CI dry-run 或本地等价命令。

- [ ] P3-002：Prompt 版本管理
  - 原因：AI 评估和素材卡生成需要可追溯。
  - 涉及文件：`src/services/ai.ts`, `prisma/schema.prisma`
  - 验收标准：生成结果记录 promptVersion 和模型配置摘要。
  - 推荐测试：unit + migration dry-run。

- [ ] P3-003：线上错误监控与日志聚合
  - 原因：500、同步失败、AI 配置错误需要集中排障。
  - 涉及文件：`src/lib/logger.ts`, `src/lib/audit-logger.ts`, API routes
  - 验收标准：按 category、route、user、taskId 查询错误。
  - 推荐测试：route tests + 手动触发非破坏性错误。
