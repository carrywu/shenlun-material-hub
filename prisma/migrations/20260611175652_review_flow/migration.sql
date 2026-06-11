-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN     "adminReviewNote" TEXT,
ADD COLUMN     "adminReviewStatus" TEXT NOT NULL DEFAULT 'pending_ai',
ADD COLUMN     "adminReviewedAt" TIMESTAMP(3),
ADD COLUMN     "adminReviewedBy" TEXT,
ADD COLUMN     "featuredToday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicVisibleAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ArticleFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleQuota" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "favoriteLimit" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "RoleQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleFavorite_userId_idx" ON "ArticleFavorite"("userId");

-- CreateIndex
CREATE INDEX "ArticleFavorite_contentItemId_idx" ON "ArticleFavorite"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleFavorite_userId_contentItemId_key" ON "ArticleFavorite"("userId", "contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleQuota_role_key" ON "RoleQuota"("role");

-- CreateIndex
CREATE INDEX "ContentItem_adminReviewStatus_idx" ON "ContentItem"("adminReviewStatus");

-- CreateIndex
CREATE INDEX "ContentItem_featuredToday_idx" ON "ContentItem"("featuredToday");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_adminReviewedBy_fkey" FOREIGN KEY ("adminReviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleFavorite" ADD CONSTRAINT "ArticleFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleFavorite" ADD CONSTRAINT "ArticleFavorite_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- P2: MaterialCard 私有卡去重 partial unique index
-- 同一用户 + 同一文章 + 同一卡片类型只能一张；ownerUserId 为 NULL 的公共卡不受约束
CREATE UNIQUE INDEX IF NOT EXISTS "materialcard_private_unique"
  ON "MaterialCard" ("contentItemId", "cardType", "ownerUserId")
  WHERE "ownerUserId" IS NOT NULL;

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
