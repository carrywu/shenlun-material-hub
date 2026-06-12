-- P1-005: Backfill migration drift
-- These tables/columns/indexes exist in the database but were never recorded in migration history.
-- All statements use IF NOT EXISTS / IF EXISTS for idempotency — safe to run on production.
-- No data is deleted or modified.

-- ============================================================================
-- 1. AiConfig: add userId column + update unique constraint
-- ============================================================================

-- Add userId column (nullable, references User)
ALTER TABLE "AiConfig" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Drop old single-column unique index on "name" (was created in 0_init)
-- Replace with composite unique index on ("name", "userId") per current schema
DROP INDEX IF EXISTS "AiConfig_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "AiConfig_name_userId_key" ON "AiConfig"("name", "userId");

-- Add index on userId
CREATE INDEX IF NOT EXISTS "AiConfig_userId_idx" ON "AiConfig"("userId");

-- Add foreign key (idempotent: check existence first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AiConfig_userId_fkey'
      AND table_name = 'AiConfig'
  ) THEN
    ALTER TABLE "AiConfig" ADD CONSTRAINT "AiConfig_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Update default values for baseUrl and model to match current schema
-- (0_init had 'https://api.openai.com/v1' and 'gpt-4o'; current schema uses deepseek)
ALTER TABLE "AiConfig" ALTER COLUMN "baseUrl" SET DEFAULT 'https://api.deepseek.com/v1';
ALTER TABLE "AiConfig" ALTER COLUMN "model" SET DEFAULT 'deepseek-chat';

-- ============================================================================
-- 2. UserIntegration (Phase 3: user integration configs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "UserIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntegration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserIntegration_userId_idx" ON "UserIntegration"("userId");
CREATE INDEX IF NOT EXISTS "UserIntegration_provider_idx" ON "UserIntegration"("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "UserIntegration_userId_provider_key" ON "UserIntegration"("userId", "provider");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'UserIntegration_userId_fkey'
      AND table_name = 'UserIntegration'
  ) THEN
    ALTER TABLE "UserIntegration" ADD CONSTRAINT "UserIntegration_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 3. ImaTarget (Phase 3: IMA knowledge base configs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ImaTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.ima.qq.com',
    "clientId" TEXT,
    "encryptedApiKey" TEXT,
    "knowledgeBaseId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImaTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImaTarget_userId_idx" ON "ImaTarget"("userId");
CREATE INDEX IF NOT EXISTS "ImaTarget_isEnabled_idx" ON "ImaTarget"("isEnabled");
CREATE UNIQUE INDEX IF NOT EXISTS "ImaTarget_userId_name_key" ON "ImaTarget"("userId", "name");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ImaTarget_userId_fkey'
      AND table_name = 'ImaTarget'
  ) THEN
    ALTER TABLE "ImaTarget" ADD CONSTRAINT "ImaTarget_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4. Invitation (Phase 4: invitation codes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_code_key" ON "Invitation"("code");
CREATE INDEX IF NOT EXISTS "Invitation_code_idx" ON "Invitation"("code");
CREATE INDEX IF NOT EXISTS "Invitation_createdBy_idx" ON "Invitation"("createdBy");
CREATE INDEX IF NOT EXISTS "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Invitation_createdBy_fkey'
      AND table_name = 'Invitation'
  ) THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 5. InvitationUse (Phase 4: invitation usage records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "InvitationUse" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationUse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvitationUse_invitationId_idx" ON "InvitationUse"("invitationId");
CREATE INDEX IF NOT EXISTS "InvitationUse_userId_idx" ON "InvitationUse"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'InvitationUse_invitationId_fkey'
      AND table_name = 'InvitationUse'
  ) THEN
    ALTER TABLE "InvitationUse" ADD CONSTRAINT "InvitationUse_invitationId_fkey"
      FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'InvitationUse_userId_fkey'
      AND table_name = 'InvitationUse'
  ) THEN
    ALTER TABLE "InvitationUse" ADD CONSTRAINT "InvitationUse_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6. AuditLog (Phase 4: audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_resource_idx" ON "AuditLog"("resource");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AuditLog_userId_fkey'
      AND table_name = 'AuditLog'
  ) THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
