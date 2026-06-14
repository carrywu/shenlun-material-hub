-- Allow article-only IMA sync records when no material card exists.
ALTER TABLE "SyncRecord"
ALTER COLUMN "materialCardId" DROP NOT NULL;
