-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "trustLevel" TEXT NOT NULL,
    "regionScopes" TEXT NOT NULL DEFAULT '[]',
    "baseUrl" TEXT,
    "profileUrl" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "collectionMode" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "collectionFrequency" TEXT,
    "lastCollectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provider" TEXT,
    "feedId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "hitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "filterRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectiveRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgAiScore" DOUBLE PRECISION,
    "sourceGrade" TEXT,
    "metricsUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionChannel" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "listUrl" TEXT NOT NULL,
    "urlPattern" TEXT,
    "paginationPattern" TEXT,
    "maxPages" INTEGER NOT NULL DEFAULT 3,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCollectedAt" TIMESTAMP(3),
    "collectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "channelId" TEXT,
    "externalContentId" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "trustLevel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorOrAccount" TEXT,
    "originalUrl" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "section" TEXT,
    "regionScopes" TEXT NOT NULL DEFAULT '[]',
    "topicTags" TEXT NOT NULL DEFAULT '[]',
    "excerpt" TEXT,
    "coverUrl" TEXT,
    "recommendationReason" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "discoveryChannel" TEXT,
    "fullTextStored" BOOLEAN NOT NULL DEFAULT false,
    "fullText" TEXT,
    "rawHtml" TEXT,
    "contentHash" TEXT,
    "linkedOriginalId" TEXT,
    "filterReason" TEXT,
    "qualityStatus" TEXT NOT NULL DEFAULT 'pending',
    "effectiveTextLength" INTEGER NOT NULL DEFAULT 0,
    "lastCleanedAt" TIMESTAMP(3),
    "aiScore" DOUBLE PRECISION,
    "aiDecision" TEXT,
    "aiReason" TEXT,
    "aiCategories" TEXT,
    "aiUsableFor" TEXT,
    "aiSummary" TEXT,
    "aiQuotes" TEXT,
    "aiAssessedAt" TIMESTAMP(3),
    "aiAssessmentError" TEXT,
    "contentGenre" TEXT,
    "aiScoreDetail" TEXT,
    "aiScoredAt" TIMESTAMP(3),
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "ownerUserId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCard" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceSnapshot" TEXT,
    "originalFacts" TEXT,
    "aiSummary" TEXT,
    "highlightSuggestions" TEXT,
    "transferSuggestions" TEXT,
    "verificationNotes" TEXT,
    "markdownContent" TEXT,
    "userEditedContent" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRecord" (
    "id" TEXT NOT NULL,
    "materialCardId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "documentRole" TEXT NOT NULL,
    "regionFolder" TEXT,
    "typeFolder" TEXT,
    "targetRemoteId" TEXT,
    "remoteDocumentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "SyncRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "collectorType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "evidencePath" TEXT,

    CONSTRAINT "CollectorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "encryptedKey" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "defaultContent" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleAnnotation" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "cardType" TEXT,
    "selectedText" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#facc15',
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "paragraph" INTEGER,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsyncTask" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "params" TEXT,
    "result" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AsyncTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Source_platform_idx" ON "Source"("platform");

-- CreateIndex
CREATE INDEX "Source_priority_idx" ON "Source"("priority");

-- CreateIndex
CREATE INDEX "Source_isEnabled_idx" ON "Source"("isEnabled");

-- CreateIndex
CREATE INDEX "Source_contentType_idx" ON "Source"("contentType");

-- CreateIndex
CREATE INDEX "Source_provider_idx" ON "Source"("provider");

-- CreateIndex
CREATE INDEX "Source_feedId_idx" ON "Source"("feedId");

-- CreateIndex
CREATE INDEX "CollectionChannel_sourceId_idx" ON "CollectionChannel"("sourceId");

-- CreateIndex
CREATE INDEX "CollectionChannel_isEnabled_idx" ON "CollectionChannel"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_originalUrl_key" ON "ContentItem"("originalUrl");

-- CreateIndex
CREATE INDEX "ContentItem_sourceId_idx" ON "ContentItem"("sourceId");

-- CreateIndex
CREATE INDEX "ContentItem_platform_idx" ON "ContentItem"("platform");

-- CreateIndex
CREATE INDEX "ContentItem_contentType_idx" ON "ContentItem"("contentType");

-- CreateIndex
CREATE INDEX "ContentItem_trustLevel_idx" ON "ContentItem"("trustLevel");

-- CreateIndex
CREATE INDEX "ContentItem_processingStatus_idx" ON "ContentItem"("processingStatus");

-- CreateIndex
CREATE INDEX "ContentItem_publishedAt_idx" ON "ContentItem"("publishedAt");

-- CreateIndex
CREATE INDEX "ContentItem_contentHash_idx" ON "ContentItem"("contentHash");

-- CreateIndex
CREATE INDEX "ContentItem_aiScore_idx" ON "ContentItem"("aiScore");

-- CreateIndex
CREATE INDEX "ContentItem_qualityStatus_idx" ON "ContentItem"("qualityStatus");

-- CreateIndex
CREATE INDEX "ContentItem_aiDecision_idx" ON "ContentItem"("aiDecision");

-- CreateIndex
CREATE INDEX "ContentItem_contentGenre_idx" ON "ContentItem"("contentGenre");

-- CreateIndex
CREATE INDEX "ContentItem_aiAssessedAt_idx" ON "ContentItem"("aiAssessedAt");

-- CreateIndex
CREATE INDEX "ContentItem_ownerUserId_idx" ON "ContentItem"("ownerUserId");

-- CreateIndex
CREATE INDEX "ContentItem_visibility_idx" ON "ContentItem"("visibility");

-- CreateIndex
CREATE INDEX "MaterialCard_contentItemId_idx" ON "MaterialCard"("contentItemId");

-- CreateIndex
CREATE INDEX "MaterialCard_cardType_idx" ON "MaterialCard"("cardType");

-- CreateIndex
CREATE INDEX "MaterialCard_confirmed_idx" ON "MaterialCard"("confirmed");

-- CreateIndex
CREATE INDEX "MaterialCard_createdAt_idx" ON "MaterialCard"("createdAt");

-- CreateIndex
CREATE INDEX "MaterialCard_ownerUserId_idx" ON "MaterialCard"("ownerUserId");

-- CreateIndex
CREATE INDEX "SyncRecord_materialCardId_idx" ON "SyncRecord"("materialCardId");

-- CreateIndex
CREATE INDEX "SyncRecord_contentItemId_idx" ON "SyncRecord"("contentItemId");

-- CreateIndex
CREATE INDEX "SyncRecord_status_idx" ON "SyncRecord"("status");

-- CreateIndex
CREATE INDEX "SyncRecord_syncedAt_idx" ON "SyncRecord"("syncedAt");

-- CreateIndex
CREATE INDEX "SyncRecord_userId_idx" ON "SyncRecord"("userId");

-- CreateIndex
CREATE INDEX "CollectorRun_sourceId_idx" ON "CollectorRun"("sourceId");

-- CreateIndex
CREATE INDEX "CollectorRun_status_idx" ON "CollectorRun"("status");

-- CreateIndex
CREATE INDEX "CollectorRun_startedAt_idx" ON "CollectorRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiConfig_name_key" ON "AiConfig"("name");

-- CreateIndex
CREATE INDEX "AiConfig_name_idx" ON "AiConfig"("name");

-- CreateIndex
CREATE INDEX "AiConfig_isEnabled_idx" ON "AiConfig"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "AiPromptTemplate_key_key" ON "AiPromptTemplate"("key");

-- CreateIndex
CREATE INDEX "AiPromptTemplate_key_idx" ON "AiPromptTemplate"("key");

-- CreateIndex
CREATE INDEX "AiPromptTemplate_enabled_idx" ON "AiPromptTemplate"("enabled");

-- CreateIndex
CREATE INDEX "ArticleAnnotation_contentItemId_idx" ON "ArticleAnnotation"("contentItemId");

-- CreateIndex
CREATE INDEX "ArticleAnnotation_createdAt_idx" ON "ArticleAnnotation"("createdAt");

-- CreateIndex
CREATE INDEX "ArticleAnnotation_userId_idx" ON "ArticleAnnotation"("userId");

-- CreateIndex
CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");

-- CreateIndex
CREATE INDEX "SystemLog_category_idx" ON "SystemLog"("category");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "AsyncTask_status_idx" ON "AsyncTask"("status");

-- CreateIndex
CREATE INDEX "AsyncTask_type_idx" ON "AsyncTask"("type");

-- CreateIndex
CREATE INDEX "AsyncTask_createdAt_idx" ON "AsyncTask"("createdAt");

-- CreateIndex
CREATE INDEX "AsyncTask_userId_idx" ON "AsyncTask"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionChannel" ADD CONSTRAINT "CollectionChannel_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCard" ADD CONSTRAINT "MaterialCard_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCard" ADD CONSTRAINT "MaterialCard_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRecord" ADD CONSTRAINT "SyncRecord_materialCardId_fkey" FOREIGN KEY ("materialCardId") REFERENCES "MaterialCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRecord" ADD CONSTRAINT "SyncRecord_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRecord" ADD CONSTRAINT "SyncRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorRun" ADD CONSTRAINT "CollectorRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleAnnotation" ADD CONSTRAINT "ArticleAnnotation_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleAnnotation" ADD CONSTRAINT "ArticleAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncTask" ADD CONSTRAINT "AsyncTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

