-- ES-131 Superadmin Impersonation & Support Access

CREATE TYPE "SuperadminSupportAccessMode" AS ENUM ('READ_ONLY', 'SUPPORT_WRITE');
CREATE TYPE "SuperadminSupportSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ENDED', 'REVOKED');
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SUPERADMIN_SUPPORT', 'SYSTEM');

ALTER TABLE "support_sessions"
  ADD COLUMN "mode" "SuperadminSupportAccessMode" NOT NULL DEFAULT 'READ_ONLY',
  ADD COLUMN "status" "SuperadminSupportSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "endedById" TEXT,
  ADD COLUMN "endReason" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedById" TEXT,
  ADD COLUMN "revokeReason" TEXT,
  ADD COLUMN "lastActivityAt" TIMESTAMP(3),
  ADD COLUMN "internalTicketRef" TEXT,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "support_sessions"
SET
  "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"SuperadminSupportSessionStatus" ELSE 'ENDED'::"SuperadminSupportSessionStatus" END,
  "expiresAt" = COALESCE("expiresAt", "startedAt" + interval '30 minutes'),
  "lastActivityAt" = COALESCE("lastActivityAt", "startedAt");

ALTER TABLE "audit_logs"
  ADD COLUMN "supportSessionId" TEXT,
  ADD COLUMN "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
  ADD COLUMN "effectiveAssociationId" TEXT,
  ADD COLUMN "isImpersonatedAction" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "support_sessions_superAdminUserId_status_expiresAt_idx" ON "support_sessions"("superAdminUserId", "status", "expiresAt");
CREATE INDEX "support_sessions_organizationId_status_expiresAt_idx" ON "support_sessions"("organizationId", "status", "expiresAt");
CREATE INDEX "audit_logs_supportSessionId_createdAt_idx" ON "audit_logs"("supportSessionId", "createdAt");
CREATE INDEX "audit_logs_effectiveAssociationId_createdAt_idx" ON "audit_logs"("effectiveAssociationId", "createdAt");
CREATE INDEX "audit_logs_isImpersonatedAction_createdAt_idx" ON "audit_logs"("isImpersonatedAction", "createdAt");

ALTER TABLE "support_sessions"
  ADD CONSTRAINT "support_sessions_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "support_sessions_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
