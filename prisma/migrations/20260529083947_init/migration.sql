-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "lastCollectedAt" DATETIME,
    "lastError" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalContentId" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "trustLevel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorOrAccount" TEXT,
    "originalUrl" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "section" TEXT,
    "regionScopes" TEXT NOT NULL DEFAULT '[]',
    "topicTags" TEXT NOT NULL DEFAULT '[]',
    "excerpt" TEXT,
    "recommendationReason" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "discoveryChannel" TEXT,
    "fullTextStored" BOOLEAN NOT NULL DEFAULT false,
    "fullText" TEXT,
    "contentHash" TEXT,
    "linkedOriginalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialCard_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncRecord_materialCardId_fkey" FOREIGN KEY ("materialCardId") REFERENCES "MaterialCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncRecord_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectorRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "collectorType" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "evidencePath" TEXT,
    CONSTRAINT "CollectorRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Source_platform_idx" ON "Source"("platform");

-- CreateIndex
CREATE INDEX "Source_priority_idx" ON "Source"("priority");

-- CreateIndex
CREATE INDEX "Source_isEnabled_idx" ON "Source"("isEnabled");

-- CreateIndex
CREATE INDEX "Source_contentType_idx" ON "Source"("contentType");

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
CREATE INDEX "MaterialCard_contentItemId_idx" ON "MaterialCard"("contentItemId");

-- CreateIndex
CREATE INDEX "MaterialCard_cardType_idx" ON "MaterialCard"("cardType");

-- CreateIndex
CREATE INDEX "MaterialCard_confirmed_idx" ON "MaterialCard"("confirmed");

-- CreateIndex
CREATE INDEX "MaterialCard_createdAt_idx" ON "MaterialCard"("createdAt");

-- CreateIndex
CREATE INDEX "SyncRecord_materialCardId_idx" ON "SyncRecord"("materialCardId");

-- CreateIndex
CREATE INDEX "SyncRecord_contentItemId_idx" ON "SyncRecord"("contentItemId");

-- CreateIndex
CREATE INDEX "SyncRecord_status_idx" ON "SyncRecord"("status");

-- CreateIndex
CREATE INDEX "SyncRecord_syncedAt_idx" ON "SyncRecord"("syncedAt");

-- CreateIndex
CREATE INDEX "CollectorRun_sourceId_idx" ON "CollectorRun"("sourceId");

-- CreateIndex
CREATE INDEX "CollectorRun_status_idx" ON "CollectorRun"("status");

-- CreateIndex
CREATE INDEX "CollectorRun_startedAt_idx" ON "CollectorRun"("startedAt");
