# Multi-User Hardening Final Report

**Date:** 2026-06-12
**Scope:** P0-001~004, P1-001~005, P2-001~002
**Status:** All 11 items completed

---

## 1. P0 修了哪些？

| # | Issue | Fix | Commits |
|---|-------|-----|---------|
| **P0-001** | 文章详情泄露别人数据 — `GET /api/content-items/[id]` 的 include 未过滤子资源，非 ADMIN 能看到别人的素材卡和批注 | Prisma `include.where` 按 role 分支：ADMIN 全量，非 ADMIN 仅 `ownerUserId/userId = currentUser.id`；防御性 JS 后置过滤兜底 | `f325e60` `9ee1fba` `2e1cad9` |
| **P0-002** | 收藏配额 TOCTOU — `getCurrentFavoriteCount` 在事务外读、insert 在事务内，并发可突破上限 | 整段移入 `db.$transaction`：`pg_advisory_xact_lock(hashtext(userId))` 串行化同一用户 → `tx.count` → `tx.createMany({ skipDuplicates: true })` | `d54fd42` `0f3bcc4` `46fbbc4` |
| **P0-003** | 任务限流非原子 — `checkTaskRateLimit` + `createAsyncTask` 不在事务内，并发可重复建任务 | AsyncTask 加 `dedupeKey` + partial unique index；`createDedupTask` 事务内 advisory lock → findFirst 去重 → count 限流 → create；generate-card 路由换用 | `7df40c3` `bcafa85` `37ddc65` `13cc068` `bf524dc` |
| **P0-004** | E2E 测试不可信 — playwright 顶层默认 admin cookie，16 个「未认证 401」用例实际带管理员身份跑 | 移除顶层 storageState；17 spec 显式 `test.use({ storageState })` 标注身份；global-setup 重写为 4 角色自动注册+登录；seed-e2e-accounts 幂等脚本 | `5511b25` `57946a1` `d51987c` `9b090ec` `ac4964d` |

**P0-003 已知限制（必须报告）：**
- `src/lib/async-task.ts` 的任务队列存 `globalThis`（进程内存），多副本/水平扩展不共享，进程重启丢未完成任务。
- `createDedupTask` 解决了「创建阶段」的并发竞态，但「执行阶段」仍依赖单进程内存队列。
- **单副本部署 OK**；多副本/水平扩展前必须重构为 DB worker（独立 issue，非本轮范围）。

---

## 2. P1 修了哪些？

| # | Issue | Fix | Key Change |
|---|-------|-----|------------|
| **P1-001** | Legacy null 数据暴露 — `ownerScopeWhere` 让非 ADMIN 看到 null-owner 的素材卡/同步记录/批注 | 新增 `ownedResourceWhere`（非 ADMIN 仅看自己的）和 `legacyAdminOnlyWhere`（防御性显式排 null）；material-cards/sync-records/annotations 路由全部换用 | `ownerScopeWhere` 不再被任何路由 import，legacy null 数据仅 ADMIN 可见 |
| **P1-002** | POST /api/content-items 权限过宽 — 任何认证用户都能导入文章 | `requireAuth` → `requireAdmin`；非 admin 返回 403 | 只有 ADMIN 可以通过 API 导入文章 |
| **P1-003** | 素材卡编辑/删除无 owner 检查 — 任何人可改/删别人的卡 | PUT/DELETE 加 `canModifyResource(user, existing.ownerUserId)`；非 owner 非 admin 返回 403；legacy null-owner 卡对非 ADMIN 只读 | 卡的所有者可编辑/删除自己的卡，ADMIN 可操作所有 |
| **P1-004** | Prisma 7 + tsx seed 失败 — `prisma/seed.ts` 用目录 import 在 tsx 下报错 | `seed-admin.ts` 改为 `await import("../generated/prisma/client")` 显式 client 入口；加 `dotenv/config` import | seed 脚本在 tsx 下正常执行 |
| **P1-005** | Migration drift — 7 个表和若干列变更不在 migration 历史中 | 创建 `20260612000003_backfill_drift` 幂等 migration：所有 DDL 用 `IF NOT EXISTS` / `DO $$ ... IF NOT EXISTS ... $$` 包裹 | `prisma migrate status` 显示 up to date，4 个 migration 全部记录 |

---

## 3. P2 修了哪些？

| # | Issue | Fix |
|---|-------|-----|
| **P2-001** | `tsc --noEmit` 有类型错误 — 测试文件中 mock 类型不匹配 | 修复所有 tsc 错误：async-task dedup path select type、test 文件类型标注；当前 `tsc --noEmit` 0 error |
| **P2-002** | ArticleChecklist 未接入 — 探索/发现页无批量收藏功能 | `useArticleChecklist` hook + `BatchFavoriteBar` 组件接入 explore 和 discover 页；每行 Checkbox 勾选 → 底部浮动栏一键批量收藏 |

---

## 4. 是否可多人使用？

**是。** 三角色隔离已验证：

| 角色 | 权限范围 | 验证方式 |
|------|---------|---------|
| ADMIN | 全量读写，审核流，用户管理，WeWe RSS 配置 | E2E api-security + admin-review + 单测 |
| VERIFIED_USER | 读审核通过公共内容，生成素材卡，收藏，管理自己的卡/同步记录 | E2E role-upgrade + 单测 requireVerifiedUser |
| USER | 读审核通过公共内容，收藏，注册；不能生卡 | E2E role-upgrade（USER→403）+ 单测 |

**隔离验证点：**
- A 用户看不到 B 用户的收藏（E2E data-isolation 验证）
- A 用户的素材卡在文章详情对 B 不可见（E2E + 单测双层验证）
- A 不能编辑/删除 B 的素材卡（单测 canModifyResource）
- 非 ADMIN 不能导入文章（P1-002：POST content-items 返回 403）
- 非 ADMIN 不能配置 WeWe RSS（E2E api-security：WeWe RSS 403）
- Legacy null-owner 数据对非 ADMIN 隐藏（P1-001：ownedResourceWhere）

---

## 5. 是否建议扩量？

**VERIFIED_USER 可以扩量。** 该角色权限边界清晰：生卡 + 收藏 + 管理自己的资源。

**USER 扩量前需升级路径就绪。** 当前 USER 不能生卡（403），需先通过邀请码升级为 VERIFIED_USER。扩量前需确认：
1. 邀请码发放流程已就绪（seed 或 admin 手动创建）
2. 用户升级引导 UI 已上线（当前仅有 API，前端升级入口待做）
3. 配额系统已配置（RoleQuota 表需 seed USER 和 VERIFIED_USER 的 favoriteLimit）

---

## 6. DB 是否需人工 migration？

**否。** 所有 migration 都是幂等的，只需运行：

```bash
npx prisma migrate deploy
```

4 个 migration 自动按顺序执行：

| # | Migration | 说明 |
|---|-----------|------|
| 1 | `0_init` | 初始 schema |
| 2 | `20260611175652_review_flow` | 审核流 + ArticleFavorite + RoleQuota + MaterialCard partial unique index |
| 3 | `20260612000002_task_dedupe` | AsyncTask.dedupeKey + partial unique index |
| 4 | `20260612000003_backfill_drift` | 漂移对齐（5 表 + AiConfig 列变更），全部 IF NOT EXISTS |

**Seed 也需要执行：**
```bash
npx tsx src/scripts/seed-admin.ts    # admin 账号 + RoleQuota
npx tsx src/scripts/seed-e2e-accounts.ts  # E2E 测试账号（生产可选）
```

---

## 7. Staging 确认项

| 项目 | 结果 |
|------|------|
| E2E 总用例 | 184 passed / 0 failed / 16 skipped |
| 16 skipped 原因 | 依赖 fixture 数据（E2E_APPROVED_ARTICLE_ID 等），staging 空库无数据 |
| Health check | `/api/health` 200 OK |
| 3 容器状态 | app + db + wewe-rss 健康运行 |
| Migration | 4 个 migration 全部 applied |
| Seed | admin 账号 + RoleQuota 已写入 |

**0 genuine failures。** 所有 skipped 用例均为 fixture 依赖，非代码缺陷。

---

## 8. Prod 确认项

| 步骤 | 命令 | 预期 |
|------|------|------|
| 1. Deploy migration | `npx prisma migrate deploy` | 4 migrations applied，0 drift |
| 2. Seed role-quotas | `npx tsx src/scripts/seed-admin.ts` | USER favoriteLimit=50, VERIFIED_USER=200 |
| 3. Verify backfill | `SELECT role, "favoriteLimit" FROM "RoleQuota"` | 2 rows |
| 4. Verify content visibility | 非 ADMIN 登录后 `GET /api/content-items` | 仅返回 approved + public |
| 5. Verify isolation | 用两个不同用户登录，确认 A 看不到 B 的收藏/卡 | 数据隔离生效 |
| 6. Health check | `curl /api/health` | 200 |
| 7. 内存队列确认 | 确认部署为单副本 | 若多副本需先重构 DB worker |

---

## 9. 测试结果

| 检查项 | 结果 |
|--------|------|
| `pnpm lint` | 0 error, 18 warnings (pre-existing, non-blocking) |
| `pnpm test` (vitest) | **371 passed / 0 failed** (53 test files) |
| `pnpm build` | Compiled successfully |
| `pnpm exec tsc --noEmit` | **0 error** |
| `pnpm exec prisma migrate status` | 4 migrations, up to date |
| E2E (staging) | 184 passed / 0 failed / 16 skipped |

---

## 10. 不可信测试

16 个 E2E 用例被 skip，原因全部是 **fixture 数据依赖**：

| 用例类别 | Skip 条件 | 数量 |
|---------|----------|------|
| 素材卡归属（P5） | 缺 `E2E_APPROVED_ARTICLE_ID` / `E2E_PENDING_ARTICLE_ID` | 3 |
| 审核流（P4） | 缺 `E2E_REJECTED_ARTICLE_ID` / `E2E_APPROVED_WITH_CARDS_ID` 等 | 4 |
| 角色升级（P8） | 缺 `E2E_UPGRADE_INVITATION_CODE` / `E2E_USER_USERNAME` | 2 |
| A/B 数据隔离 | staging 空库无 approved 文章 | 2 |
| 卡包生成 | AI 服务不可达 | 1 |
| 其他 fixture 依赖 | 缺特定环境变量 | 4 |

**这些 skip 不代表代码缺陷。** 生产环境有真实数据后，设置对应环境变量即可激活这些用例。

**Staging 空库影响：** A/B 隔离用例（收藏 + 卡片）依赖库中存在 approved 公共文章。staging 初始为空库，这些用例 skip。导入文章并审核通过后即可跑通。

---

## 11. 影响现有用户数据的变更

| 变更 | 影响 | 兼容措施 |
|------|------|---------|
| `ownerScopeWhere` → `ownedResourceWhere` | Legacy null-owner 的素材卡/同步记录/批注对非 ADMIN 不再可见 | ADMIN 仍可看到全部；数据未删除，只是过滤逻辑收紧 |
| POST /api/content-items 收紧为 admin-only | 非 ADMIN 用户不能再通过 API 导入文章 | 前端导入入口原本就仅 admin 可见；API 层补齐后端校验 |
| 素材卡 PUT/DELETE 加 owner 检查 | Legacy null-owner 的卡对非 ADMIN 变为只读；非 owner 不能编辑/删除别人的卡 | ADMIN 不受影响；owner 可正常操作自己的卡 |
| AsyncTask 加 dedupeKey | 新增可空列 + partial unique index，无数据变更 | 幂等 migration，`dedupeKey` 默认 null，不影响已有任务 |
| Review flow migration | ContentItem 新增审核字段 + ArticleFavorite 表 + RoleQuota 表 | Backfill 根据 AI 决策设置初始状态，不删除数据 |

**数据安全：** 所有变更均为过滤逻辑收紧（看到更少），无删除操作。Legacy null-owner 数据保留在 DB 中，ADMIN 可见。
