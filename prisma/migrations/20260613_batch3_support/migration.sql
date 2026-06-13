-- Batch 3: MaterialCard archivedAt (soft-delete) + UserContentState (per-user learning state)

-- Add archivedAt to MaterialCard for soft-delete support
ALTER TABLE "MaterialCard" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "MaterialCard_archivedAt_idx" ON "MaterialCard"("archivedAt");

-- Create UserContentState table for per-user learning state (read/ignored)
CREATE TABLE "UserContentState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserContentState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserContentState_userId_contentItemId_key" ON "UserContentState"("userId", "contentItemId");
CREATE INDEX "UserContentState_userId_idx" ON "UserContentState"("userId");
CREATE INDEX "UserContentState_contentItemId_idx" ON "UserContentState"("contentItemId");

ALTER TABLE "UserContentState" ADD CONSTRAINT "UserContentState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserContentState" ADD CONSTRAINT "UserContentState_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
