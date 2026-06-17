# P1 交接文档：we-mp-rss 权限收紧

## 改了什么

### API 路由权限（5 个 handler，`requireVerifiedUser` → `requireAdmin`）
- `src/app/api/settings/integrations/we-mp-rss/route.ts`（GET / POST / DELETE / PUT）
- `src/app/api/settings/integrations/we-mp-rss/test/route.ts`（POST）

### 前端
- `src/app/settings/page.tsx`：「外部集成」入口条件 `isVerifiedUser` → `isAdmin`（仅此一处，AI/IMA 入口不动）
- `src/app/settings/integrations/page.tsx`：加客户端 admin 守卫，非 admin 直访此 URL 重定向回 `/settings`；移除了旧的 VERIFIED_USER 级守卫

### 测试
- 新建 `src/app/api/settings/integrations/we-mp-rss/__tests__/route.test.ts`（7 用例）
- 新建 `src/app/api/settings/integrations/we-mp-rss/test/__tests__/route.test.ts`（3 用例）
- `e2e/api-security.spec.ts` 追加 6 个用例（5 匿名→401 + 1 ADMIN→200 回归）

## 为什么
we-mp-rss 仅作为管理员后台采集工具。普通（VERIFIED_USER / USER）用户不应配置、调用或看到 we-mp-rss，避免风控面扩大与误配置。

## 权限边界（最终）
| 接口/页面 | USER | VERIFIED_USER | ADMIN |
|---|---|---|---|
| GET/POST/DELETE/PUT `/api/settings/integrations/we-mp-rss` | 403 | 403 | ✅ |
| POST `/api/settings/integrations/we-mp-rss/test` | 403 | 403 | ✅ |
| `/settings` 「外部集成」入口 | 隐藏 | 隐藏 | 显示 |
| `/settings/integrations` 直访 | 重定向 | 重定向 | 正常 |

## 数据库迁移
无。P1 不涉及 schema 改动。

## 测试结果（本地，worktree `p1-p8-review-flow`）
- `pnpm lint`：**0 error，16 warning**（全部为既有未使用变量警告，与 P1 无关）
- `pnpm test`（vitest）：**280/280 passed**（38 文件，含 P1 新增 10 个 we-mp-rss 权限单测）
- `pnpm build`：**成功**
- `pnpm exec playwright test e2e/api-security.spec.ts -g "we-mp-rss"`：**6/6 passed**
  - 5 个匿名 → 401
  - 1 个 ADMIN GET → 200（回归保护）

## ⚠️ 已知问题与 deferred 项

### 1. e2e 缺 VERIFIED_USER→403 用例（deferred 到 P8）
仓库现有 e2e 基础设施仅支持 admin（`global-setup` 只登录 admin，存 `.auth/admin-storage.json`），**没有 VERIFIED_USER fixture 账号，也没有 `loginAsVerifiedUserAPI` helper**。在 P1 里搭这套 fixture 是 P8 的工作（P8-T7 已规划 `loginAsVerifiedUserAPI` + 角色注册流程）。VERIFIED_USER→403 的行为已由单测充分覆盖（10 个用例）。

### 2. 既有 e2e「未认证→401」用例已损坏（与 P1 无关）
`e2e/api-security.spec.ts` 原有 16 个「未认证→401」用例目前**全部失败**（返回 200）。原因：`playwright.config.ts` 顶层 `storageState: '.auth/admin-storage.json'` 让默认 `{ request }` fixture 自带 admin cookie。P1 新增的 6 个用例通过 `test.use({ storageState: { cookies: [], origins: [] } })` 解决了此问题（匿名 describe 块内），但既有 16 个用例未修。**建议单独开 issue 修复，不属于 P1 范围。**

### 3. worktree 环境需手动配 `.env`
worktree 不含 `.env`（gitignored）。已在 worktree 内从主仓库拷贝了 `.env`（含 DATABASE_URL）。若在 worktree 跑 playwright，需显式传 `DATABASE_URL` 和 `AI_CONFIG_ENCRYPTION_KEY`，因为 `playwright.config.ts` 的 `webServer` 命令未传这些 env。

## 相关 commit（worktree 分支 `worktree-p1-p8-review-flow`）
- `d6835ab` test(we-mp-rss): add failing permission tests for settings route lockdown
- `82f286f` test(we-mp-rss): fix auth mock to expose requireVerifiedUser
- `82efc0e` feat(we-mp-rss): lock down settings route to admin only
- `95eb30d` test(we-mp-rss): add failing permission tests for test-connection route
- `f55653d` feat(we-mp-rss): lock down test-connection route to admin only
- `c5630df` feat(settings): hide integrations entry from non-admin users
- `4abcb05` feat(settings/integrations): redirect non-admin users to /settings
- `d81df41` test(e2e): verify we-mp-rss settings routes anon-401 and admin-200

## 给后续 PR 的注意事项
- `/api/integrations/we-mp-rss/**`（管理员同步/采集接口）本就是 `requireAdmin`，P1 未触碰，保持不变。
- 管理员后台 `/admin/integrations/we-mp-rss` 页面保持不动。
- P7 若重构设置页，**保留本 PR 加的 `/settings/integrations` admin 守卫逻辑**。
- P2 会改 schema，与本 PR 无冲突。
