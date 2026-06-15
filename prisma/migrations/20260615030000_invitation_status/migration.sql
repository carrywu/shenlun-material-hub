ALTER TABLE "Invitation" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");
