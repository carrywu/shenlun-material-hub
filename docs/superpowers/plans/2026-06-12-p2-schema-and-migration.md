# P2: Schema + 历史数据迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 ContentItem 加审核字段（adminReviewStatus 等）+ featuredToday；新建 ArticleFavorite（收藏关系）、RoleQuota（角色配额）两张表；给 MaterialCard 加 partial unique index；写幂等的历史数据迁移脚本。这是 P3-P8 全部的数据库前置。

**Architecture:** Prisma schema 增量改动 + 一份 prisma migration（含 schema 变更 SQL + 幂等回填 SQL）。迁移必须能反复跑（所有 UPDATE 带 `WHERE adminReviewStatus = 'pending_ai'` 守卫）。AI 通过的老文章自动放行 approved（破红线），但 `publicVisibleAt` / `adminReviewedBy` 留空标记为「迁移放行」。

**Tech Stack:** Prisma（PostgreSQL provider，client 输出到 `src/generated/prisma`）· `prisma migrate` · 手写 SQL 迁移。

**Scope：**
- ✅ schema 改动（ContentItem 加字段、ArticleFavorite、RoleQuota、MaterialCard unique）
- ✅ 历史数据迁移脚本（幂等）
- ✅ Prisma client 重新生成
- ✅ 本地迁移验证
- ❌ 不覆盖：业务接口逻辑（P3-P8 各自处理）、staging 部署（最后统一）

---

## File Structure

| 文件 | 责任 | 本 plan 操作 |
|---|---|---|
| `prisma/schema.prisma` | 数据模型 | ContentItem 加 6 字段、新建 ArticleFavorite、RoleQuota、MaterialCard 加 unique |
| `prisma/migrations/<timestamp>_review_flow/migration.sql` | 迁移 SQL | 新建（DDL + 幂等回填） |
| `prisma/seed-role-quotas.ts`（或现有 seed 文件追加） | RoleQuota 种子数据 | 新建/追加 |
| `docs/handoff/P2-schema-migration-handoff.md` | 交接文档 | 新建 |

---

## Task 1: ContentItem 加审核字段（schema）

**Files:**
- Modify: `prisma/schema.prisma`（ContentItem model，约第 121-203 行）

- [ ] **Step 1: 在 ContentItem 的 `visibility` 字段后（约第 178 行）插入审核字段**

打开 `prisma/schema.prisma`，找到 ContentItem model 内这段：

```prisma
  // Phase 2: 多用户数据隔离
  ownerUserId         String?                // 所属用户 ID（null 表示公共数据）
  visibility          String   @default("public") // public / private
```

在 `visibility` 行之后插入：

```prisma

  // 管理员审核流（P2 新增）
  adminReviewStatus   String   @default("pending_ai") // pending_ai / pending_admin / approved / rejected
  adminReviewedAt     DateTime?
  adminReviewedBy     String?
  adminReviewNote     String?
  publicVisibleAt     DateTime?
  featuredToday       Boolean  @default(false)  // 今日推荐标记
```

- [ ] **Step 2: 在 ContentItem 的 `@@index` 区（约第 189-202 行）追加两个索引**

找到 ContentItem 末尾的索引列表，在 `@@index([visibility])` 之后追加：

```prisma
  @@index([adminReviewStatus])
  @@index([featuredToday])
```

- [ ] **Step 3: 在 ContentItem 的关系字段区加 featuredBy 关系（可选，用于关联审核人）**

找到 ContentItem 的 relations（约第 183-187 行），在 `ownerUser` 关系后加：

```prisma
  adminReviewer  User?          @relation("ContentItemAdminReviewer", fields: [adminReviewedBy], references: [id])
```

- [ ] **Step 4: 在 User model 加反向关系（约第 13-35 行）**

在 User model 的 relations 区（`ownedContentItems` 附近）加：

```prisma
  reviewedContentItems  ContentItem[]      @relation("ContentItemAdminReviewer")
```

- [ ] **Step 5: 验证 schema 语法**

Run: `pnpm exec prisma validate`

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add admin review fields and featuredToday to ContentItem"
```

---

## Task 2: 新建 ArticleFavorite model（schema）

**Files:**
- Modify: `prisma/schema.prisma`（在 MaterialCard model 之后追加）

- [ ] **Step 1: 在 schema.prisma 末尾（MaterialCard model 之后）追加 ArticleFavorite model**

```prisma
// 文章收藏关系（P2 新增）——软收藏，文章本体只存一份
model ArticleFavorite {
  id            String   @id @default(cuid())
  userId        String
  contentItemId String
  createdAt     DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  contentItem ContentItem @relation(fields: [contentItemId], references: [id], onDelete: Cascade)

  @@unique([userId, contentItemId])
  @@index([userId])
  @@index([contentItemId])
}
```

- [ ] **Step 2: 在 ContentItem model 的 relations 区加反向关系**

在 ContentItem 的 relations（adminReviewer 之后）加：

```prisma
  favoritedBy   ArticleFavorite[]
```

- [ ] **Step 3: 在 User model 的 relations 区加反向关系**

在 User model（reviewedContentItems 之后）加：

```prisma
  articleFavorites   ArticleFavorite[]
```

- [ ] **Step 4: 验证**

Run: `pnpm exec prisma validate`

Expected: valid 🚀

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ArticleFavorite model for soft-favorite"
```

---

## Task 3: 新建 RoleQuota model（schema）

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 ArticleFavorite model 之后追加 RoleQuota model**

```prisma
// 角色配额（P2 新增）——管理员后台配置每个角色的收藏上限
model RoleQuota {
  id            String   @id @default(cuid())
  role          String   @unique // USER / VERIFIED_USER（ADMIN 不入库，代码硬编码不限）
  favoriteLimit Int
  updatedAt     DateTime @updatedAt
  updatedBy     String?
}
```

- [ ] **Step 2: 验证**

Run: `pnpm exec prisma validate`

Expected: valid 🚀

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add RoleQuota model for per-role favorite limit"
```

---

## Task 4: MaterialCard partial unique index（schema + 手写 SQL）

**Files:**
- Modify: `prisma/schema.prisma`（MaterialCard model，约第 206-234 行）
- 手写 migration SQL（Task 6 里写）

⚠️ Prisma 的 `@@unique` 不支持 partial index（`WHERE` 子句）。所以这里分两步：schema 加注释说明，实际 partial index 在 migration SQL 里手写。

- [ ] **Step 1: 在 MaterialCard model 的索引区加注释说明**

找到 MaterialCard 的 `@@index` 区（约第 229-233 行），在末尾追加注释：

```prisma
  @@index([contentItemId])
  @@index([cardType])
  @@index([confirmed])
  @@index([createdAt])
  @@index([ownerUserId])
  // NOTE: 私有卡去重用 partial unique index（见 migration SQL），不在此声明
  // CREATE UNIQUE INDEX materialcard_private_unique
  //   ON "MaterialCard" ("contentItemId", "cardType", "ownerUserId")
  //   WHERE "ownerUserId" IS NOT NULL;
```

- [ ] **Step 2: 验证 schema 仍合法（注释不影响）**

Run: `pnpm exec prisma validate`

Expected: valid 🚀

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "docs(schema): note MaterialCard partial unique index for private dedup"
```

---

## Task 5: 生成 migration（prisma migrate）

**Files:**
- Create: `prisma/migrations/<timestamp>_review_flow/migration.sql`（由 prisma 生成）

- [ ] **Step 1: 用 prisma 生成 migration（仅 DDL，不含回填）**

Run:

```bash
pnpm exec prisma migrate dev --name review_flow --create-only
```

Expected: 生成 `prisma/migrations/<timestamp>_review_flow/migration.sql`，内容是 `CREATE TABLE "ArticleFavorite"`、`CREATE TABLE "RoleQuota"`、`ALTER TABLE "ContentItem" ADD COLUMN ...`、`CREATE INDEX ...` 等 DDL。**不要直接 apply**，因为我们要在 SQL 里追加回填和 partial index。

- [ ] **Step 2: 打开生成的 migration.sql，确认 DDL 完整**

Run: `cat prisma/migrations/*_review_flow/migration.sql`

确认包含：
- `ALTER TABLE "ContentItem" ADD COLUMN "adminReviewStatus" TEXT NOT NULL DEFAULT 'pending_ai';`
- `ALTER TABLE "ContentItem" ADD COLUMN "adminReviewedAt" ...` 等 5 个新列
- `ALTER TABLE "ContentItem" ADD COLUMN "featuredToday" BOOLEAN NOT NULL DEFAULT false;`
- `CREATE TABLE "ArticleFavorite" ...`
- `CREATE TABLE "RoleQuota" ...`
- 各类 `CREATE INDEX`

如果缺漏，回到 Task 1-4 检查 schema。

- [ ] **Step 3: Commit（migration 文件先存档，下一步追加内容）**

```bash
git add prisma/migrations/
git commit -m "chore(migration): scaffold review_flow migration DDL"
```

---

## Task 6: 在 migration.sql 追加 partial unique index + 幂等回填

**Files:**
- Modify: `prisma/migrations/<timestamp>_review_flow/migration.sql`（在 DDL 末尾追加）

- [ ] **Step 1: 在 migration.sql 末尾追加 MaterialCard partial unique index**

打开 `prisma/migrations/<timestamp>_review_flow/migration.sql`，在文件末尾追加：

```sql

-- P2: MaterialCard 私有卡去重 partial unique index
-- 同一用户 + 同一文章 + 同一卡片类型只能一张；ownerUserId 为 NULL 的公共卡不受约束
CREATE UNIQUE INDEX IF NOT EXISTS "materialcard_private_unique"
  ON "MaterialCard" ("contentItemId", "cardType", "ownerUserId")
  WHERE "ownerUserId" IS NOT NULL;
```

- [ ] **Step 2: 追加历史数据幂等回填 SQL**

在 migration.sql 末尾继续追加：

```sql

-- ── P2 历史数据迁移（幂等：所有 UPDATE 都带 adminReviewStatus = 'pending_ai' 守卫）──

-- AI 通过的老文章 → 自动放行 approved（破红线，上线瞬间不让文章消失）
-- publicVisibleAt 和 adminReviewedBy 留空，标记为「迁移放行，非人工审核」
UPDATE "ContentItem"
SET "adminReviewStatus" = 'approved',
    "publicVisibleAt" = NULL,
    "adminReviewedBy" = NULL,
    "adminReviewedAt" = NULL
WHERE "aiDecision" = 'accept'
  AND "adminReviewStatus" = 'pending_ai';

-- AI 拒绝 → rejected
UPDATE "ContentItem"
SET "adminReviewStatus" = 'rejected'
WHERE "aiDecision" = 'reject'
  AND "adminReviewStatus" = 'pending_ai';

-- filtered / blocked → rejected（采集时就被判死的垃圾内容）
UPDATE "ContentItem"
SET "adminReviewStatus" = 'rejected'
WHERE "qualityStatus" IN ('filtered', 'blocked')
  AND "adminReviewStatus" = 'pending_ai';

-- 未评估的 candidate → 保持 pending_ai（默认值，兜底，理论上 UPDATE 不命中）
UPDATE "ContentItem"
SET "adminReviewStatus" = 'pending_ai'
WHERE "aiDecision" IS NULL
  AND "qualityStatus" = 'candidate'
  AND "adminReviewStatus" = 'pending_ai';
```

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/
git commit -m "feat(migration): add MaterialCard partial index and idempotent backfill"
```

---

## Task 7: 应用 migration + 生成 client

**Files:** 无（本地数据库操作）

- [ ] **Step 1: 应用 migration 到本地数据库**

Run:

```bash
pnpm exec prisma migrate dev
```

Expected: `Applying migration review_flow ...` 成功，无错误。如果报错「partial index syntax」，确认数据库是 PostgreSQL（schema 第 9 行 `provider = "postgresql"`）。

- [ ] **Step 2: 重新生成 Prisma client（输出到 src/generated/prisma）**

Run:

```bash
pnpm exec prisma generate
```

Expected: `Generated Prisma Client` 到 `src/generated/prisma`。确认 `src/generated/prisma/index.d.ts` 里能搜到 `adminReviewStatus`、`ArticleFavorite`、`RoleQuota`。

- [ ] **Step 3: Commit 生成的 client（如果项目把 generated 纳入 git）**

Run: `git status` 看 `src/generated/prisma/` 是否有变更。

如果项目 .gitignore 排除了 generated（查 `.gitignore` 含 `src/generated`），跳过 commit；否则：

```bash
git add src/generated/prisma/
git commit -m "chore(prisma): regenerate client with review_flow schema"
```

---

## Task 8: 验证回填结果 + 写 RoleQuota seed

**Files:**
- Create or Modify: `prisma/seed-role-quotas.ts`（或现有 seed 文件）

- [ ] **Step 1: 查询本地数据库，核对回填数量分布**

Run:

```bash
pnpm exec prisma db execute --stdin <<'SQL'
SELECT "adminReviewStatus", COUNT(*) FROM "ContentItem" GROUP BY "adminReviewStatus";
SQL
```

Expected: 输出类似
```
approved    | <N>   ← AI 通过的老文章（破红线放行）
rejected    | <M>   ← AI 拒绝 + filtered + blocked
pending_ai  | <K>   ← 未评估的 candidate
```

**核对要点**：
- `approved` 数量 ≈ 数据库里 `aiDecision = 'accept'` 的文章数
- `rejected` 数量 ≈ `aiDecision = 'reject'` + filtered + blocked
- `pending_ai` 数量 ≈ 未评估的 candidate
- 不应该有 `pending_admin`（迁移不会产生这个状态）

如果数量对不上，回 Task 6 检查回填 SQL 的 WHERE 条件。

- [ ] **Step 2: 验证幂等性——再跑一次 migration 不应改变数据**

Run:

```bash
pnpm exec prisma migrate deploy
```

再查一次数量（Step 1 的命令）。Expected: 数量完全不变（所有 UPDATE 都带守卫，二次执行不命中）。✅

- [ ] **Step 3: 写 RoleQuota seed 脚本**

新建 `prisma/seed-role-quotas.ts`：

```typescript
import { PrismaClient } from "../src/generated/prisma";

const db = new PrismaClient();

async function main() {
  // ADMIN 不入库，代码里硬编码不限（User 角色限额默认 100，VERIFIED_USER 默认 300）
  await db.roleQuota.upsert({
    where: { role: "USER" },
    update: {},
    create: { role: "USER", favoriteLimit: 100 },
  });

  await db.roleQuota.upsert({
    where: { role: "VERIFIED_USER" },
    update: {},
    create: { role: "VERIFIED_USER", favoriteLimit: 300 },
  });

  console.log("RoleQuota seed done: USER=100, VERIFIED_USER=300");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
```

- [ ] **Step 4: 执行 seed**

Run: `pnpm exec tsx prisma/seed-role-quotas.ts`

Expected: `RoleQuota seed done: USER=100, VERIFIED_USER=300`

如果项目 `package.json` 有统一的 `prisma db seed` 配置（查 `package.json` 的 `prisma.seed` 字段），把这个脚本注册进去；否则用 tsx 直接跑。

- [ ] **Step 5: 验证 seed 写入**

Run:

```bash
pnpm exec prisma db execute --stdin <<'SQL'
SELECT "role", "favoriteLimit" FROM "RoleQuota";
SQL
```

Expected:
```
USER           | 100
VERIFIED_USER  | 300
```

- [ ] **Step 6: Commit seed 脚本**

```bash
git add prisma/seed-role-quotas.ts package.json
git commit -m "feat(seed): add RoleQuota defaults USER=100 VERIFIED_USER=300"
```

---

## Task 9: 全量验收 + 交接文档

**Files:**
- Create: `docs/handoff/P2-schema-migration-handoff.md`

- [ ] **Step 1: 跑验收命令**

```bash
pnpm lint
pnpm test
pnpm build
```

Expected:
- `pnpm lint` → 0 error（schema/seed 不影响 lint）
- `pnpm test` → 全绿（现有测试不应受 schema 改动影响；如果有测试依赖了旧字段，修测试）
- `pnpm build` → 成功（Prisma client 已重新生成）

注意：P2 不新增 e2e（数据库迁移本身不直接产生用户可见行为，e2e 在 P3-P8 业务功能里覆盖）。

- [ ] **Step 2: 写交接文档 `docs/handoff/P2-schema-migration-handoff.md`**

```markdown
# P2 交接文档：Schema + 历史数据迁移

## 改了什么

### Schema 改动（prisma/schema.prisma）
- ContentItem 新增 6 字段：`adminReviewStatus`（默认 pending_ai）、`adminReviewedAt`、`adminReviewedBy`、`adminReviewNote`、`publicVisibleAt`、`featuredToday`
- ContentItem 新增索引：`@@index([adminReviewStatus])`、`@@index([featuredToday])`
- ContentItem 新增关系：`adminReviewer User?`（@relation "ContentItemAdminReviewer"）
- 新建 ArticleFavorite model（userId + contentItemId，@@unique 软收藏去重）
- 新建 RoleQuota model（role @unique，favoriteLimit）
- MaterialCard 加 partial unique index 注释（实际 index 在 migration SQL）

### Migration（prisma/migrations/<timestamp>_review_flow/migration.sql）
- DDL：新增列、新增表、新增索引
- MaterialCard partial unique index（WHERE ownerUserId IS NOT NULL）
- 历史数据幂等回填（见下）

## 历史数据迁移规则（已执行，幂等）

| 老文章条件 | 新 adminReviewStatus | 备注 |
|---|---|---|
| aiDecision = accept | approved | ⚠️ 破红线自动放行，publicVisibleAt/adminReviewedBy 留空标记 |
| aiDecision = reject | rejected | |
| qualityStatus in (filtered, blocked) | rejected | 垃圾内容直接判死 |
| aiDecision is null + candidate | pending_ai | 等管理员触发 AI 评估 |

**幂等保证**：所有 UPDATE 带 `WHERE adminReviewStatus = 'pending_ai'` 守卫，二次执行不命中。

## 本地回填结果（实测）
- approved: <填实测数量>
- rejected: <填实测数量>
- pending_ai: <填实测数量>

## RoleQuota 种子
- USER: 100
- VERIFIED_USER: 300
- ADMIN: 不入库（代码硬编码不限）

## 风险
- 破红线放行的老文章没有人工审核痕迹（publicVisibleAt 为空），日后可用此字段筛选清理。
- partial unique index 依赖 PostgreSQL（已确认）。

## 给后续 PR 的注意事项
- P3 文章可见性：用 `adminReviewStatus = 'approved'` 过滤。
- P4 审核：approve 时填 publicVisibleAt/adminReviewedBy；下架时清 featuredToday。
- P5 素材卡：依赖 MaterialCard partial unique index。
- P6 收藏：用 ArticleFavorite 表。
- P6 配额：用 RoleQuota 表（ADMIN 不查表，代码返 Infinity）。
- P7 前台：featuredToday 字段用于今日推荐。
```

- [ ] **Step 3: Commit 交接文档**

```bash
git add docs/handoff/P2-schema-migration-handoff.md
git commit -m "docs(handoff): P2 schema and migration"
```

---

## Verification（端到端验证清单）

P2 完成后，以下必须成立：

1. `pnpm exec prisma validate` → valid ✅
2. `pnpm exec prisma migrate dev` → 成功应用，无错误 ✅
3. `pnpm exec prisma generate` → client 含新字段/新 model ✅
4. 回填后 `approved + rejected + pending_ai` 之和 = ContentItem 总数（无孤儿状态）✅
5. 二次 `prisma migrate deploy` → 数据不变（幂等）✅
6. RoleQuota 表有 USER=100、VERIFIED_USER=300 两条 ✅
7. MaterialCard partial unique index 存在：插入同 `(contentItemId, cardType, ownerUserId)` 的非 NULL 重复记录应报错 ✅（可用 `pnpm exec prisma db execute` 手测）
8. `pnpm lint && pnpm test && pnpm build` → 全绿 ✅

---

## Self-Review

**Spec coverage：**
- 需求 4.1 ContentItem 审核字段 → Task 1 ✅
- 需求 4.3 状态映射 → Task 6 回填 SQL ✅
- 需求第 5 节历史数据迁移 → Task 6（含破红线 + publicVisibleAt 留空）✅
- 决策 5（AI 通过老文章自动放行）→ Task 6 第一条 UPDATE ✅
- 决策 6（publicVisibleAt/adminReviewedBy 留空）→ Task 6 第一条 UPDATE SET 子句 ✅
- 决策 7（MaterialCard 去重后端 PG 约束）→ Task 4 + Task 6 partial index ✅
- 决策 16（软收藏 ArticleFavorite）→ Task 2 ✅
- 决策 18（RoleQuota 按角色配额）→ Task 3 + Task 8 seed ✅
- 决策 12（featuredToday 今日推荐标记）→ Task 1 ✅

**Placeholder scan：** 无 TBD/TODO。所有 SQL 完整。✅

**Type consistency：** `adminReviewStatus` 在 schema、migration SQL、回填、handoff 里全部用 `pending_ai/pending_admin/approved/rejected` 四值，字符串完全一致。`ArticleFavorite` 字段名 `userId/contentItemId` 全 plan 一致。✅
