# P0 修复实施 TodoList

> 日期：2026-06-06
> 目标：修复 P0 问题，建立可信的 Playwright admin / AI / 素材卡 E2E 验证闭环
> 优先级：P0-001 > P0-004 > P0-002 > P0-003

---

## P0-001: 修复 Playwright admin authentication storageState（最高优先级）

- [x] 修复 `e2e/global-setup.ts` — `waitForURL(/\/admin/)` regex 匹配 login 页面问题
- [x] 添加 cookie 验证：确保 `auth_token` 存在后才保存 storageState
- [x] 修复 `e2e/helpers/auth.ts` — `loginAsAdmin` 同样的 regex 问题
- [x] 修复 `loginAsAdmin` 中 h1 检查（admin 页面用 h2 不是 h1）
- [x] 验证 `.auth/admin-storage.json` 不为空
- [x] 运行 `pnpm exec playwright test e2e/auth.spec.ts --workers=1` 通过

## P0-004: 修复 AI/IMA 设置接口 500

- [x] `playwright.config.ts` webServer 命令添加 `AI_CONFIG_ENCRYPTION_KEY`
- [x] `src/lib/crypto.ts` 添加 `hasEncryptionKey()` 检查函数
- [x] `src/app/api/ai-config/route.ts` GET/POST 密钥缺失时返回友好错误
- [x] `src/app/api/settings/ai-config/route.ts` 同上
- [x] `src/app/api/settings/ima-targets/route.ts` 同上
- [x] 运行 `pnpm exec playwright test e2e/ai-config.spec.ts --workers=1` 通过

## P0-002: 修复 `/cards` 请求失败

- [x] `src/app/cards/page.tsx` fetchCards 区分 401 和其他错误
- [x] 401 时显示 "请登录后查看素材卡" + 登录链接
- [x] 运行 `pnpm exec playwright test e2e/cards.spec.ts --workers=1` 通过

## P0-003: 修复 admin / article detail 页面 heading 语义

- [x] `src/app/admin/page.tsx` h2 → h1
- [x] `src/app/articles/[id]/page.tsx` 确认有 h1 标题
- [x] 运行 `pnpm exec playwright test e2e/admin.spec.ts --workers=1` 通过
- [x] 运行 `pnpm exec playwright test e2e/article-detail.spec.ts --workers=1` 通过

## 全量验证

- [x] `pnpm lint` 通过
- [x] `pnpm test` 通过
- [x] `pnpm build` 通过
- [x] `pnpm exec playwright test` 通过（无 P0 失败）

## 文档交付

- [x] 创建 `docs/testing/p0-e2e-validation-report.md`
- [x] 更新 `docs/audit/development-todolist.md`
- [x] 更新 `docs/testing.md` 基线
- [x] 更新 `docs/testing/playwright-coverage-report.md`
- [x] 更新 `docs/testing/full-project-validation-report.md` Section 9

---

## 根因分析

| P0 | 根因 | 关键文件 |
|----|------|---------|
| P0-001 | `waitForURL(/\/admin/)` 匹配 `/admin/login`，cookie 未设置就保存 | `e2e/global-setup.ts:27`, `e2e/helpers/auth.ts:23` |
| P0-002 | `/cards` 页面公开但 API 需认证，401 显示 "请求失败" | `src/app/cards/page.tsx:100` |
| P0-003 | admin 页面 h2 "控制台概览" vs 测试期待 h1 "系统概览" | `src/app/admin/page.tsx:187` |
| P0-004 | webServer 缺少 `AI_CONFIG_ENCRYPTION_KEY`，crypto.ts 抛异常 | `playwright.config.ts:34`, `src/lib/crypto.ts:9` |
