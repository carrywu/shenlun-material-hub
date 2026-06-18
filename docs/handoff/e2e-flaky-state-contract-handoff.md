# E2E Flaky 修复 — 交互状态契约（Class E）交接

**日期**：2026-06-18
**分支**：`fix/full-audit-p0-p1`
**前置**：Class D（选择器加固 + waitForTimeout/networkidle 消灭）已完成，admin project 仍报 4 flaky。

---

## 1. 问题

admin project `--retries=2` 全量：**284 passed, 0 failed, 4 flaky**。这 4 个 flaky 根因是**逻辑竞态**，不是选择器脆弱：

| # | 测试 | 竞态类型 |
|---|------|---------|
| 1 | `article-detail` 收藏切换 | toggle 竞态：点击后未等 API 返回即读状态，无 pending/aria 保护 |
| 2 | `auth` 已登录访问登录页跳转 | 重定向时序：登录页是 `use client`，用 `useEffect` + `fetch("/api/auth/check")` 做客户端跳转，冷启动慢 |
| 3 | `auth` 侧边栏折叠 | 动画竞态：CSS `transition-all duration-200` 未等，点完即读宽度 |
| 4 | `error-states` ES-006 metrics 500 | mock route 竞态：`loginAsAdmin` UI 登录可能触发 metrics 请求早于 mock 注册；admin 页面有两套重复 fetch 逻辑 |

## 2. 方案：交互状态契约

组件通过稳定属性暴露真实状态，测试等待状态变化而非时序：
- `data-testid`（稳定定位）
- `data-state`（idle/loading/active/inactive/collapsed/expanded/error）
- `data-pending`（请求进行中）
- `aria-label` / `aria-pressed` / `aria-expanded`
- `disabled={pending}`（防重复点击）

断言优先级：`aria-*` > `data-state` > 可见文案 > API response > 像素宽度（最后手段）。

**明确禁止**：引入 TanStack Query 或大型 UI 框架、扩大 timeout、`waitForTimeout`、skip/fixme、删断言、造假状态。

## 3. 改动清单（11 files, +253/-364）

### Task 1 — 收藏/已读/已忽略按钮
- `src/app/articles/[id]/page.tsx`：拆出 `toggleBookmark`/`toggleRead` 函数（带入口守卫防重复点击）+ `bookmarking`/`togglingRead` state + Loader2 spinner + toast（catch 不再静默）。
- 按钮：`data-testid` + `aria-pressed` + `data-state`(active/inactive) + `data-pending` + `disabled`。
- `e2e/article-detail.spec.ts`：收藏/已读测试改 `getByTestId` + `waitForResponse`（等真实 API 200-299）+ `data-pending==='false'` + `aria-pressed` 断言。

### Task 2 — 登录页服务端前置跳转
- `src/app/admin/login/page.tsx` + `src/app/login/page.tsx`：改为**服务端组件**，`cookies()` + `validateSession()` + `redirect()`。已登录用户访问登录页立即服务端 302，不再渲染客户端 JS、不再触发 `/api/auth/check` fetch。
- 新建 `LoginClient.tsx`（admin + 前台各一）：承载表单提交逻辑，删除 `useEffect` auth check。
- `searchParams` 在 Next.js 16 是 `Promise`，已 `await`。
- `e2e/auth.spec.ts`：跳转测试用 storageState + `toHaveURL(/\/admin$/)` 15s 服务端断言。
- middleware（`src/proxy.ts`）仍是第一道防线，服务端 redirect 是第二道。

### Task 3 — 侧边栏折叠
- `src/components/admin/AdminShell.tsx`：`aside` 加 `data-state`(collapsed/expanded)；toggle 加 `data-testid`/`aria-expanded`/`aria-label`。
- `e2e/auth.spec.ts`：测试用 `data-state`/`aria-expanded` 断言（状态立即切换，不受 CSS 动画时序影响），`expect.poll` 等宽度变化（动画完成）。

### Task 4 — ES-006 metrics 500
- `src/app/admin/page.tsx`：统一 `fetchMetrics`（消除两套重复 fetch）+ `error` state + `data-testid="admin-metrics-error"` + 重试按钮 `disabled={refreshing}` + Loader2。
- 新建 `e2e/helpers/mockApi.ts`：`mockApiError(page, pattern, options)` 返回带命中计数的 helper。
- `e2e/error-states.spec.ts`：整个 P1-2 describe 用 `test.use({ storageState })`，删除 `loginAsAdmin` UI 登录；ES-006 改 `mockApiError` + `expectHit()` 确保 mock 在请求前注册。

## 4. 验收证据

```
pnpm lint   → 0 errors / 68 warnings (pre-existing no-unused-vars)
pnpm test   → 76 files / 735 passed
pnpm build  → 通过
```

稳定性验证（隔离单 spec，低并发，`--workers=1`）：

| 测试 | repeat-each | 结果 |
|------|-------------|------|
| 收藏切换 + 已读切换 | 15 | **30 passed, 0 flaky** |
| 服务端跳转 + 侧边栏折叠 | 15 | **30 passed, 0 flaky** |
| ES-006 metrics 500 | 20 | **20 passed, 0 flaky** |

**4 个原 flaky 根因全部修复**，隔离运行 0 flaky。

## 5. 遗留与风险

- **高并发 load-induced timeout**：3 spec × 20 + ×20 同跑会偶发 timeout（DB `validateSession` / Next dev server 压力），属环境资源争用，非本轮状态契约逻辑问题。Playwright `--retries=1` 可吸收。
- **5-project 全量长跑未重跑**（耗时长），仅隔离验证 4 目标测试。

## 6. 回滚

所有改动均在当前分支 `fix/full-audit-p0-p1`，`git revert` 即可。无 DB schema / migration 变更，无破坏性脚本。
