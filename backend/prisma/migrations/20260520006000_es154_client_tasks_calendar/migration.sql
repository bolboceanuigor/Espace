CREATE TYPE "ClientTaskCategory" AS ENUM (
  'GENERAL',
  'CONTACT',
  'ONBOARDING',
  'DATA_IMPORT',
  'BILLING_SETUP',
  'SUBSCRIPTION',
  'SAAS_INVOICE',
  'SUPPORT',
  'SECURITY',
  'BACKUP',
  'LEGAL',
  'PLATFORM_SERVICE',
  'FOLLOW_UP'
);

CREATE TYPE "ClientTaskSource" AS ENUM (
  'MANUAL',
  'CLIENT_PIPELINE',
  'CUSTOMER_REQUEST',
  'ONBOARDING',
  'SUBSCRIPTION',
  'SAAS_INVOICE',
  'SUPPORT_SESSION',
  'SECURITY_CENTER',
  'MONITORING',
  'PLATFORM_SERVICE',
  'BACKUP',
  'SYSTEM'
);

CREATE TYPE "ClientFollowUpSource" AS ENUM (
  'MANUAL',
  'CLIENT_PIPELINE',
  'CUSTOMER_REQUEST',
  'SUBSCRIPTION',
  'SAAS_INVOICE',
  'ONBOARDING',
  'SUPPORT',
  'SYSTEM'
);

CREATE TYPE "ClientReminderStatus" AS ENUM (
  'SCHEDULED',
  'DUE',
  'SNOOZED',
  'COMPLETED',
  'DISMISSED',
  'CANCELLED'
);

CREATE TYPE "ClientReminderSource" AS ENUM (
  'MANUAL',
  'TASK',
  'FOLLOW_UP',
  'CLIENT_PIPELINE',
  'SAAS_INVOICE',
  'SUBSCRIPTION',
  'PLATFORM_SERVICE',
  'BACKUP',
  'MONITORING',
  'SYSTEM'
);

CREATE TYPE "ClientCalendarEventType" AS ENUM (
  'TASK_DUE',
  'FOLLOW_UP_DUE',
  'REMINDER',
  'CLIENT_STAGE_TARGET',
  'SUBSCRIPTION_RENEWAL',
  'SAAS_INVOICE_DUE',
  'PLATFORM_SERVICE_PAYMENT_DUE',
  'RECOVERY_DRILL_PLANNED',
  'PRODUCTION_INCIDENT_REVIEW',
  'MANUAL_EVENT'
);

ALTER TABLE "client_tasks"
  ADD COLUMN "category" "ClientTaskCategory" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "reminderAt" TIMESTAMP(3),
  ADD COLUMN "source" "ClientTaskSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "relatedEntityType" TEXT,
  ADD COLUMN "relatedEntityId" TEXT,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "client_follow_ups"
  ADD COLUMN "reminderAt" TIMESTAMP(3),
  ADD COLUMN "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "source" "ClientFollowUpSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "relatedEntityType" TEXT,
  ADD COLUMN "relatedEntityId" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE TABLE "client_reminders" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "associationId" TEXT,
  "taskId" TEXT,
  "followUpId" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "status" "ClientReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
  "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "remindAt" TIMESTAMP(3) NOT NULL,
  "snoozedUntil" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "dismissedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "assignedToId" TEXT,
  "createdById" TEXT,
  "source" "ClientReminderSource" NOT NULL DEFAULT 'MANUAL',
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "client_reminders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "client_reminders"
  ADD CONSTRAINT "client_reminders_clientAccountId_fkey"
  FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "client_tasks_category_status_idx" ON "client_tasks"("category", "status");
CREATE INDEX "client_tasks_source_dueAt_idx" ON "client_tasks"("source", "dueAt");
CREATE INDEX "client_tasks_reminderAt_idx" ON "client_tasks"("reminderAt");

CREATE INDEX "client_follow_ups_priority_status_idx" ON "client_follow_ups"("priority", "status");
CREATE INDEX "client_follow_ups_source_dueAt_idx" ON "client_follow_ups"("source", "dueAt");
CREATE INDEX "client_follow_ups_reminderAt_idx" ON "client_follow_ups"("reminderAt");

CREATE INDEX "client_reminders_clientAccountId_status_remindAt_idx" ON "client_reminders"("clientAccountId", "status", "remindAt");
CREATE INDEX "client_reminders_associationId_status_remindAt_idx" ON "client_reminders"("associationId", "status", "remindAt");
CREATE INDEX "client_reminders_assignedToId_status_remindAt_idx" ON "client_reminders"("assignedToId", "status", "remindAt");
CREATE INDEX "client_reminders_taskId_idx" ON "client_reminders"("taskId");
CREATE INDEX "client_reminders_followUpId_idx" ON "client_reminders"("followUpId");
CREATE INDEX "client_reminders_source_remindAt_idx" ON "client_reminders"("source", "remindAt");
