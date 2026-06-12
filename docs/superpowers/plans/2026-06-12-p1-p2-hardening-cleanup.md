# P1/P2: 加固收尾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** 完成 P1-001~005 + P2-001~002 共 7 项加固收尾——legacy null 策略、POST 权限、素材卡编辑权限、Prisma 7 seed、migration drift、tsc 错误、ArticleChecklist 评估。

**Architecture:** 每项独立小 task，TDD，频繁 commit。P1 是多人使用前建议修，P2 是 P0/P1 后处理。

**Tech Stack:** Prisma · Next.js · tsx · Playwright · TypeScript。

---

## Context

P0（数据隔离 + 并发 + E2E 可信）修完后，这些是收尾项。**多数是质量/一致性，非紧急**。按需求文档顺序逐项处理，每项独立 commit。

---

## P1-001: legacy null 数据暴露策略

**Files:** `src/lib/data-isolation.ts`

- [ ] **Step 1: 新增 helper**

```typescript
/** 用户资产（MaterialCard/Annotation/SyncRecord 等）默认只 owner+admin 可见；legacy null 仅 admin。 */
export function ownedResourceWhere(user: AuthUser, fieldName = "ownerUserId") {
  if (user.role === "ADMIN") return {};
  return { [fieldName]: user.id };
}

/** legacy null 仅 admin 可见（除非业务明确允许）。 */
export function legacyAdminOnlyWhere(user: AuthUser, fieldName = "ownerUserId") {
  if (user.role === "ADMIN") return {};
  return { [fieldName]: { not: null, equals: user.id } };
}
```

- [ ] **Step 2: 单测 + 替换 ownerScopeWhere 调用**

在 material-cards/sync-records/annotations 路由里，把 `ownerScopeWhere`（含 legacy null）改为 `ownedResourceWhere`（仅 owner）——除非业务确认要给普通用户看 legacy。

- [ ] **Step 3: commit**

```bash
git add src/lib/data-isolation.ts src/lib/__tests__/data-isolation-legacy.test.ts src/app/api/material-cards/route.ts
git commit -m "fix(isolation): legacy null user assets admin-only by default"
```

---

## P1-002: POST /api/content-items 权限

**Files:** `src/app/api/content-items/route.ts`

- [ ] **Step 1: 确认产品定位**

Run: `grep -n "requireAdmin\|requireVerifiedUser\|requireAuth" src/app/api/content-items/route.ts`

如果产品是「管理员负责采集」（P1-P8 已定），普通用户不能导入文章 → 改 `requireAdmin`。

- [ ] **Step 2: 改权限 + 单测**

POST handler 改 `requireAdmin`；单测覆盖 VERIFIED_USER → 403。

- [ ] **Step 3: commit**

```bash
git add src/app/api/content-items/route.ts src/app/api/content-items/__tests__/route.test.ts
git commit -m "fix(content-items): restrict POST to admin (users can't import articles)"
```

---

## P1-003: 素材卡编辑/删除权限

**Files:** `src/app/api/material-cards/[id]/route.ts`

- [ ] **Step 1: 读现状确认 PUT/DELETE 是 requireAdmin**

- [ ] **Step 2: 改为 owner 可编辑/删除**

GET 已用 `canAccessResource`。PUT/DELETE 改用 `canModifyResource`（已有，返回 true 当 admin 或 owner）。如果当前是 `requireAdmin`，改为 `requireAuth` + `canModifyResource` 检查。

- [ ] **Step 3: 单测 A 不能删 B 的卡 + owner 可删**

- [ ] **Step 4: commit**

```bash
git add src/app/api/material-cards/\[id\]/route.ts src/app/api/material-cards/\[id\]/__tests__/route.test.ts
git commit -m "fix(material-cards): owner can edit/delete own cards; A can't touch B's"
```

---

## P1-004: Prisma 7 + tsx seed 修复

**Files:** `src/scripts/seed-role-quotas.ts`、`package.json`

- [ ] **Step 1: 复现 + 找根因**

Run: `pnpm seed:role-quotas` → 看错误（`src/generated/prisma/index.json` 找不到）。

Prisma 7 generated 是 ESM + 多文件，tsx 动态 import 路径不对。修法：改用 `import { PrismaClient } from "../src/generated/prisma/client.js"`（注意 .js 后缀，匹配 Prisma 7 输出），或用 `tsx --tsconfig` 显式。

- [ ] **Step 2: 修 + 验证**

```bash
pnpm exec prisma generate
pnpm seed:role-quotas
```

→ 必须稳定输出 `RoleQuota seed done: USER=100, VERIFIED_USER=300`，不报模块错误。

- [ ] **Step 3: 更新部署文档**

`docs/deployment/staging-deployment.md` 移除「手动 psql」兜底，改 `pnpm seed:role-quotas`。

- [ ] **Step 4: commit**

```bash
git add src/scripts/seed-role-quotas.ts package.json docs/deployment/
git commit -m "fix(seed): resolve Prisma 7 + tsx dynamic import path"
```

---

## P1-005: migration drift 整理

**Files:** `prisma/migrations/`

- [ ] **Step 1: 对比状态**

```bash
pnpm exec prisma migrate status
```

dev 库 7 张表不在历史（AuditLog/ImaTarget/Invitation/InvitationUse/UserIntegration/WeweAccount/WeweSubscription）。

- [ ] **Step 2: 用 migrate diff 反向工程补 migration**

```bash
pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /tmp/full.sql
```

对比 `0_init` 看缺什么，补一个 `20260612000002_backfill_drift/migration.sql`（幂等 CREATE TABLE IF NOT EXISTS）。

⚠️ **不 reset 任何库**。对生产已存在的表用 `IF NOT EXISTS`。

- [ ] **Step 3: 验证**

```bash
pnpm exec prisma migrate status
pnpm db:migrate
```

- [ ] **Step 4: 写 `docs/deploy/database-migration-and-seed-report.md`**

- [ ] **Step 5: commit**

```bash
git add prisma/migrations/ docs/deploy/
git commit -m "fix(db): reconcile migration drift with idempotent backfill"
```

---

## P2-001: tsc 类型错误

**Files:** 多个测试文件（annotations/login/review 等）

- [ ] **Step 1: 跑 typecheck**

```bash
pnpm exec tsc --noEmit 2>&1 | tee /tmp/tsc.log
```

- [ ] **Step 2: 逐个修**

错误清单（来自 FINAL report）：`annotations/[id]/__tests__`、`auth/login/__tests__`、`review/__tests__` 等。逐个看错误，修类型（不用 any 糊弄）。

- [ ] **Step 3: 重跑直到 0 error**

- [ ] **Step 4: commit**

```bash
git add -A
git commit -m "fix(types): resolve tsc --noEmit errors in test files"
```

---

## P2-002: ArticleChecklist 接入评估

**Files:** `src/components/ArticleChecklist.tsx`、explore/discover 页面

- [ ] **Step 1: 评估改动量**

组件已就绪（P7），接入需在 explore/discover 卡片渲染处加 checkbox + BatchFavoriteBar。读 `src/app/explore/page.tsx` 看卡片渲染结构。

- [ ] **Step 2: 决策**

- 改动 < 30 行 → 接入
- 改动大 → 独立 issue（本 plan 跳过）

- [ ] **Step 3: 若接入，commit**

```bash
git add src/app/explore/ src/app/discover/
git commit -m "feat(ui): wire ArticleChecklist + BatchFavoriteBar into explore"
```

---

## 最终：交付报告

**Files:** `docs/audit/multi-user-hardening-report.md`、`docs/testing/multi-user-security-e2e-report.md`、`tasks/2026-06-12-multi-user-hardening/README.md`

- [ ] **Step 1: 写 3 份文档**

按需求文档「本轮必须产出的文档」清单，每份回答「最终交付报告必须回答」的 11 个问题（P0/P1/P2 修了哪些、是否可多人使用、是否建议扩量、DB 是否需人工 migration、staging/prod 确认项、测试结果、不可信测试、影响现有用户数据的变更）。

- [ ] **Step 2: commit**

```bash
mkdir -p tasks/2026-06-12-multi-user-hardening
git add docs/audit/ docs/testing/ docs/deploy/ tasks/
git commit -m "docs: multi-user hardening final reports"
```

---

## Verification（全 plan 完成后）

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm exec prisma generate
pnpm exec prisma migrate status
pnpm seed:role-quotas
pnpm exec tsc --noEmit
```

全绿（除 staging fixture/AI 依赖的 e2e skip）。

---

## Self-Review

**Spec coverage**：P1-001~005 ✅、P2-001~002 ✅、必须产出文档 ✅、必须回答 11 问题 ✅。

**Placeholder scan**：P2-002 是评估型（依赖读代码后决策），已明确分支条件，非 placeholder。✅

**依赖**：P1/P2 依赖 P0 先修完（数据隔离修完才好评估 legacy null 策略；E2E 拆完才好跑全量）。执行顺序：先 P0-001~004，再 P1，最后 P2。✅
