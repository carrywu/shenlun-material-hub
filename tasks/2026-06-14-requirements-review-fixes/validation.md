# 验证记录

## 已运行命令

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm exec playwright test e2e/articles.spec.ts e2e/review.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --workers=1`
- `pnpm exec playwright test e2e/articles.spec.ts e2e/review.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --project=admin --workers=1`

## 结果

### `pnpm lint`

结果：未完全通过。

本次新增的 lint 错误已修复。当前剩余阻塞为既有 `tests/e2e` 目录的 `@typescript-eslint/no-explicit-any` 错误：

- `tests/e2e/api-errors.spec.ts:51`
- `tests/e2e/api-errors.spec.ts:58`
- `tests/e2e/helpers/test-data.ts:12`
- `tests/e2e/helpers/test-data.ts:21`
- `tests/e2e/helpers/test-data.ts:30`
- `tests/e2e/helpers/test-data.ts:42`
- `tests/e2e/helpers/test-data.ts:51`
- `tests/e2e/helpers/test-data.ts:60`
- `tests/e2e/helpers/test-data.ts:69`
- `tests/e2e/helpers/test-data.ts:81`

另有若干 warnings，不阻塞退出码。

### `pnpm test`

结果：未完全通过。

Vitest 成功执行了 55 个测试文件中的 386 条测试，但随后收集到 `tests/e2e` 下的 Playwright spec，触发：

- `Playwright Test did not expect test.describe() to be called here`

该问题表现为 Vitest 配置把 Playwright 测试纳入收集范围，属于既有测试配置问题，不是本次需求逻辑失败。

### `pnpm build`

结果：通过。

关键输出：

- `✓ Compiled successfully`
- `Finished TypeScript`
- `✓ Generating static pages using 7 workers (87/87)`

### 首次定向 Playwright

命令：

```bash
pnpm exec playwright test e2e/articles.spec.ts e2e/review.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --workers=1
```

结果：中断后重跑。

原因：Playwright 配置复用了已有的 `localhost:3001` Next 服务，但该服务 10 秒内无响应。`curl -I --max-time 10 http://localhost:3001/admin/settings/ai` 超时；第一条 AI 配置用例在 `page.goto('/admin/settings/ai')` 处 60s 超时。已停止无响应的本地 Next/Playwright 进程后重跑。

### 干净重跑定向 Playwright

命令：

```bash
pnpm exec playwright test e2e/articles.spec.ts e2e/review.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --project=admin --workers=1
```

结果：通过。

关键输出：

- `Running 66 tests using 1 worker`
- `2 skipped`
- `64 passed (3.5m)`

覆盖范围：

- AI 配置页个人测试连接禁用与失败提示。
- 采集接口 VERIFIED_USER 被拒绝。
- 文章列表点击行跳详情页。
- 后台文章采集按钮打开来源选择弹窗。
- 复习页 USER 与 VERIFIED_USER/ADMIN 空状态引导。
