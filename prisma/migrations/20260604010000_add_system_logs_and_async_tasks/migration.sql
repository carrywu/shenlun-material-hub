CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");
CREATE INDEX "SystemLog_category_idx" ON "SystemLog"("category");
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

CREATE TABLE "AsyncTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "params" TEXT,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE INDEX "AsyncTask_status_idx" ON "AsyncTask"("status");
CREATE INDEX "AsyncTask_type_idx" ON "AsyncTask"("type");
CREATE INDEX "AsyncTask_createdAt_idx" ON "AsyncTask"("createdAt");
