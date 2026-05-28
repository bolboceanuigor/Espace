CREATE TYPE "ClientLifecycleStage" AS ENUM ('NEW_REQUEST', 'CONTACTED', 'QUALIFIED', 'PREPARING_ONBOARDING', 'ONBOARDING', 'READY_TO_ACTIVATE', 'ACTIVE', 'AT_RISK', 'SUSPENDED', 'CHURNED', 'CLOSED');
CREATE TYPE "ClientAccountStatus" AS ENUM ('OPEN', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'CLOSED');
CREATE TYPE "ClientPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "ClientSource" AS ENUM ('PUBLIC_WEBSITE', 'ACCESS_REQUEST', 'REFERRAL', 'MANUAL', 'EXISTING_RELATIONSHIP', 'IMPORTED', 'OTHER');
CREATE TYPE "ClientRiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ClientActivityType" AS ENUM ('CLIENT_CREATED', 'STAGE_CHANGED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'OWNER_CHANGED', 'NOTE_ADDED', 'TASK_CREATED', 'TASK_COMPLETED', 'FOLLOW_UP_SET', 'CONTACT_RECORDED', 'CUSTOMER_REQUEST_LINKED', 'ASSOCIATION_LINKED', 'ONBOARDING_STARTED', 'ONBOARDING_COMPLETED', 'SUBSCRIPTION_LINKED', 'RISK_UPDATED', 'CLIENT_CLOSED', 'CLIENT_REOPENED');
CREATE TYPE "ClientTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ClientFollowUpStatus" AS ENUM ('OPEN', 'DONE', 'MISSED', 'CANCELLED');

CREATE TABLE "client_accounts" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "customerRequestId" TEXT,
  "lifecycleStage" "ClientLifecycleStage" NOT NULL DEFAULT 'NEW_REQUEST',
  "status" "ClientAccountStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "source" "ClientSource" NOT NULL DEFAULT 'MANUAL',
  "riskLevel" "ClientRiskLevel" NOT NULL DEFAULT 'NONE',
  "displayName" TEXT NOT NULL,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "associationName" TEXT,
  "associationCode" TEXT,
  "apartmentsCount" INTEGER,
  "address" TEXT,
  "ownerUserId" TEXT,
  "nextFollowUpAt" TIMESTAMP(3),
  "lastContactedAt" TIMESTAMP(3),
  "qualifiedAt" TIMESTAMP(3),
  "onboardingStartedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "churnedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closeReason" TEXT,
  "internalNotes" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_activities" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "actorUserId" TEXT,
  "type" "ClientActivityType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_tasks" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ClientTaskStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "dueAt" TIMESTAMP(3),
  "assignedToId" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_account_notes" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "authorUserId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_account_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_follow_ups" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "ClientFollowUpStatus" NOT NULL DEFAULT 'OPEN',
  "assignedToId" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_accounts_lifecycleStage_updatedAt_idx" ON "client_accounts"("lifecycleStage", "updatedAt");
CREATE INDEX "client_accounts_status_updatedAt_idx" ON "client_accounts"("status", "updatedAt");
CREATE INDEX "client_accounts_priority_updatedAt_idx" ON "client_accounts"("priority", "updatedAt");
CREATE INDEX "client_accounts_riskLevel_updatedAt_idx" ON "client_accounts"("riskLevel", "updatedAt");
CREATE INDEX "client_accounts_ownerUserId_nextFollowUpAt_idx" ON "client_accounts"("ownerUserId", "nextFollowUpAt");
CREATE INDEX "client_accounts_associationId_idx" ON "client_accounts"("associationId");
CREATE INDEX "client_accounts_customerRequestId_idx" ON "client_accounts"("customerRequestId");
CREATE INDEX "client_accounts_associationCode_idx" ON "client_accounts"("associationCode");

CREATE INDEX "client_activities_clientAccountId_createdAt_idx" ON "client_activities"("clientAccountId", "createdAt");
CREATE INDEX "client_activities_associationId_createdAt_idx" ON "client_activities"("associationId", "createdAt");
CREATE INDEX "client_activities_type_createdAt_idx" ON "client_activities"("type", "createdAt");
CREATE INDEX "client_tasks_clientAccountId_status_idx" ON "client_tasks"("clientAccountId", "status");
CREATE INDEX "client_tasks_associationId_status_idx" ON "client_tasks"("associationId", "status");
CREATE INDEX "client_tasks_assignedToId_dueAt_idx" ON "client_tasks"("assignedToId", "dueAt");
CREATE INDEX "client_tasks_status_dueAt_idx" ON "client_tasks"("status", "dueAt");
CREATE INDEX "client_account_notes_clientAccountId_isPinned_createdAt_idx" ON "client_account_notes"("clientAccountId", "isPinned", "createdAt");
CREATE INDEX "client_account_notes_associationId_createdAt_idx" ON "client_account_notes"("associationId", "createdAt");
CREATE INDEX "client_follow_ups_clientAccountId_status_dueAt_idx" ON "client_follow_ups"("clientAccountId", "status", "dueAt");
CREATE INDEX "client_follow_ups_associationId_status_dueAt_idx" ON "client_follow_ups"("associationId", "status", "dueAt");
CREATE INDEX "client_follow_ups_assignedToId_status_dueAt_idx" ON "client_follow_ups"("assignedToId", "status", "dueAt");

ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_account_notes" ADD CONSTRAINT "client_account_notes_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_follow_ups" ADD CONSTRAINT "client_follow_ups_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
