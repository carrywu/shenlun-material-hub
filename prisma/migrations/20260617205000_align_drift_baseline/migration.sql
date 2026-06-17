-- DropIndex
DROP INDEX "ContentItem_aiAssessmentSource_idx";

-- DropIndex
DROP INDEX "ContentItem_aiContentHash_idx";

-- AlterTable
ALTER TABLE "AiConfig" ALTER COLUMN "model" SET DEFAULT 'deepseek-v4-flash';

-- AlterTable
ALTER TABLE "CollectorRun" ADD COLUMN     "blockedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refreshedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skippedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

