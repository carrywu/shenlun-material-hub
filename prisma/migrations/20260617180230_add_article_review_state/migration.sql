-- CreateTable
CREATE TABLE "ArticleReviewState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleReviewState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleReviewState_userId_idx" ON "ArticleReviewState"("userId");

-- CreateIndex
CREATE INDEX "ArticleReviewState_contentItemId_idx" ON "ArticleReviewState"("contentItemId");

-- CreateIndex
CREATE INDEX "ArticleReviewState_nextReviewAt_idx" ON "ArticleReviewState"("nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleReviewState_userId_contentItemId_key" ON "ArticleReviewState"("userId", "contentItemId");

-- AddForeignKey
ALTER TABLE "ArticleReviewState" ADD CONSTRAINT "ArticleReviewState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleReviewState" ADD CONSTRAINT "ArticleReviewState_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
