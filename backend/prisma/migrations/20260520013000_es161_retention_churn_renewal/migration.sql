CREATE TYPE "ClientChurnRiskStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RETENTION_IN_PROGRESS', 'WAITING_CLIENT', 'SAVED', 'LOST', 'DISMISSED', 'CLOSED');

CREATE TYPE "ClientChurnRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "ClientChurnReason" AS ENUM ('LOW_USAGE', 'ONBOARDING_STUCK', 'TRIAL_EXPIRING', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_SUSPENDED', 'PAYMENT_ISSUES', 'SAAS_INVOICE_OVERDUE', 'PRICE_CONCERN', 'MISSING_FEATURE', 'DATA_QUALITY_PROBLEMS', 'SUPPORT_ISSUES', 'TECHNICAL_ERRORS', 'NO_FOLLOW_UP', 'DECISION_DELAY', 'SWITCHING_TO_OTHER_TOOL', 'MANUAL', 'OTHER');

CREATE TYPE "ChurnRiskDetectedBy" AS ENUM ('SYSTEM', 'MANUAL');

CREATE TYPE "ChurnRiskSource" AS ENUM ('HEALTH_SCORE', 'REVENUE_COLLECTIONS', 'RENEWAL', 'CUSTOMER_SUCCESS', 'SUPPORT', 'MONITORING', 'MANUAL');

CREATE TYPE "ClientRenewalStatus" AS ENUM ('NOT_STARTED', 'UPCOMING', 'IN_PROGRESS', 'WAITING_CLIENT', 'RENEWED', 'NOT_RENEWED', 'CANCELLED', 'CLOSED');

CREATE TYPE "ClientRenewalOutcome" AS ENUM ('NOT_SET', 'RENEWED_SAME_PLAN', 'RENEWED_UPGRADED', 'RENEWED_DOWNGRADED', 'EXTENDED_TRIAL', 'PAUSED', 'CANCELLED_BY_CLIENT', 'LOST_TO_COMPETITOR', 'NO_RESPONSE', 'OTHER');

CREATE TYPE "ClientRetentionPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED');

CREATE TYPE "ClientRetentionPlanOutcome" AS ENUM ('NOT_SET', 'SAVED', 'PARTIALLY_SAVED', 'LOST', 'NO_RESPONSE', 'NOT_RELEVANT');

CREATE TYPE "ClientRetentionActionType" AS ENUM ('CALL_CLIENT', 'MESSAGE_CLIENT', 'REVIEW_USAGE', 'REVIEW_HEALTH', 'REVIEW_BILLING', 'REVIEW_SUPPORT_ISSUES', 'REVIEW_DATA_QUALITY', 'OFFER_TRAINING', 'OFFER_ONBOARDING_HELP', 'DISCUSS_PLAN_CHANGE', 'DISCUSS_PAYMENT', 'CREATE_FOLLOW_UP', 'CREATE_TASK', 'START_PLAYBOOK', 'ADD_NOTE', 'MARK_SAVED', 'MARK_LOST');

CREATE TYPE "ClientRetentionActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');

CREATE TYPE "ClientRetentionEventType" AS ENUM ('CHURN_RISK_DETECTED', 'CHURN_RISK_STATUS_CHANGED', 'CHURN_RISK_ASSIGNED', 'CHURN_RISK_SAVED', 'CHURN_RISK_LOST', 'RENEWAL_CREATED', 'RENEWAL_STATUS_CHANGED', 'RENEWAL_COMPLETED', 'RETENTION_PLAN_CREATED', 'RETENTION_PLAN_COMPLETED', 'RETENTION_PLAN_CANCELLED', 'RETENTION_ACTION_COMPLETED', 'RETENTION_NOTE_ADDED', 'RETENTION_TASK_CREATED', 'RETENTION_FOLLOW_UP_CREATED', 'CLIENT_CONTACT_RECORDED', 'OUTCOME_SET');

CREATE TABLE "client_churn_risks" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "status" "ClientChurnRiskStatus" NOT NULL DEFAULT 'NEW',
  "severity" "ClientChurnRiskSeverity" NOT NULL DEFAULT 'MEDIUM',
  "reason" "ClientChurnReason" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "score" INTEGER,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "detectedBy" "ChurnRiskDetectedBy" NOT NULL DEFAULT 'SYSTEM',
  "source" "ChurnRiskSource" NOT NULL DEFAULT 'MANUAL',
  "sourceEntityType" TEXT,
  "sourceEntityId" TEXT,
  "assignedToId" TEXT,
  "nextFollowUpAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "savedAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closeReason" TEXT,
  "outcomeNotes" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_churn_risks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_renewals" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "subscriptionId" TEXT,
  "currentPlanId" TEXT,
  "proposedPlanId" TEXT,
  "status" "ClientRenewalStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "outcome" "ClientRenewalOutcome" NOT NULL DEFAULT 'NOT_SET',
  "renewalDate" TIMESTAMP(3) NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "currentMonthlyValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "proposedMonthlyValue" DOUBLE PRECISION,
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "assignedToId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "cancellationReason" TEXT,
  "outcomeNotes" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_renewals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_retention_plans" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "churnRiskId" TEXT,
  "renewalId" TEXT,
  "status" "ClientRetentionPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "goal" TEXT NOT NULL,
  "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "ownerUserId" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "outcome" "ClientRetentionPlanOutcome" NOT NULL DEFAULT 'NOT_SET',
  "outcomeNotes" TEXT,
  "metadata" JSONB,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_retention_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_retention_actions" (
  "id" TEXT NOT NULL,
  "retentionPlanId" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "actionType" "ClientRetentionActionType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ClientRetentionActionStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ClientPriority" NOT NULL DEFAULT 'NORMAL',
  "dueAt" TIMESTAMP(3),
  "assignedToId" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "resultNote" TEXT,
  "relatedTaskId" TEXT,
  "relatedFollowUpId" TEXT,
  "relatedInterventionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_retention_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_retention_events" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "churnRiskId" TEXT,
  "renewalId" TEXT,
  "retentionPlanId" TEXT,
  "actorUserId" TEXT,
  "eventType" "ClientRetentionEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_retention_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_churn_risks_clientAccountId_status_idx" ON "client_churn_risks"("clientAccountId", "status");
CREATE INDEX "client_churn_risks_associationId_status_idx" ON "client_churn_risks"("associationId", "status");
CREATE INDEX "client_churn_risks_status_severity_idx" ON "client_churn_risks"("status", "severity");
CREATE INDEX "client_churn_risks_reason_source_status_idx" ON "client_churn_risks"("reason", "source", "status");
CREATE INDEX "client_churn_risks_assignedToId_nextFollowUpAt_idx" ON "client_churn_risks"("assignedToId", "nextFollowUpAt");
CREATE INDEX "client_renewals_clientAccountId_status_idx" ON "client_renewals"("clientAccountId", "status");
CREATE INDEX "client_renewals_associationId_status_idx" ON "client_renewals"("associationId", "status");
CREATE INDEX "client_renewals_subscriptionId_renewalDate_idx" ON "client_renewals"("subscriptionId", "renewalDate");
CREATE INDEX "client_renewals_status_renewalDate_idx" ON "client_renewals"("status", "renewalDate");
CREATE INDEX "client_renewals_assignedToId_renewalDate_idx" ON "client_renewals"("assignedToId", "renewalDate");
CREATE INDEX "client_retention_plans_clientAccountId_status_idx" ON "client_retention_plans"("clientAccountId", "status");
CREATE INDEX "client_retention_plans_associationId_status_idx" ON "client_retention_plans"("associationId", "status");
CREATE INDEX "client_retention_plans_churnRiskId_idx" ON "client_retention_plans"("churnRiskId");
CREATE INDEX "client_retention_plans_renewalId_idx" ON "client_retention_plans"("renewalId");
CREATE INDEX "client_retention_plans_ownerUserId_dueAt_idx" ON "client_retention_plans"("ownerUserId", "dueAt");
CREATE INDEX "client_retention_plans_status_priority_idx" ON "client_retention_plans"("status", "priority");
CREATE INDEX "client_retention_actions_retentionPlanId_status_idx" ON "client_retention_actions"("retentionPlanId", "status");
CREATE INDEX "client_retention_actions_clientAccountId_status_idx" ON "client_retention_actions"("clientAccountId", "status");
CREATE INDEX "client_retention_actions_associationId_status_idx" ON "client_retention_actions"("associationId", "status");
CREATE INDEX "client_retention_actions_assignedToId_dueAt_idx" ON "client_retention_actions"("assignedToId", "dueAt");
CREATE INDEX "client_retention_actions_actionType_status_idx" ON "client_retention_actions"("actionType", "status");
CREATE INDEX "client_retention_events_clientAccountId_createdAt_idx" ON "client_retention_events"("clientAccountId", "createdAt");
CREATE INDEX "client_retention_events_associationId_createdAt_idx" ON "client_retention_events"("associationId", "createdAt");
CREATE INDEX "client_retention_events_churnRiskId_createdAt_idx" ON "client_retention_events"("churnRiskId", "createdAt");
CREATE INDEX "client_retention_events_renewalId_createdAt_idx" ON "client_retention_events"("renewalId", "createdAt");
CREATE INDEX "client_retention_events_retentionPlanId_createdAt_idx" ON "client_retention_events"("retentionPlanId", "createdAt");
CREATE INDEX "client_retention_events_eventType_createdAt_idx" ON "client_retention_events"("eventType", "createdAt");

ALTER TABLE "client_retention_plans" ADD CONSTRAINT "client_retention_plans_churnRiskId_fkey" FOREIGN KEY ("churnRiskId") REFERENCES "client_churn_risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_retention_plans" ADD CONSTRAINT "client_retention_plans_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "client_renewals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_retention_actions" ADD CONSTRAINT "client_retention_actions_retentionPlanId_fkey" FOREIGN KEY ("retentionPlanId") REFERENCES "client_retention_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_retention_events" ADD CONSTRAINT "client_retention_events_churnRiskId_fkey" FOREIGN KEY ("churnRiskId") REFERENCES "client_churn_risks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_retention_events" ADD CONSTRAINT "client_retention_events_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "client_renewals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_retention_events" ADD CONSTRAINT "client_retention_events_retentionPlanId_fkey" FOREIGN KEY ("retentionPlanId") REFERENCES "client_retention_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
