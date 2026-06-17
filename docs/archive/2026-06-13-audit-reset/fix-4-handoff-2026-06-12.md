# fix-4 交接文档（P0-004 e2e 修复批次）

> **生成时间**：2026-06-12
> **状态**：fix-4 完成（已 commit），**未跑验证轮**（用户要求暂停开发）
> **分支**：`worktree-p1-p8-review-flow`（worktree：`.claude/worktrees/p1-p8-review-flow`）
> **下一动作**：跑一次完整 e2e 验证 fix-4，再进 fix-5（视觉回归 baseline）或 P0-001/002/003

---

## 1. 本次会话做了什么

P0-004（e2e storageState 重建）落地后暴露了一批 e2e 失败（run 8 = 61 failed）。fix-1/2/3 已收掉大头，**fix-4 收掉剩余的真实失败**。进度：61 → 18 failed（run 19，已 commit 全部修复但**未复跑验证**）。

### 本次会话新增的 commit（fix-4）

| commit | 内容 | 失败用例 |
|---|---|---|
| `6f1e2ef` | ConsoleGuard 过滤良性导航中止 fetch 错误 | data-isolation:119（+ 间接缓解 auth:55 等 dashboard 跳转用例） |
| `92bba3e` | article-detail 已读切换 race / AI 评估按钮身份 / articles 行点击 selector / RootNav 移动端溢出 | article-detail:76、article-detail:174、articles:103、mobile:41（×2 视口） |

> 之前会话已 commit（仍生效，列此备查）：`ba20433` seed cookie、`bf4c1a5` global-setup 冷启、`faa999b` 选择器收紧、`7fcc856` auth toHaveURL、`2df0229` 异步轮询、`6417fc0` option label、`e01a0af` articles 500、`3391c60` clean column quoting、`e6a8591`+`9461405`+`35d434f` fix-1/2。

---

## 2. 每个修复的根因 + 改动

### 2.1 ConsoleGuard 良性错误过滤（`6f1e2ef`）
- **文件**：`e2e/helpers/consoleGuard.ts`
- **根因**：`/TypeError/i` 关键词把浏览器**导航中止 fetch**（`TypeError: Failed to fetch`）当真实错误。Playwright `page.goto` 会主动取消未完成请求（如 dashboard 的 `/api/admin/metrics`），任何"加载 dashboard 后立即跳走"的用例都会误报。
- **改法**：新增 `BENIGN_PATTERNS`（`Failed to fetch` / `Load failed` / `NetworkError` / `aborted` / `navigation`），critical 检查前先剔除良性错误。

### 2.2 article-detail 已读切换 race（`92bba3e`）
- **文件**：`e2e/article-detail.spec.ts:76`
- **根因**：PUT `/api/content-items/[id]` 是异步的，`setArticle` 在 `res.ok` 后才更新 title。固定 `waitForTimeout(500)` 和 API 响应赛跑——run19 两次重试甚至出现**方向相反**的失败（一次预期"标记未读"得到"标记已读"，重试反过来）。
- **改法**：`expect.poll` 轮询 title 翻转，5s 超时。

### 2.3 article-detail AI 评估按钮（`92bba3e`）
- **文件**：`e2e/article-detail.spec.ts:174`
- **根因**：`src/app/articles/[id]/page.tsx:888` —— AI 评估按钮**仅在 `!isAdmin` 时渲染**（admin 看到的是"前往后台文章管理"提示卡）。该 describe 文件级用 admin storageState，所以按钮永远不出现。
- **改法**：该单测 `test.use({ storageState: '.auth/verified-storage.json' })` 覆盖为普通用户身份。

### 2.4 articles 行点击 selector（`92bba3e`）
- **文件**：`e2e/articles.spec.ts:103`
- **根因**：`.w-1\/2.border-l` 是脆弱的 tailwind 类名（`w-1/2` 仅 `md:` 断点生效）；且行内点击目标是 `absolute inset-0 z-10 cursor-pointer` 透明 overlay，直接 `row.click()` 可能命中背景不触发 `onClick`。
- **改法**：优先点 `.cursor-pointer.z-10` overlay；用面板内"关闭"按钮出现作为"面板已开"的稳定信号。

### 2.5 RootNav 移动端横向溢出（`92bba3e`）—— **真实 UI bug**
- **文件**：`src/components/RootNav.tsx`
- **根因**：顶部导航 9 个链接 + 文字标签无响应式处理。390px 视口下 nav 宽 572px → body scrollWidth 820px（2.1× 视口）。**不是测试噪声，是真实布局 bug。**
- **改法**：nav 改 `overflow-x-auto` + 隐藏滚动条；标签 `hidden lg:inline`（< 1024px 仅图标）；padding 移动端收紧；标题文字 `< sm` 隐藏。
- **验证**：实测 390px → 390px（ratio 1.00），1024px → 1024px（ratio 1.00）。**已修。**

---

## 3. 当前 e2e 状态（run 19，**fix-4 未复跑**）

run 19（fix-4 commit 前的基线）：**18 failed, 8 flaky, 17 skipped, 15 did not run, 243 passed**。

18 failed 分类：

| 类别 | 数量 | 用例 | fix-4 状态 |
|---|---|---|---|
| 视觉回归 toHaveScreenshot | 8 | visual-regression（dashboard/settings/admin 等） | **未处理** → fix-5（baseline 更新） |
| 真实失败（本次修） | 7 | article-detail:76/174、articles:103、mobile:41×2、data-isolation:119、admin clean×2 | **已 commit**，**未复跑验证** |
| admin clean×2 | 2 | admin:374、admin:451 | clean 路由已在 `3391c60` 修（column quoting），run19 时 dev server 未拾取最新编译；本次手测 `/api/admin/clean` 返回 200 ✓。checkbox 是 base-ui `button[role=checkbox]`，preview 正常即渲染。**应已自然恢复** |
| 已知非安全 | 1 | we-mp-rss:111（同步来源） | **未处理** —— curl 直调 API 正常，e2e 点击链 30s 内无 UI 响应。非安全相关，可 skip 或单独排查 |

> 8 flaky（auth:36、cards:83、sources×4、ai-config:134、error-states:65）多为冷启/时序，ConsoleGuard 修复 + 服务器预热后预期自然转绿。

---

## 4. ⚠️ 关键：fix-4 **没有跑验证轮**

本次会话所有 fix-4 commit（`6f1e2ef`、`92bba3e`）**只在单点手测过**（curl、playwright 单测片段），**没跑完整 e2e 验证**。用户要求"完成 fix-4 给我生成交接文档然后暂停开发"。

**恢复时第一件事**：跑一次完整 e2e，确认 fix-4 真的把 18 → 预期 ≤ 10（剩 visual 8 + we-mp-rss 1 + 可能残留）。

```bash
cd /Users/apple/Downloads/ima-shenglun-creators/shenlun-material-hub/.claude/worktrees/p1-p8-review-flow
# 杀掉残留 dev server（必须让 playwright webServer 用 JWT_SECRET=playwright-test-secret 独占 :3001）
lsof -ti:3001 | xargs kill -9 2>/dev/null
rm -rf test-results/* playwright-report/*  # tmpfs inode 配额，每次跑前必清
JWT_SECRET=playwright-test-secret pnpm test:e2e 2>&1 | tee /tmp/run20.log
# 解析失败列表
sed 's/\x1b\[[0-9;]*m//g' /tmp/run20.log | grep -oE "[0-9]+\) \[chromium\] › e2e/[^ ]+ › .+" | sort
```

---

## 5. 待办（按优先级）

### fix-5：视觉回归 baseline（#104，pending）
8 个 `toHaveScreenshot` 失败，全部 `1280x769 vs 1280x720`（5% 像素差）。是 viewport/CSS 漂移，非功能 bug。
- **决策点**：更新 baseline（`pnpm exec playwright test --update-snapshots`）还是放宽 maxDiffPixelRatio。**推荐先查 1280x769 是否 RootNav 高度变化导致**（本次改了 nav 文字显隐，可能影响截图）——若是，更新 baseline；若不是，查 viewport 配置。

### fix-6：复跑 + 残余（#105，pending）
fix-4 + fix-5 后的最终全量复跑。

### P0-001/002/003（#97/98/99，pending）—— 安全修复主体
**e2e 转绿前不开始**（决策 10：staging 必绿）。
- **P0-001**：`GET /api/content-items/[id]` include 加 `where: { ownerUserId: user.id }`（非 ADMIN）。plan：`docs/superpowers/plans/2026-06-12-p0-001-article-detail-isolation.md`
- **P0-002**：收藏配额事务内 `pg_advisory_xact_lock(hashtext(userId))` + count + createMany。plan：`docs/superpowers/plans/2026-06-12-p0-002-favorites-toctou.md`
- **P0-003**：AsyncTask 加 `dedupeKey` + partial unique index + `createDedupTask`。plan：`docs/superpowers/plans/2026-06-12-p0-003-task-rate-limit.md`

### we-mp-rss:111（非阻塞）
非安全相关集成测试。curl `/api/we-mp-rss/.../sync` 直调正常，但 e2e 点击"同步来源"按钮 30s 内无 UI 响应。可 skip 或在 fix-6 单独排查（怀疑前端未正确处理 sync 响应或 toast 未触发）。

---

## 6. 安全约束（必须保持，逐字）

- 🚫 不允许 reset 生产/staging 数据库
- 🚫 不允许测试失败却声称完成
- 🚫 不允许只靠前端隐藏按钮代替后端权限校验
- 🚫 不允许只靠 unique index 解决配额并发（必须有 advisory lock）
- 🚫 事务外 count 后事务内 insert 禁止
- 🚫 storageState 污染未登录测试禁止
- 🚫 使用管理员 cookie 假装普通用户测试禁止
- 🚫 大面积 any 掩盖类型错误禁止
- ⚠️ 决策 10：staging 必绿，单点死磕不降级（卡死时找用户介入，不自行跳过）

---

## 7. 关键技术坑（本会话踩过的）

- **Postgres 标识符大小写**：Prisma `$queryRaw` 模板字符串里**表名和列名都要加双引号**（`"ContentItem"`、`"contentHash"`、`"contentItemId"`），否则折叠成小写 → `column does not exist`。fix-1（`e6a8591`）只修了表名，fix-1 followup（`3391c60`）补修列名。
- **Prisma 非空字段拒绝 `null` 条件**：`visibility String @default("public")`（非空），`where: { visibility: null }` → `PrismaClientValidationError` → 500。匿名 `/api/articles` 就是这个 bug（`e01a0af`）。
- **Playwright `toHaveURL(regex)` 匹配完整 URL**（含 `http://host`），不是 pathname。`^/` 锚定到 `h` 是错的。
- **base-ui Select option 的 accessible name 是文案**（`已完成`）不是 value（`COMPLETED`）。
- **base-ui Checkbox 渲染为 `button[role="checkbox"]`**（不是 `role="checkbox"` 的 input）。
- **Playwright `page.goto` 取消进行中 fetch** → 浏览器报 `TypeError: Failed to fetch` → ConsoleGuard `/TypeError/i` 误报。fix：良性错误过滤。
- **tmpfs（ramdisk）inode 配额**：`test-results/*`（video/trace）会撑爆 → ENOSPC。**每次跑前必清** `rm -rf test-results/*`。
- **Node `fetch()` 不继承 Playwright storageState cookie** —— seed helper 要手动读 `.auth/*.json` 拼 Cookie 头（`ba20433`）。

---

## 8. 验证状态自检（诚实声明）

| 项 | 状态 |
|---|---|
| fix-4 所有改动已 commit | ✅ `6f1e2ef`、`92bba3e` |
| fix-4 改动单点手测 | ✅（curl clean/metrics 200、overflow 实测 1.00 ratio） |
| fix-4 完整 e2e 复跑 | ❌ **未跑**（用户要求暂停） |
| 18 → 预期失败数下降 | **未验证** —— 恢复时第一件事就是跑 |
| 视觉回归（fix-5） | ❌ 未开始 |
| P0-001/002/003 | ❌ 未开始 |
| staging 双跑 | ❌ 未开始 |

**本会话的声明都是"已改+单点验证"，不是"e2e 全绿"。** 恢复时务必先跑 run20 确认。
