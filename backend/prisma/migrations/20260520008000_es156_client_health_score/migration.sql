CREATE TYPE "ClientHealthStatus" AS ENUM (
  'EXCELLENT',
  'HEALTHY',
  'NEEDS_ATTENTION',
  'AT_RISK',
  'CRITICAL',
  'UNKNOWN'
);

CREATE TYPE "ClientHealthDimension" AS ENUM (
  'ONBOARDING',
  'PRODUCT_USAGE',
  'SUBSCRIPTION',
  'SAAS_BILLING',
  'SUPPORT',
  'DATA_QUALITY',
  'SECURITY',
  'MONITORING',
  'FOLLOW_UP',
  'ENGAGEMENT',
  'PLATFORM_SERVICES',
  'KNOWLEDGE_BASE'
);

CREATE TYPE "ClientHealthRiskReason" AS ENUM (
  'ONBOARDING_STUCK',
  'NO_ASSOCIATION_LINKED',
  'NO_ACTIVE_SUBSCRIPTION',
  'TRIAL_ENDING_SOON',
  'SUBSCRIPTION_SUSPENDED',
  'SAAS_INVOICE_OVERDUE',
  'LOW_ADMIN_ACTIVITY',
  'NO_RECENT_LOGIN',
  'NO_BILLING_RUN',
  'NO_RECENT_INVOICES',
  'MANY_DATA_QUALITY_ISSUES',
  'CRITICAL_DATA_QUALITY_ISSUES',
  'OPEN_SUPPORT_ISSUES',
  'OPEN_PRODUCTION_INCIDENT',
  'SECURITY_EVENTS',
  'FAILED_NOTIFICATIONS',
  'FAILED_IMPORTS',
  'OVERDUE_FOLLOW_UP',
  'OVERDUE_TASKS',
  'NO_OWNER_ASSIGNED',
  'PLATFORM_SERVICE_DUE',
  'MISSING_KNOWLEDGE_CONTEXT',
  'CUSTOMER_AT_RISK_MANUAL',
  'OTHER'
);

CREATE TYPE "ClientHealthCalculationSource" AS ENUM ('MANUAL', 'SYSTEM', 'ON_DEMAND');
CREATE TYPE "ClientHealthActionStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'DISMISSED', 'COMPLETED');

CREATE TABLE "client_health_snapshots" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "overallScore" INTEGER NOT NULL,
  "status" "ClientHealthStatus" NOT NULL,
  "dimensions" JSONB NOT NULL,
  "riskReasons" JSONB NOT NULL,
  "recommendedActions" JSONB NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calculatedById" TEXT,
  "calculationSource" "ClientHealthCalculationSource" NOT NULL DEFAULT 'ON_DEMAND',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_health_overrides" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "overrideStatus" "ClientHealthStatus",
  "overrideScore" INTEGER,
  "reason" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "disabledById" TEXT,
  CONSTRAINT "client_health_overrides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_health_actions" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "riskReason" "ClientHealthRiskReason" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ClientHealthActionStatus" NOT NULL DEFAULT 'SUGGESTED',
  "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "relatedTaskId" TEXT,
  "relatedFollowUpId" TEXT,
  "createdById" TEXT,
  "acceptedById" TEXT,
  "completedById" TEXT,
  "dismissedById" TEXT,
  "dismissedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_health_actions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "client_health_snapshots" ADD CONSTRAINT "client_health_snapshots_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_health_overrides" ADD CONSTRAINT "client_health_overrides_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_health_actions" ADD CONSTRAINT "client_health_actions_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "client_health_snapshots_clientAccountId_calculatedAt_idx" ON "client_health_snapshots"("clientAccountId", "calculatedAt");
CREATE INDEX "client_health_snapshots_associationId_calculatedAt_idx" ON "client_health_snapshots"("associationId", "calculatedAt");
CREATE INDEX "client_health_snapshots_status_overallScore_idx" ON "client_health_snapshots"("status", "overallScore");
CREATE INDEX "client_health_snapshots_calculationSource_calculatedAt_idx" ON "client_health_snapshots"("calculationSource", "calculatedAt");

CREATE INDEX "client_health_overrides_clientAccountId_active_idx" ON "client_health_overrides"("clientAccountId", "active");
CREATE INDEX "client_health_overrides_associationId_active_idx" ON "client_health_overrides"("associationId", "active");
CREATE INDEX "client_health_overrides_overrideStatus_active_idx" ON "client_health_overrides"("overrideStatus", "active");

CREATE INDEX "client_health_actions_clientAccountId_status_priority_idx" ON "client_health_actions"("clientAccountId", "status", "priority");
CREATE INDEX "client_health_actions_associationId_status_idx" ON "client_health_actions"("associationId", "status");
CREATE INDEX "client_health_actions_riskReason_status_idx" ON "client_health_actions"("riskReason", "status");
CREATE INDEX "client_health_actions_relatedTaskId_idx" ON "client_health_actions"("relatedTaskId");
CREATE INDEX "client_health_actions_relatedFollowUpId_idx" ON "client_health_actions"("relatedFollowUpId");
