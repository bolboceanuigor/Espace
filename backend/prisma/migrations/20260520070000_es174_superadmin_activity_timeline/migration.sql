-- ES-174: extend AuditLog into the Superadmin activity timeline / audit trail.

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "actorName" TEXT,
  ADD COLUMN IF NOT EXISTS "actorRole" TEXT,
  ADD COLUMN IF NOT EXISTS "accessRequestId" TEXT,
  ADD COLUMN IF NOT EXISTS "contractId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingTaskId" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationId" TEXT,
  ADD COLUMN IF NOT EXISTS "targetUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "documentId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB,
  ADD COLUMN IF NOT EXISTS "beforeJson" JSONB,
  ADD COLUMN IF NOT EXISTS "afterJson" JSONB;

ALTER TABLE "audit_logs" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "audit_logs_accessRequestId_createdAt_idx" ON "audit_logs"("accessRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_contractId_createdAt_idx" ON "audit_logs"("contractId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_subscriptionId_createdAt_idx" ON "audit_logs"("subscriptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_billingTaskId_createdAt_idx" ON "audit_logs"("billingTaskId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_notificationId_createdAt_idx" ON "audit_logs"("notificationId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_targetUserId_createdAt_idx" ON "audit_logs"("targetUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_severity_createdAt_idx" ON "audit_logs"("severity", "createdAt");
