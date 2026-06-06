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

## P1 阶段
- [ ] P1-001：重写 dead-link 检测，去除 Next dev 404 字符串误报
  - 原因：当前 dead-link 测试无法判断真实死链。
  - 涉及文件：`e2e/dead-link.spec.ts`
  - 验收标准：公开页和受保护页真实渲染时不因内联脚本 `404` 失败。
  - 推荐测试：`pnpm exec playwright test e2e/dead-link.spec.ts`

- [ ] P1-002：修复 `/admin/tasks` 表格 key warning
  - 原因：console guard 捕获 React warning。
  - 涉及文件：`src/app/admin/tasks/page.tsx`
  - 验收标准：打开任务页无 unique key warning。
  - 推荐测试：`pnpm exec playwright test e2e/admin.spec.ts -g "异步任务"`

- [ ] P1-003：同步记录失败原因中文化
  - 原因：IMA 404 原样暴露，用户不知道如何修复。
  - 涉及文件：`src/components/sync/*`, `src/services/ima-sync.ts`
  - 验收标准：缺 knowledge base id、token、base URL 时显示可操作中文提示。
  - 推荐测试：`pnpm exec playwright test e2e/sync-records.spec.ts`

- [ ] P1-004：为空素材卡/搜索/复习增加下一步 CTA
  - 原因：新用户路径缺少引导。
  - 涉及文件：`src/app/cards/page.tsx`, `src/app/search/page.tsx`, `src/app/review/page.tsx`
  - 验收标准：无卡片时能一键跳转到文章列表或生成流程。
  - 推荐测试：`pnpm exec playwright test e2e/cards.spec.ts e2e/search.spec.ts e2e/review.spec.ts`

- [ ] P1-005：文章列表移动端改为卡片式浏览
  - 原因：表格在 390px 宽度下阅读体验差。
  - 涉及文件：`src/components/articles/ArticlesPage.tsx`
  - 验收标准：移动端无横向遮挡，标题、来源、时间、AI 状态可读。
  - 推荐测试：`pnpm exec playwright test e2e/mobile-responsive.spec.ts`

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
