# 多人使用安全加固 — 交接文档（P0 范围）

> **写给谁**：下一个接手执行的人（或下一个上下文窗口的我）。
>
> **一句话**：P1-P8 已完成 + staging 部署验证通过，现在要做需求文档（`docs/multi-user-hardening-agent-prompt.md`）里的 4 个 P0 安全加固，按 004→001→002→003 顺序，严格 B 策略，本地 + staging 双环境验收。
>
> **本轮只做 P0**。P1/P2 下一轮。

---

## 一、背景：现在在哪一步

- ✅ P1-P8 全部完成（58 commits，本地 331 单测全绿）
- ✅ 已部署 staging（`100.117.96.1:3001`，3 容器健康，migration + seed 已跑）
- ✅ staging e2e：184 passed / 0 failed / 16 skipped（fixture 依赖）
- ✅ 已合并 main 并 push origin/main（commit `9676de4` + `fc713ed`）
- ⏳ **现在**：开始做多人使用安全加固的 4 个 P0

**需求来源**：`docs/multi-user-hardening-agent-prompt.md`（已 commit 在 worktree）。

**为什么只做 P0**：需求文档列了 P0(4) + P1(5) + P2(2) 共 11 项。跟用户确认后（决策 1），本轮**只做 4 个 P0**，P1/P2 留下一轮——P0 是真泄露/真竞态/测试不可信，必须先堵；P1/P2 是质量收尾，不阻塞多人使用。

---

## 二、4 个 P0 是什么（大白话）

| # | 漏洞 | 一句话 |
|---|---|---|
| **P0-001** | 文章详情泄露别人数据 | A 打开一篇公共文章详情，能看到 B 的素材卡和批注——真泄露 |
| **P0-002** | 收藏配额能被并发突破 | count 在事务外读、insert 在事务内，并发 10 个请求能突破上限——TOCTOU |
| **P0-003** | 任务限流非原子，能重复建任务 | checkTaskRateLimit + createAsyncTask 不在一个事务，并发能重复生成卡；AsyncTask 没 dedupeKey |
| **P0-004** | e2e 测试不可信 | playwright 顶层默认带 admin cookie，16 个「未认证 401」用例其实带管理员身份跑——假绿 |

---

## 三、执行顺序：004 → 001 → 002 → 003

**不是按编号顺序，是 004 先做**。理由（决策 2）：

- 004 修完后 e2e 才可信。
- 001/002/003 改完都要靠 e2e 验证（A 看不到 B 的卡、并发不突破配额）。
- 如果先做 001/002/003 再修 004，等于在不可信的测试上叠改动——一旦 004 修完发现老测试全是假的，前面三个的「e2e 验证」全部作废。

**所以：先重建测试可信度（004），再逐个修漏洞（001→002→003），每个都有可信 e2e 兜底。**

---

## 四、10 个锁定决策（grill-me 已确认，不用再问）

| # | 决策点 | 选择 |
|---|---|---|
| 1 | 本轮范围 | **只做 P0（4 项）**，P1/P2 下一轮 |
| 2 | 执行顺序 | **004 → 001 → 002 → 003** |
| 3 | 测试账号来源 | **global-setup 自动注册**（admin 生成邀请码 → 注册 verified；不带邀请码注册 userA/userB） |
| 4 | spec 怎么匹配身份 | **B：每个 spec 显式 `test.use({ storageState })` 标注**（精准，不用 project 名 hack） |
| 5 | B 怎么执行 | **subagent 分批全标注**（4-6 个 subagent，每个 5-8 spec） |
| 6 | 004 验收到哪 | **档 2：B 完整**——框架 + 全标注 + A/B 用例都做；fixture 缺失时 skip 可接受 |
| 7 | 测试账号数据 | **幂等 + 接受残留**（`e2e_` 前缀，已存在就登录，本地 + staging 两边都留着不清理） |
| 8 | e2e 跑哪 | **本地开发 + staging 最终验收**（双跑） |
| 9 | 本轮目标 | **004 + 001/002/003 全做完**（P0 全清，不留尾巴） |
| 10 | 失败怎么办 | **B 激进：硬扛 + staging 必绿 + 死磕**（不降级，不靠 todolist 恢复，卡死找用户介入） |

⚠️ **决策 10 是用户明确选的激进方案**，跟我推荐的「保守」相反。执行时：
- 上下文爆了不靠 todolist 恢复，硬扛
- staging 挂了必须修绿才算完（跟 P1-P8 的「staging 失败不阻断」相反）
- 单点反复修不绿，死磕到底，不跳过

---

## 五、关键文件（要改的）

### P0-004（e2e 框架重建）
- `playwright.config.ts` —— 拆 5 projects（anonymous/userA/userB/verified/admin），移除顶层 storageState
- `e2e/global-setup.ts` —— 自动注册 + 登录 4 角色，存 4 个 storageState 文件
- `e2e/helpers/auth.ts` —— 加 `loginAsVerifiedUserAPI` / `loginAsUserBAPI`
- `e2e/api-security.spec.ts` —— 16 个 401 用例加 `test.use({ storageState: 空 })`
- `e2e/data-isolation.spec.ts` —— 加 userA/userB 隔离用例
- 其余 ~28 个 spec —— 全部加 `test.use` 标注身份

### P0-001（详情隔离）
- `src/app/api/content-items/[id]/route.ts:16-23` —— include 加 where 过滤
- `src/app/api/content-items/[id]/__tests__/route.test.ts` —— A/B 隔离单测

### P0-002（收藏 TOCTOU）
- `src/app/api/favorites/route.ts:34-77` —— 事务内 advisory lock + count + createMany
- `src/app/api/favorites/__tests__/route.test.ts` —— 并发单测

### P0-003（任务限流）
- `prisma/schema.prisma` —— AsyncTask 加 `dedupeKey String?`
- `prisma/migrations/20260612000001_task_dedupe/migration.sql` —— partial unique index
- `src/lib/async-task.ts` —— `createDedupTask` + `RateLimitError`
- `src/app/api/content-items/[id]/generate-card/route.ts` —— 换用 createDedupTask

---

## 六、复用的现有基础设施（不用重造）

- `src/lib/data-isolation.ts` —— `canAccessResource` / `canModifyResource`（P0-001 复用判断逻辑）
- `src/lib/favorite-quota.ts` —— `getFavoriteLimits`（P0-002 保留，移事务内）
- `src/lib/async-task.ts` —— `enqueueAsyncTask` 内存队列（P0-003 复用）
- MaterialCard partial unique index 模式（P2 已加，P0-003 给 AsyncTask 照抄）

---

## 七、详细 task 步骤在哪

**不是本文件**。本文件是总纲 + 交接。

每个 P0 的细粒度 TDD 步骤（写红测试 → 跑红 → 实现 → 跑绿 → commit）在 4 份独立 plan：

| P0 | plan 文件 |
|---|---|
| 004 | `docs/superpowers/plans/2026-06-12-p0-004-e2e-storage-states.md` |
| 001 | `docs/superpowers/plans/2026-06-12-p0-001-article-detail-isolation.md` |
| 002 | `docs/superpowers/plans/2026-06-12-p0-002-favorites-toctou.md` |
| 003 | `docs/superpowers/plans/2026-06-12-p0-003-task-rate-limit.md` |

**执行 checklist（带打勾框）**：`docs/audit/multi-user-hardening-todolist.md`

**总纲 + 10 决策表**：`/Users/apple/.claude/plans/wewerss-admin-review-user-ai-material-c-tingly-nova.md`

---

## 八、执行方式（已定 subagent-driven）

用 `superpowers:subagent-driven-development`：
- 每个 task 派一个 fresh subagent（不污染主上下文）
- subagent 完成后两阶段 review：先 spec 合规、再代码质量
- review 不通过 → 同一 subagent 修 → 再 review
- 全程不停下来问「要继续吗」，连续执行到 4 个 P0 全完

**模型选择**：机械 task（改单文件、明确 spec）用便宜模型；多文件协调/调试用标准模型。

---

## 九、验收命令（每个 P0 完成后跑）

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm exec tsc --noEmit          # 需求文档要求
pnpm exec prisma migrate status # P0-003 后
```

**staging 最终验收**（4 P0 全完后，决策 8 + 10）：
```bash
LINUX_HOST=100.117.96.1 bash scripts/deploy-staging.sh
E2E_ADMIN_PASSWORD=<staging密码> pnpm test:e2e   # 必绿
```

---

## 十、完成后要产出的文档（需求文档硬要求）

- [ ] `docs/audit/multi-user-hardening-todolist.md`（已生成，执行时填完成记录）✅ 框架已建
- [ ] `docs/audit/multi-user-hardening-report.md`（最终报告，回答需求文档 11 个问题）
- [ ] `docs/testing/multi-user-security-e2e-report.md`（e2e 结果，本地 + staging）
- [ ] `docs/deploy/database-migration-and-seed-report.md`（P0-003 migration + seed）
- [ ] `tasks/2026-06-12-multi-user-hardening/README.md`（本文件）✅ 已建

**最终报告必须回答的 11 个问题**（来自需求文档）：
1. P0/P1/P2 各修了哪些？
2. 是否可多人使用？
3. 是否建议扩量？
4. DB 是否需人工 migration？
5. staging/prod 确认项？
6. 测试结果？
7. 不可信测试？
8. 影响现有用户数据的变更？
9-11.（详见需求文档原文）

---

## 十一、红线（不可违反）

- 🚫 不 reset 生产/staging 数据库
- 🚫 测试失败不许声称完成
- 🚫 不许只靠前端隐藏按钮代替后端权限校验
- 🚫 不许只靠 unique index 解决配额并发（必须 advisory lock）
- 🚫 事务外 count 后事务内 insert 禁止
- 🚫 storageState 污染未登录测试禁止
- 🚫 用管理员 cookie 假装普通用户测试禁止
- 🚫 大面积 any 掩盖类型错误禁止
- 🚫 用户 A/B 数据隔离只写单测不写 E2E 禁止
- 🚫 P0 没修完就加新 UI 功能禁止

---

## 十二、已知坑（P1-P8 踩过的，别再踩）

1. **vitest hoisting**：`vi.mock` 工厂引用顶层 const 会报「Cannot access before initialization」。用 `vi.hoisted()` 包裹 mock 对象。
2. **role-aware mock**：`requireAuth` mock 直接返回 user 会导致 VERIFIED_USER 不 403。mock 要实现角色判断语义。
3. **`.env` 不在 worktree**：gitignored，要从主 worktree 复制。
4. **deploy-staging.sh heredoc bug**：`run()` 用未引用 `<<EOF`，远端 for 循环变量被本地 shell 吃掉。绕过：直接 `ssh 'bash -s' <<'EOF'`（引用 heredoc）。脚本本身未修。
5. **staging 镜像旧**：app 容器跑老镜像看不到新 migration，要 `docker compose up -d --force-recreate app`。
6. **staging ContentItem 空库**：backfill 命中 0 行不是错；A/B e2e 用例没 fixture 会 skip（决策 6 接受）。

---

## 十三、下一步（开工即做）

1. 读 `docs/audit/multi-user-hardening-todolist.md` 的「执行前置」5 项确认
2. 读 `docs/superpowers/plans/2026-06-12-p0-004-e2e-storage-states.md` 的 4 个 task
3. 用 subagent-driven 开搞 P0-004 Task 1（helpers 扩展 + global-setup 重写）
4. 连续执行，不停下来问，直到 4 个 P0 全完
5. 写最终报告 4 份文档
6. 合并 main + push

**卡死的时候**（决策 10）：不自行降级，找用户介入。
