DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuperadminNotificationType') THEN
    CREATE TYPE "SuperadminNotificationType" AS ENUM (
      'ACCESS_REQUEST_NEW',
      'ACCESS_REQUEST_UPDATED',
      'ORGANIZATION_CREATED',
      'ONBOARDING_BLOCKED',
      'ONBOARDING_READY',
      'ORGANIZATION_LAUNCHED',
      'CONTRACT_MISSING',
      'CONTRACT_UNSIGNED',
      'CONTRACT_EXPIRING',
      'CONTRACT_EXPIRED',
      'SUBSCRIPTION_INACTIVE',
      'SUBSCRIPTION_PAST_DUE',
      'TRIAL_ENDING',
      'BILLING_TASK_URGENT',
      'LIVE_WITHOUT_CONTRACT',
      'DOCUMENTS_MISSING',
      'SYSTEM',
      'OTHER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuperadminNotificationSeverity') THEN
    CREATE TYPE "SuperadminNotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuperadminNotificationStatus') THEN
    CREATE TYPE "SuperadminNotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "superadmin_notifications" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "type" "SuperadminNotificationType" NOT NULL,
  "severity" "SuperadminNotificationSeverity" NOT NULL DEFAULT 'INFO',
  "status" "SuperadminNotificationStatus" NOT NULL DEFAULT 'UNREAD',
  "organizationId" TEXT,
  "accessRequestId" TEXT,
  "billingTaskId" TEXT,
  "contractId" TEXT,
  "subscriptionId" TEXT,
  "actionUrl" TEXT,
  "metadataJson" JSONB,
  "createdForId" TEXT,
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "superadmin_notifications_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_notifications_organizationId_fkey'
  ) THEN
    ALTER TABLE "superadmin_notifications"
    ADD CONSTRAINT "superadmin_notifications_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_notifications_accessRequestId_fkey'
  ) THEN
    ALTER TABLE "superadmin_notifications"
    ADD CONSTRAINT "superadmin_notifications_accessRequestId_fkey"
    FOREIGN KEY ("accessRequestId") REFERENCES "customer_onboarding_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_notifications_billingTaskId_fkey'
  ) THEN
    ALTER TABLE "superadmin_notifications"
    ADD CONSTRAINT "superadmin_notifications_billingTaskId_fkey"
    FOREIGN KEY ("billingTaskId") REFERENCES "superadmin_billing_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_notifications_contractId_fkey'
  ) THEN
    ALTER TABLE "superadmin_notifications"
    ADD CONSTRAINT "superadmin_notifications_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "organization_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_notifications_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "superadmin_notifications"
    ADD CONSTRAINT "superadmin_notifications_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_notifications_createdForId_fkey'
  ) THEN
    ALTER TABLE "superadmin_notifications"
    ADD CONSTRAINT "superadmin_notifications_createdForId_fkey"
    FOREIGN KEY ("createdForId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "superadmin_notifications_status_createdAt_idx" ON "superadmin_notifications"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_severity_status_idx" ON "superadmin_notifications"("severity", "status");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_type_status_idx" ON "superadmin_notifications"("type", "status");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_organizationId_status_idx" ON "superadmin_notifications"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_accessRequestId_idx" ON "superadmin_notifications"("accessRequestId");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_billingTaskId_idx" ON "superadmin_notifications"("billingTaskId");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_contractId_idx" ON "superadmin_notifications"("contractId");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_subscriptionId_idx" ON "superadmin_notifications"("subscriptionId");
CREATE INDEX IF NOT EXISTS "superadmin_notifications_createdForId_status_idx" ON "superadmin_notifications"("createdForId", "status");
