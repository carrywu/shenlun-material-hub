-- Add nullable AI provenance metadata without changing existing AI assessment values.
ALTER TABLE "ContentItem"
ADD COLUMN IF NOT EXISTS "aiAssessmentSource" TEXT,
ADD COLUMN IF NOT EXISTS "aiAssessmentModel" TEXT,
ADD COLUMN IF NOT EXISTS "aiPromptVersion" TEXT,
ADD COLUMN IF NOT EXISTS "aiContentHash" TEXT,
ADD COLUMN IF NOT EXISTS "aiLastError" TEXT,
ADD COLUMN IF NOT EXISTS "aiLastFailedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ContentItem_aiAssessmentSource_idx"
ON "ContentItem"("aiAssessmentSource");

CREATE INDEX IF NOT EXISTS "ContentItem_aiContentHash_idx"
ON "ContentItem"("aiContentHash");
