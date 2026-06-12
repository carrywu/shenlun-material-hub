# 多人使用安全加固 — 执行 Todolist

> **状态**：⏳ 待执行（本文件在执行过程中逐项打勾 + 填结果）
>
> **范围**：只做 P0（4 项）。P1/P2 下一轮，不在本 checklist。
>
> **执行顺序**：P0-004 → P0-001 → P0-002 → P0-003（先重建 e2e 可信度，后续每个 P0 都有 e2e 兜底）
>
> **详细 task 步骤**：见 `docs/superpowers/plans/2026-06-12-p0-00{1,2,3,4}-*.md` 四份独立 plan。
>
> **总纲**：见 `/Users/apple/.claude/plans/wewerss-admin-review-user-ai-material-c-tingly-nova.md`（10 个锁定决策）。

---

## 执行前置（开工前确认）

- [ ] 当前在 worktree `.claude/worktrees/p1-p8-review-flow`，分支 `worktree-p1-p8-review-flow`
- [ ] `.env` 存在（DATABASE_URL / 下一份认证密钥等）
- [ ] 本地 331 单测基线绿（`pnpm test`）
- [ ] staging 可达（`100.117.96.1:3001`），admin 密码已知（`E2E_ADMIN_PASSWORD`）
- [ ] 4 份 P0 plan 文件已读（`docs/superpowers/plans/2026-06-12-p0-00*.md`）

---

## P0-004：E2E storageState 拆分 + 修复污染

> **目标**：把 playwright 从「单 chromium + 默认 admin storageState」改为 5 类角色 project（anonymous/userA/userB/verified/admin）；修复既有 16 个「未认证 401」污染用例；建 userA/userB 独立账号。
>
> **验收档位**：档 2（B 完整）——框架 + 全标注 + A/B 用例；fixture 缺失时 skip 可接受。
>
> **详细 plan**：`docs/superpowers/plans/2026-06-12-p0-004-e2e-storage-states.md`

### Task 1: helpers 扩展 + 多角色 storageState 创建
- [ ] `e2e/helpers/auth.ts` 加 `loginAsVerifiedUserAPI`、`loginAsUserBAPI`
- [ ] `e2e/global-setup.ts` 重写：循环登录 4 角色（admin/verified/userA/userB），各存 `.auth/<role>-storage.json`
- [ ] global-setup 自动注册 `e2e_verified` / `e2e_userA` / `e2e_userB`（幂等，`e2e_` 前缀，已存在则登录）
- [ ] 每个角色从 env 读密码（admin 已有 `E2E_ADMIN_PASSWORD`，其余加 `E2E_VERIFIED_PASSWORD` / `E2E_USERA_PASSWORD` / `E2E_USERB_PASSWORD`）
- [ ] commit: `feat(e2e): multi-role storageState in global-setup`

### Task 2: playwright.config 拆 5 projects
- [ ] 移除顶层 `storageState: '.auth/admin-storage.json'`
- [ ] 拆 projects: anonymous（空 storageState）/ userA / userB / verified / admin
- [ ] `pnpm exec playwright test --list` 能列出用例
- [ ] commit: `feat(e2e): split 5 auth projects`

### Task 3: 修既有 16 个污染用例 + 加 A/B 隔离
- [ ] `e2e/api-security.spec.ts` 16 个 401 用例：describe 块加 `test.use({ storageState: { cookies: [], origins: [] } })`
- [ ] `e2e/data-isolation.spec.ts` 加 userA/userB 用例（A 收藏的文章 B 看不到；A 的卡 B 看不到）
- [ ] 其余 28 个 spec 全部加 `test.use({ storageState })` 显式标注身份（subagent 分批，4-6 个，每个 5-8 spec）
- [ ] A/B 用例依赖文章 fixture——staging 空库时 `test.skip` 可接受（决策 6）
- [ ] `pnpm exec playwright test e2e/api-security.spec.ts` → 16 个 401 真过（不带 cookie）
- [ ] commit: `test(e2e): fix 16 polluted 401 cases + add userA/B isolation`

### Task 4: 验收
- [ ] 本地 `pnpm test:e2e` 全绿（fixture skip 可接受）
- [ ] staging `pnpm test:e2e`（决策 8 双跑；决策 10 staging 必绿）
- [ ] 追加本文件 P0-004 完成段（下方「完成记录」区）
- [ ] commit: `docs(audit): record P0-004 fix`

**P0-004 完成状态**：⏳

---

## P0-001：文章详情子资源隔离

> **目标**：`GET /api/content-items/[id]` 的 include 按 `user.role` 过滤——非 ADMIN 仅自己的子资源，ADMIN 全量，legacy null 对非 ADMIN 隐藏。
>
> **详细 plan**：`docs/superpowers/plans/2026-06-12-p0-001-article-detail-isolation.md`

### Task 1: 单测锁定「非 ADMIN 看不到别人卡/批注」（先红）
- [ ] `src/app/api/content-items/[id]/__tests__/route.test.ts` 追加 3 用例：非 ADMIN 只看自己的、ADMIN 全量、无自己卡时空数组
- [ ] `pnpm test src/app/api/content-items/[id]/__tests__/route.test.ts` → 3 新用例 FAIL
- [ ] commit: `test(content-items): lock child resource isolation in detail`

### Task 2: 详情接口按角色过滤
- [ ] `src/app/api/content-items/[id]/route.ts:16-23` include 加 where：`materialCards: isAdmin ? {} : { where: { ownerUserId: user.id } }`，annotations 同理 `{ where: { userId: user.id } }`
- [ ] legacy null 子资源对非 ADMIN 隐藏（where 不含 null）
- [ ] 单测全绿（新 3 + 现有）
- [ ] `pnpm test` 全量无回归
- [ ] commit: `fix(security): isolate article detail child resources by role`

### Task 3: 全量验收
- [ ] `pnpm lint && pnpm test && pnpm build`
- [ ] e2e（用 004 框架）验证 userA 看不到 userB 的卡
- [ ] 追加本文件 P0-001 完成段
- [ ] commit: `docs(audit): record P0-001 fix`

**P0-001 完成状态**：⏳

---

## P0-002：收藏配额 TOCTOU 修复

> **目标**：事务内 `pg_advisory_xact_lock(hashtext(userId))` 串行化 + 事务内 count + createMany skipDuplicates。
>
> **详细 plan**：`docs/superpowers/plans/2026-06-12-p0-002-favorites-toctou.md`

### Task 1: 单测锁定并发安全（先红）
- [ ] `src/app/api/favorites/__tests__/route.test.ts` 追加 2 用例：事务内调 advisory lock、事务内 count 超限拒绝
- [ ] mock 工厂加 `txExecuteRaw` / `txCount` / `txCreateMany`
- [ ] 新用例 FAIL
- [ ] commit: `test(favorites): lock TOCTOU concurrency-safety`

### Task 2: 事务内 advisory lock + count + createMany
- [ ] `src/app/api/favorites/route.ts:34-77` 重写 POST：移除事务外预检查，事务内 lock → count → eligible findMany → 配额检查 → createMany skipDuplicates
- [ ] 移除 `getCurrentFavoriteCount` import（count 移事务内）
- [ ] 更新现有用例 mock（事务外 count → 事务内 txCount）
- [ ] 单测全绿
- [ ] `pnpm test` 全量无回归
- [ ] commit: `fix(favorites): make quota checks concurrency-safe with advisory lock`

### Task 3: 验收
- [ ] `pnpm lint && pnpm test && pnpm build`
- [ ] e2e 验证并发不突破配额（如可造数据）
- [ ] 追加本文件 P0-002 完成段
- [ ] commit: `docs(audit): record P0-002 fix`

**P0-002 完成状态**：⏳

---

## P0-003：任务限流原子化

> **目标**：AsyncTask 加 `dedupeKey` + partial unique index；`createDedupTask`（事务内 advisory lock + 查重 + 限流 + insert）；generate-card 路由换用。
>
> **详细 plan**：`docs/superpowers/plans/2026-06-12-p0-003-task-rate-limit.md`

### Task 1: Schema 加 dedupeKey + migration
- [ ] `prisma/schema.prisma` AsyncTask 加 `dedupeKey String?`
- [ ] `pnpm exec prisma validate`
- [ ] `prisma migrate diff` 生成 `prisma/migrations/20260612000001_task_dedupe/migration.sql`
- [ ] migration.sql 末尾追加 partial unique index（`WHERE dedupeKey IS NOT NULL AND status IN ('PENDING','RUNNING')`）
- [ ] `pnpm exec prisma generate`
- [ ] commit: `feat(schema): add AsyncTask.dedupeKey with partial unique index`

### Task 2: createDedupTask 事务版 + 单测
- [ ] `src/lib/__tests__/async-task-dedupe.test.ts` 写失败单测（advisory lock 调用、已有同键返回 existing、超限抛 RATE_LIMITED）
- [ ] `src/lib/async-task.ts` 实现 `createDedupTask` + `RateLimitError`
- [ ] 单测全绿
- [ ] commit: `feat(async-task): createDedupTask with advisory lock + rate limit in tx`

### Task 3: generate-card 路由换用
- [ ] `src/app/api/content-items/[id]/generate-card/route.ts` 删 `checkTaskRateLimit` 块，循环内 `createAsyncTask` → `createDedupTask`
- [ ] dedupeKey = `CARD_GENERATE:${user.id}:${id}:${ct}`
- [ ] catch RateLimitError → 429
- [ ] 更新对应测试 mock
- [ ] commit: `fix(generate-card): atomic dedup task creation, no race`

### Task 4: 验收 + 报告内存队列风险
- [ ] `pnpm lint && pnpm test && pnpm build`
- [ ] 报告声明：内存队列（globalThis）多副本不共享，单副本部署 OK，水平扩展前必须重构 DB worker
- [ ] 追加本文件 P0-003 完成段
- [ ] commit: `docs(audit): record P0-003 fix + memory queue risk`

**P0-003 完成状态**：⏳

---

## 最终交付（4 P0 全完后）

- [ ] `docs/audit/multi-user-hardening-report.md`（最终报告，回答需求文档 11 个问题）
- [ ] `docs/testing/multi-user-security-e2e-report.md`（e2e 结果，本地 + staging）
- [ ] `docs/deploy/database-migration-and-seed-report.md`（P0-003 migration + seed 报告）
- [ ] `tasks/2026-06-12-multi-user-hardening/README.md`（任务索引，已生成）
- [ ] 全量验收：`pnpm lint && pnpm test && pnpm build && pnpm test:e2e && pnpm exec tsc --noEmit && pnpm exec prisma migrate status`
- [ ] staging 最终验收（决策 10：必绿）
- [ ] 合并 worktree 分支 → main → push origin/main

---

## 完成记录区（执行时填，每完成一个 P0 追加一段）

## P0-004：E2E storageState 拆分 + 修复污染（B3 单 project 方案）⚠️ 框架完成，暴露既有问题

- **问题**：playwright 顶层 admin storageState 污染所有测试，16 个「未认证 401」用例不可信。
- **修法（B3，决策 13，推翻第一轮 5-project 方案）**：
  - 删顶层 `storageState`（`5511b25`）
  - 17 spec 显式 `test.use({ storageState })` 标注（admin 文件级 + 混合 describe 分组）
  - `api-security` 16 个 401 用例真匿名；新增 userA/userB 隔离用例（收藏 + 卡片基线）
  - global-setup 重写：seed-e2e-accounts 脚本幂等创建 4 角色 → global-setup 只登录存 storageState
  - `.auth/` 加 gitignore + `git rm --cached admin-storage.json`
- **涉及文件**：playwright.config.ts、e2e/global-setup.ts、e2e/helpers/auth.ts、e2e/data-isolation.spec.ts、17 个 spec、src/scripts/seed-e2e-accounts.ts、.gitignore、package.json
- **提交**：57c1722、77946a1、5511b25、d51987c、9b090ec、ac4964d、(Task4 global-setup 重写)
- **本地 e2e 结果（run 7，dev server JWT_SECRET=playwright-test-secret）**：
  - 206 passed / 61 failed / 2 flaky / 16 skipped / 16 did-not-run
  - **4 角色 storageState 全部有效**（seed 成功 + global-setup 登录成功，无角色登录失败）
- **61 个 failure 分类（关键）**：
  1. **P0-004 暴露的污染（~18 个）**：`探索 API 返回 401`/`素材卡 API 返回 401` —— 这些测试断言「API 非 401」，但 API 本应需要认证；以前靠顶层 admin cookie 泄漏才「过」。现在正确匿名/正确身份后，断言暴露为错。**这是 P0-004 的预期效果（找出假绿）**，需逐个修测试断言或确认该 API 权限设计。
  2. **既有 DB drift（~10 个）**：`driverAdapterError: TableDoesNotExist` —— Invitation 表 schema 与 DB 不一致（P1-005），还有其他表缺失。与 P0-004 无关。
  3. **既有 UI 问题（~15 个）**：`strict mode: 探索区/今日推荐/模型参数 解析到 2 个元素` —— DOM 有重复元素，pre-existing。
  4. **既有数据缺失（~5 个）**：`没有素材卡数据，无法测试批量选择` 等 —— dev DB 无测试数据。
  5. **视觉回归（16 个）**：`toHaveScreenshot` 失败，pre-existing。
  6. **既有 toHaveURL/toBeVisible（~? 个）**：多数为上述问题的连带（401/缺数据导致页面渲染异常）。
- **未覆盖**：
  - staging 未跑（决策 24：本地框架完成后暂停，001/002/003 连跑完再 staging 最终验收）
  - A/B 卡片隔离是基线版（P0-001 完成后加强为真实插卡验证）
- **发现的连带 bug（非 P0-004，记入 P1）**：
  - `/api/admin/invitations` POST 500（Invitation 表 drift，P1-005）
  - seed 脚本目录 import 在 tsx 下失败（需显式 client 入口，P1-004）
- **完成状态**：⚠️ **框架完成，可信度已重建**（测试真假分明）；但 61 个 failure 多数是 P0-004 **暴露**的既有问题（DB drift / UI 重复 / 测试断言依赖泄漏 cookie）。**等待用户决策**（决策 24）：是否在本地继续逐个修这 61 个 failure，还是接受「框架完成 + staging 验收时再看」进入 001/002/003。



---

## 风险与约束（不可违反）

- 🚫 不允许 reset 生产/staging 数据库
- 🚫 不允许测试失败却声称完成
- 🚫 不允许只靠前端隐藏按钮代替后端权限校验
- 🚫 不允许只靠 unique index 解决配额并发（必须有 advisory lock）
- 🚫 事务外 count 后事务内 insert 禁止
- 🚫 storageState 污染未登录测试禁止
- 🚫 使用管理员 cookie 假装普通用户测试禁止
- 🚫 大面积 any 掩盖类型错误禁止
- 🚫 不要把用户 A/B 数据隔离只写单测，不做 E2E
- 🚫 继续新增 UI 功能而不处理 P0 安全问题禁止
- ⚠️ 决策 10：失败预案激进——staging 必绿，单点死磕不降级（卡死时找用户介入，不自行跳过）
