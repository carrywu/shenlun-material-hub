# P2 交接文档：Schema + 历史数据迁移

## 改了什么

### Schema 改动（`prisma/schema.prisma`）
- **ContentItem 新增 6 字段**：`adminReviewStatus`（默认 `pending_ai`）、`adminReviewedAt`、`adminReviewedBy`、`adminReviewNote`、`publicVisibleAt`、`featuredToday`（默认 false）
- **ContentItem 新增 2 索引**：`@@index([adminReviewStatus])`、`@@index([featuredToday])`
- **ContentItem 新增关系**：`adminReviewer User?`（`@relation("ContentItemAdminReviewer")`，FK = `adminReviewedBy`）
- **User 反向关系**：`reviewedContentItems`、`articleFavorites`
- **新建 `ArticleFavorite` model**（软收藏关系表，`@@unique([userId, contentItemId])`，级联删除）
- **新建 `RoleQuota` model**（`role @unique`，`favoriteLimit`）
- **MaterialCard** 加 partial unique index 注释（实际 index 在 migration SQL 里手写，Prisma schema 不支持 partial index 声明）

### Migration（`prisma/migrations/20260611175652_review_flow/migration.sql`）
DDL（prisma migrate diff 生成，基于 P2 前后 schema 差异）：
- ALTER TABLE ContentItem ADD COLUMN × 6
- CREATE TABLE ArticleFavorite / RoleQuota
- CREATE INDEX × 多个
- CREATE UNIQUE INDEX ArticleFavorite_userId_contentItemId_key

**手写追加**（T6）：
- `CREATE UNIQUE INDEX IF NOT EXISTS materialcard_private_unique ON "MaterialCard" (...) WHERE "ownerUserId" IS NOT NULL`（私有卡去重）
- 4 条幂等回填 UPDATE（全部带 `WHERE adminReviewStatus = 'pending_ai'` 守卫）：
  1. `aiDecision = 'accept'` → `approved`（**破红线自动放行**，`publicVisibleAt`/`adminReviewedBy` 留空标记为「迁移放行非人工」）
  2. `aiDecision = 'reject'` → `rejected`
  3. `qualityStatus IN ('filtered','blocked')` → `rejected`
  4. 未评估 candidate → 保持 `pending_ai`（兜底）

### Seed（`src/scripts/seed-role-quotas.ts`）
- 幂等 upsert `USER=100`、`VERIFIED_USER=300`（ADMIN 不入库）
- 注册 `pnpm seed:role-quotas`
- 用 dynamic import + 相对路径匹配 `seed-admin.ts` 风格

## ⚠️ 本地未 apply，必须 staging apply 后核对

**方案 B**：本地 dev 库存在 schema drift（7 张表 + AiConfig 改动未在 migration 历史里），`prisma migrate dev --create-only` 触发 drift 检测会要求 `migrate reset`（破坏性）。为安全起见，**本次只在 worktree 生成 SQL 文件，未 apply 到任何数据库**。

### 部署到 staging 时必须做（顺序）
1. `pnpm exec prisma generate`（重新生成 client）
2. `pnpm db:migrate`（= `prisma migrate deploy`，应用 review_flow migration）
3. **核对回填数量**（关键）：
   ```sql
   SELECT "adminReviewStatus", COUNT(*) FROM "ContentItem" GROUP BY "adminReviewStatus";
   ```
   预期：`approved`（AI 通过的老文章）+ `rejected`（AI 拒绝 + filtered + blocked）+ `pending_ai`（未评估）三者之和 = ContentItem 总数。**不应有 `pending_admin`**（迁移不产生此状态）。
4. `pnpm seed:role-quotas`（写入 USER=100, VERIFIED_USER=300）
5. 验证 RoleQuota 表：`SELECT role, "favoriteLimit" FROM "RoleQuota";`
6. 验证 MaterialCard partial index 存在：尝试 INSERT 同 `(contentItemId, cardType, ownerUserId)` 的非 NULL 重复记录应报 unique violation

### 幂等性保证
所有回填 UPDATE 带 `adminReviewStatus = 'pending_ai'` 守卫，二次 `migrate deploy` 不命中。partial index 用 `IF NOT EXISTS`。

## 测试结果（本地 worktree）
- `pnpm lint`：**0 error，16 warning**（全部既有未使用变量，与 P2 无关）
- `pnpm test`（vitest）：**280/280 passed**（schema 改动未破坏任何现有测试）
- `pnpm build`：**成功**
- `tsc --noEmit`（仅 seed-role-quotas.ts）：**无错误**（其他既有测试文件的 tsc 错误是 P2 前就存在的，与本次无关）
- e2e：P2 不新增 e2e（数据库迁移本身不直接产生用户可见行为，e2e 在 P3-P8 业务功能覆盖）

## 相关 commit
- `562ea70` feat(schema): add review fields, ArticleFavorite, RoleQuota, MaterialCard dedup note
- `d46d2fc` feat(migration): review_flow DDL + MaterialCard partial index + idempotent backfill
- `dd164ac` feat(seed): RoleQuota defaults USER=100 VERIFIED_USER=300
- `4e84eea` chore(seed): move RoleQuota seed to src/scripts + register npm script

## ⚠️ 本地 dev 库 drift（独立 issue，不属于 P2）
本地 `localhost:5432/shenlun_material_hub` 有 7 张表（`AuditLog`/`ImaTarget`/`Invitation`/`InvitationUse`/`UserIntegration`/`WeweAccount`/`WeweSubscription`）和 `AiConfig` 改动**不在 `0_init` migration 里**。这是历史遗留，与 P2 无关。建议单独开 issue 用 `prisma migrate diff` 把这些反向工程成 migration 补齐历史。**P2 没有处理这个 drift**（也不应该处理）。

## 给后续 PR 的注意事项
- **P3** 文章可见性：用 `adminReviewStatus = 'approved'` 过滤（字段已就绪）
- **P4** 审核：approve 时填 `publicVisibleAt`/`adminReviewedBy`；下架时清 `featuredToday`
- **P5** 素材卡：依赖 `materialcard_private_unique` index（migration apply 后生效）
- **P6** 收藏：用 `ArticleFavorite` 表 + `RoleQuota` 表（ADMIN 不查表，代码返 Infinity）
- **P7** 前台：`featuredToday` 字段驱动今日推荐

## 验收清单（staging apply 后才能完成）
- [ ] `prisma migrate deploy` 成功应用 review_flow
- [ ] `SELECT adminReviewStatus, COUNT(*)` 数量分布合理
- [ ] 二次 `migrate deploy` 数据不变（幂等）
- [ ] `pnpm seed:role-quotas` 写入 2 条 RoleQuota
- [ ] MaterialCard partial index 存在且生效
- [ ] `pnpm lint && pnpm test && pnpm build` 全绿（本地已验证）
