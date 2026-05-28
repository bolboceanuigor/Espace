CREATE TYPE "CustomerSuccessPlaybookStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "CustomerSuccessPlaybookCategory" AS ENUM ('ONBOARDING', 'ACTIVATION', 'BILLING', 'SUBSCRIPTION', 'DATA_QUALITY', 'PRODUCT_USAGE', 'SUPPORT', 'SECURITY', 'MONITORING', 'RETENTION', 'TRAINING', 'RENEWAL', 'RECOVERY', 'OTHER');
CREATE TYPE "CustomerSuccessTriggerType" AS ENUM ('MANUAL', 'HEALTH_STATUS', 'RISK_REASON', 'LIFECYCLE_STAGE', 'SUBSCRIPTION_STATUS', 'SAAS_INVOICE_STATUS', 'DATA_QUALITY_SEVERITY', 'SUPPORT_ISSUE', 'FOLLOW_UP_OVERDUE', 'TASK_OVERDUE', 'PLATFORM_INCIDENT', 'NO_RECENT_ACTIVITY');
CREATE TYPE "ClientInterventionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'WAITING_INTERNAL', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE "ClientInterventionOutcome" AS ENUM ('NOT_SET', 'RESOLVED', 'PARTIALLY_RESOLVED', 'CLIENT_CONTACTED', 'TASKS_CREATED', 'ESCALATED', 'NO_RESPONSE', 'NOT_RELEVANT', 'LOST_CLIENT', 'FOLLOW_UP_REQUIRED');
CREATE TYPE "PlaybookStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'BLOCKED');
CREATE TYPE "PlaybookStepType" AS ENUM ('CHECK', 'CONTACT_CLIENT', 'CREATE_TASK', 'CREATE_FOLLOW_UP', 'ADD_NOTE', 'REVIEW_DATA', 'REVIEW_SUBSCRIPTION', 'REVIEW_SAAS_INVOICE', 'REVIEW_DATA_QUALITY', 'REVIEW_SUPPORT_SESSION', 'START_SUPPORT_SESSION', 'SEND_MESSAGE_MANUAL', 'SEND_NOTIFICATION_CONFIRM', 'UPDATE_CLIENT_STAGE', 'UPDATE_CLIENT_RISK', 'ESCALATE_INTERNAL', 'COMPLETE_INTERVENTION');
CREATE TYPE "ClientInterventionEventType" AS ENUM ('INTERVENTION_STARTED', 'INTERVENTION_STATUS_CHANGED', 'INTERVENTION_ASSIGNED', 'STEP_STARTED', 'STEP_COMPLETED', 'STEP_SKIPPED', 'STEP_BLOCKED', 'TASK_CREATED', 'FOLLOW_UP_CREATED', 'NOTE_ADDED', 'CLIENT_CONTACT_RECORDED', 'NOTIFICATION_SENT', 'NOTIFICATION_SKIPPED', 'INTERVENTION_COMPLETED', 'INTERVENTION_CANCELLED', 'OUTCOME_SET');

CREATE TABLE "customer_success_playbooks" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "CustomerSuccessPlaybookCategory" NOT NULL,
  "status" "CustomerSuccessPlaybookStatus" NOT NULL DEFAULT 'DRAFT',
  "triggerType" "CustomerSuccessTriggerType" NOT NULL DEFAULT 'MANUAL',
  "triggerConfig" JSONB,
  "recommendedFor" JSONB,
  "defaultPriority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "estimatedDurationMinutes" INTEGER,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_success_playbooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_success_playbook_steps" (
  "id" TEXT NOT NULL,
  "playbookId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "stepType" "PlaybookStepType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "actionConfig" JSONB,
  "expectedOutcome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_success_playbook_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_interventions" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "playbookId" TEXT NOT NULL,
  "status" "ClientInterventionStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "outcome" "ClientInterventionOutcome" NOT NULL DEFAULT 'NOT_SET',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "triggerType" "CustomerSuccessTriggerType" NOT NULL DEFAULT 'MANUAL',
  "triggerReason" TEXT,
  "triggerMetadata" JSONB,
  "healthSnapshotId" TEXT,
  "assignedToId" TEXT,
  "startedById" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "outcomeNotes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_interventions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_intervention_steps" (
  "id" TEXT NOT NULL,
  "interventionId" TEXT NOT NULL,
  "playbookStepId" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "stepType" "PlaybookStepType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "PlaybookStepStatus" NOT NULL DEFAULT 'PENDING',
  "actionConfig" JSONB,
  "result" JSONB,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "skippedAt" TIMESTAMP(3),
  "skippedById" TEXT,
  "skipReason" TEXT,
  "blockedReason" TEXT,
  "relatedTaskId" TEXT,
  "relatedFollowUpId" TEXT,
  "relatedNoteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_intervention_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_intervention_events" (
  "id" TEXT NOT NULL,
  "interventionId" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "ClientInterventionEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_intervention_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_success_playbooks_key_key" ON "customer_success_playbooks"("key");
CREATE INDEX "customer_success_playbooks_category_status_idx" ON "customer_success_playbooks"("category", "status");
CREATE INDEX "customer_success_playbooks_triggerType_status_idx" ON "customer_success_playbooks"("triggerType", "status");
CREATE INDEX "customer_success_playbooks_isSystem_status_idx" ON "customer_success_playbooks"("isSystem", "status");
CREATE INDEX "customer_success_playbook_steps_playbookId_sortOrder_idx" ON "customer_success_playbook_steps"("playbookId", "sortOrder");
CREATE INDEX "client_interventions_clientAccountId_status_priority_idx" ON "client_interventions"("clientAccountId", "status", "priority");
CREATE INDEX "client_interventions_associationId_status_idx" ON "client_interventions"("associationId", "status");
CREATE INDEX "client_interventions_playbookId_status_idx" ON "client_interventions"("playbookId", "status");
CREATE INDEX "client_interventions_assignedToId_status_dueAt_idx" ON "client_interventions"("assignedToId", "status", "dueAt");
CREATE INDEX "client_interventions_triggerReason_status_idx" ON "client_interventions"("triggerReason", "status");
CREATE INDEX "client_intervention_steps_interventionId_sortOrder_idx" ON "client_intervention_steps"("interventionId", "sortOrder");
CREATE INDEX "client_intervention_steps_status_updatedAt_idx" ON "client_intervention_steps"("status", "updatedAt");
CREATE INDEX "client_intervention_steps_relatedTaskId_idx" ON "client_intervention_steps"("relatedTaskId");
CREATE INDEX "client_intervention_steps_relatedFollowUpId_idx" ON "client_intervention_steps"("relatedFollowUpId");
CREATE INDEX "client_intervention_steps_relatedNoteId_idx" ON "client_intervention_steps"("relatedNoteId");
CREATE INDEX "client_intervention_events_interventionId_createdAt_idx" ON "client_intervention_events"("interventionId", "createdAt");
CREATE INDEX "client_intervention_events_clientAccountId_createdAt_idx" ON "client_intervention_events"("clientAccountId", "createdAt");
CREATE INDEX "client_intervention_events_eventType_createdAt_idx" ON "client_intervention_events"("eventType", "createdAt");

ALTER TABLE "customer_success_playbook_steps" ADD CONSTRAINT "customer_success_playbook_steps_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "customer_success_playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_interventions" ADD CONSTRAINT "client_interventions_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_interventions" ADD CONSTRAINT "client_interventions_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "customer_success_playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_intervention_steps" ADD CONSTRAINT "client_intervention_steps_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "client_interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_intervention_steps" ADD CONSTRAINT "client_intervention_steps_playbookStepId_fkey" FOREIGN KEY ("playbookStepId") REFERENCES "customer_success_playbook_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_intervention_events" ADD CONSTRAINT "client_intervention_events_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "client_interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_intervention_events" ADD CONSTRAINT "client_intervention_events_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
