CREATE TYPE "LaunchStateStatus" AS ENUM ('NOT_READY', 'NEEDS_ATTENTION', 'READY', 'LIVE');
CREATE TYPE "LaunchChecklistCategory" AS ENUM ('PRODUCT', 'INFRASTRUCTURE', 'DATABASE', 'DEPLOYMENT', 'ENVIRONMENT', 'SECURITY', 'LEGAL', 'BILLING', 'NOTIFICATIONS', 'PAYMENTS', 'FIRST_APC', 'SUPPORT', 'MONITORING', 'COSTS');
CREATE TYPE "LaunchChecklistStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'WARNING', 'BLOCKED', 'NOT_APPLICABLE');
CREATE TYPE "LaunchChecklistSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "PlatformServiceType" AS ENUM ('SOURCE_CONTROL', 'HOSTING_FRONTEND', 'HOSTING_BACKEND', 'DATABASE', 'STORAGE', 'AUTH', 'EMAIL', 'SMS', 'DOMAIN', 'DNS', 'MONITORING', 'ERROR_TRACKING', 'PAYMENT_PROVIDER', 'DESIGN_TOOL', 'DEVELOPMENT_TOOL', 'AI_CODING_TOOL', 'ANALYTICS', 'OTHER');
CREATE TYPE "PlatformServiceStatus" AS ENUM ('ACTIVE', 'TRIAL', 'PAYMENT_DUE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'UNKNOWN');
CREATE TYPE "PlatformServiceCriticality" AS ENUM ('CRITICAL', 'IMPORTANT', 'OPTIONAL');
CREATE TYPE "PlatformServiceBillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'PAY_AS_YOU_GO', 'FREE', 'UNKNOWN');
CREATE TYPE "PlatformServicePaymentEventType" AS ENUM ('PAYMENT_RECORDED', 'RENEWAL_RECORDED', 'STATUS_CHANGED', 'COST_CHANGED', 'NOTE_ADDED');
CREATE TYPE "LaunchEventType" AS ENUM ('CHECKLIST_UPDATED', 'SERVICE_ADDED', 'SERVICE_UPDATED', 'SERVICE_PAYMENT_RECORDED', 'GO_LIVE_READY_MARKED', 'LIVE_MARKED', 'BLOCKER_FOUND', 'BLOCKER_RESOLVED');

CREATE TABLE "launch_checklist_items" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "category" "LaunchChecklistCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "LaunchChecklistStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "severity" "LaunchChecklistSeverity" NOT NULL DEFAULT 'INFO',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "actionUrl" TEXT,
  "owner" TEXT,
  "evidence" TEXT,
  "checkedAt" TIMESTAMP(3),
  "checkedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "launch_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_services" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PlatformServiceType" NOT NULL,
  "providerName" TEXT NOT NULL,
  "description" TEXT,
  "purpose" TEXT NOT NULL,
  "criticality" "PlatformServiceCriticality" NOT NULL,
  "status" "PlatformServiceStatus" NOT NULL DEFAULT 'UNKNOWN',
  "billingCycle" "PlatformServiceBillingCycle" NOT NULL DEFAULT 'UNKNOWN',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "estimatedMonthlyCost" DOUBLE PRECISION,
  "estimatedYearlyCost" DOUBLE PRECISION,
  "nextPaymentDate" TIMESTAMP(3),
  "renewalDate" TIMESTAMP(3),
  "accountEmail" TEXT,
  "dashboardUrl" TEXT,
  "documentationUrl" TEXT,
  "ownerUserId" TEXT,
  "managedBy" TEXT,
  "environmentKeys" JSONB,
  "dependsOn" JSONB,
  "impactIfDown" TEXT NOT NULL,
  "notes" TEXT,
  "isRequiredForLaunch" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_service_payment_events" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "eventType" "PlatformServicePaymentEventType" NOT NULL,
  "amount" DOUBLE PRECISION,
  "currency" TEXT,
  "paymentDate" TIMESTAMP(3),
  "nextPaymentDate" TIMESTAMP(3),
  "note" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_service_payment_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "launch_state" (
  "id" TEXT NOT NULL,
  "status" "LaunchStateStatus" NOT NULL DEFAULT 'NOT_READY',
  "readinessScore" INTEGER NOT NULL DEFAULT 0,
  "markedReadyAt" TIMESTAMP(3),
  "markedReadyById" TEXT,
  "wentLiveAt" TIMESTAMP(3),
  "wentLiveById" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "launch_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "launch_events" (
  "id" TEXT NOT NULL,
  "eventType" "LaunchEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actorUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "launch_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "launch_checklist_items_key_key" ON "launch_checklist_items"("key");
CREATE INDEX "launch_checklist_items_category_status_idx" ON "launch_checklist_items"("category", "status");
CREATE INDEX "launch_checklist_items_severity_status_idx" ON "launch_checklist_items"("severity", "status");
CREATE INDEX "platform_services_type_status_idx" ON "platform_services"("type", "status");
CREATE INDEX "platform_services_criticality_status_idx" ON "platform_services"("criticality", "status");
CREATE INDEX "platform_services_nextPaymentDate_idx" ON "platform_services"("nextPaymentDate");
CREATE INDEX "platform_service_payment_events_serviceId_createdAt_idx" ON "platform_service_payment_events"("serviceId", "createdAt");
CREATE INDEX "platform_service_payment_events_eventType_createdAt_idx" ON "platform_service_payment_events"("eventType", "createdAt");
CREATE INDEX "launch_events_eventType_createdAt_idx" ON "launch_events"("eventType", "createdAt");

ALTER TABLE "launch_checklist_items" ADD CONSTRAINT "launch_checklist_items_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_services" ADD CONSTRAINT "platform_services_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_services" ADD CONSTRAINT "platform_services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_services" ADD CONSTRAINT "platform_services_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_service_payment_events" ADD CONSTRAINT "platform_service_payment_events_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "platform_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_service_payment_events" ADD CONSTRAINT "platform_service_payment_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "launch_state" ADD CONSTRAINT "launch_state_markedReadyById_fkey" FOREIGN KEY ("markedReadyById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "launch_state" ADD CONSTRAINT "launch_state_wentLiveById_fkey" FOREIGN KEY ("wentLiveById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "launch_events" ADD CONSTRAINT "launch_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
