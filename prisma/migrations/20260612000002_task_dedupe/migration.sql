-- AlterTable
ALTER TABLE "AsyncTask" ADD COLUMN     "dedupeKey" TEXT;

-- P0-003: dedupeKey 部分唯一索引——同一去重键在 PENDING/RUNNING 状态下只能一个任务
CREATE UNIQUE INDEX IF NOT EXISTS "asynctask_dedupe_active_unique"
  ON "AsyncTask" ("dedupeKey", "userId")
  WHERE "dedupeKey" IS NOT NULL AND "status" IN ('PENDING', 'RUNNING');

