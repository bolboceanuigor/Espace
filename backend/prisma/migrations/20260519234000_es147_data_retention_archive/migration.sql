CREATE TYPE "DataRetentionEntityType" AS ENUM ('ASSOCIATION', 'APARTMENT', 'RESIDENT', 'APARTMENT_RESIDENT', 'TARIFF', 'METER', 'METER_READING', 'BILLING_RUN', 'INVOICE_DRAFT', 'INTERNAL_INVOICE', 'INTERNAL_INVOICE_LINE', 'PAYMENT', 'ANNOUNCEMENT', 'REQUEST', 'NOTIFICATION', 'IMPORT_JOB', 'EXPORT_LOG', 'AUDIT_LOG', 'DATA_QUALITY_ISSUE', 'DUPLICATE_GROUP', 'STAFF_MEMBERSHIP', 'STAFF_INVITATION', 'RESIDENT_INVITATION', 'SUPPORT_SESSION', 'AUTH_SECURITY_EVENT', 'SAAS_PLAN', 'SAAS_SUBSCRIPTION', 'SAAS_INVOICE', 'CUSTOMER_ONBOARDING_REQUEST', 'LEGAL_DOCUMENT', 'HELP_ARTICLE', 'SYSTEM_ERROR_EVENT', 'PLATFORM_SERVICE', 'BACKUP_CHECK', 'PRODUCTION_INCIDENT');
CREATE TYPE "DataRetentionAction" AS ENUM ('KEEP_FOREVER', 'ARCHIVE_ALLOWED', 'RESTORE_ALLOWED', 'SOFT_DELETE_ALLOWED', 'HARD_DELETE_FORBIDDEN', 'ANONYMIZATION_REQUIRES_APPROVAL', 'DELETE_REQUIRES_SUPERADMIN_APPROVAL', 'LEGAL_HOLD_SUPPORTED');
CREATE TYPE "ArchiveStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'RESTORED', 'LOCKED', 'RETENTION_PROTECTED');
CREATE TYPE "RetentionEventAction" AS ENUM ('POLICY_CREATED', 'POLICY_UPDATED', 'ENTITY_ARCHIVED', 'ENTITY_RESTORED', 'ARCHIVE_BLOCKED', 'DELETE_BLOCKED', 'LEGAL_HOLD_APPLIED', 'LEGAL_HOLD_REMOVED', 'ANONYMIZATION_REQUESTED', 'DELETION_REQUESTED', 'DELETION_REQUEST_REJECTED');
CREATE TYPE "LegalHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');
CREATE TYPE "DataDeletionRequestType" AS ENUM ('DELETE', 'ANONYMIZE', 'EXPORT', 'CORRECT');
CREATE TYPE "DataDeletionRequestStatus" AS ENUM ('NEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "data_retention_policies" (
  "id" TEXT NOT NULL,
  "entityType" "DataRetentionEntityType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "retentionAction" "DataRetentionAction" NOT NULL,
  "defaultRetentionDays" INTEGER,
  "archiveAllowed" BOOLEAN NOT NULL DEFAULT false,
  "restoreAllowed" BOOLEAN NOT NULL DEFAULT false,
  "hardDeleteAllowed" BOOLEAN NOT NULL DEFAULT false,
  "anonymizationAllowed" BOOLEAN NOT NULL DEFAULT false,
  "requiresSuperadminApproval" BOOLEAN NOT NULL DEFAULT false,
  "legalHoldSupported" BOOLEAN NOT NULL DEFAULT false,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "archive_records" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "entityType" "DataRetentionEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityDisplayName" TEXT,
  "status" "ArchiveStatus" NOT NULL DEFAULT 'ARCHIVED',
  "archiveReason" TEXT NOT NULL,
  "archivedById" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restoredById" TEXT,
  "restoredAt" TIMESTAMP(3),
  "restoreReason" TEXT,
  "metadata" JSONB,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "archive_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retention_events" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "entityType" "DataRetentionEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" "RetentionEventAction" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actorUserId" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retention_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_holds" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "entityType" "DataRetentionEntityType",
  "entityId" TEXT,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "LegalHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "appliedById" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedById" TEXT,
  "releasedAt" TIMESTAMP(3),
  "releaseReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_deletion_requests" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "requestedByUserId" TEXT,
  "targetUserId" TEXT,
  "targetResidentId" TEXT,
  "entityType" "DataRetentionEntityType",
  "entityId" TEXT,
  "requestType" "DataDeletionRequestType" NOT NULL,
  "status" "DataDeletionRequestStatus" NOT NULL DEFAULT 'NEW',
  "reason" TEXT NOT NULL,
  "decisionNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "apartments" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "apartments" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "apartments" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "apartments" ADD COLUMN "restoredAt" TIMESTAMP(3);
ALTER TABLE "apartments" ADD COLUMN "restoredById" TEXT;
ALTER TABLE "apartments" ADD COLUMN "restoreReason" TEXT;

ALTER TABLE "resident_profiles" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "resident_profiles" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "resident_profiles" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "resident_profiles" ADD COLUMN "restoredAt" TIMESTAMP(3);
ALTER TABLE "resident_profiles" ADD COLUMN "restoredById" TEXT;
ALTER TABLE "resident_profiles" ADD COLUMN "restoreReason" TEXT;

ALTER TABLE "meters" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "meters" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "meters" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "meters" ADD COLUMN "restoredAt" TIMESTAMP(3);
ALTER TABLE "meters" ADD COLUMN "restoredById" TEXT;
ALTER TABLE "meters" ADD COLUMN "restoreReason" TEXT;

ALTER TABLE "issues" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "issues" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "issues" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "issues" ADD COLUMN "restoredAt" TIMESTAMP(3);
ALTER TABLE "issues" ADD COLUMN "restoredById" TEXT;
ALTER TABLE "issues" ADD COLUMN "restoreReason" TEXT;

ALTER TABLE "announcements" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "announcements" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "announcements" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "announcements" ADD COLUMN "restoredAt" TIMESTAMP(3);
ALTER TABLE "announcements" ADD COLUMN "restoredById" TEXT;
ALTER TABLE "announcements" ADD COLUMN "restoreReason" TEXT;

CREATE UNIQUE INDEX "data_retention_policies_entityType_key" ON "data_retention_policies"("entityType");
CREATE INDEX "data_retention_policies_retentionAction_isActive_idx" ON "data_retention_policies"("retentionAction", "isActive");
CREATE INDEX "data_retention_policies_archiveAllowed_restoreAllowed_idx" ON "data_retention_policies"("archiveAllowed", "restoreAllowed");
CREATE INDEX "archive_records_associationId_archivedAt_idx" ON "archive_records"("associationId", "archivedAt");
CREATE INDEX "archive_records_entityType_entityId_idx" ON "archive_records"("entityType", "entityId");
CREATE INDEX "archive_records_status_archivedAt_idx" ON "archive_records"("status", "archivedAt");
CREATE INDEX "retention_events_associationId_createdAt_idx" ON "retention_events"("associationId", "createdAt");
CREATE INDEX "retention_events_entityType_entityId_idx" ON "retention_events"("entityType", "entityId");
CREATE INDEX "retention_events_action_createdAt_idx" ON "retention_events"("action", "createdAt");
CREATE INDEX "legal_holds_associationId_status_idx" ON "legal_holds"("associationId", "status");
CREATE INDEX "legal_holds_entityType_entityId_status_idx" ON "legal_holds"("entityType", "entityId", "status");
CREATE INDEX "data_deletion_requests_associationId_status_idx" ON "data_deletion_requests"("associationId", "status");
CREATE INDEX "data_deletion_requests_entityType_entityId_idx" ON "data_deletion_requests"("entityType", "entityId");
CREATE INDEX "data_deletion_requests_requestType_status_idx" ON "data_deletion_requests"("requestType", "status");
CREATE INDEX "apartments_archivedAt_idx" ON "apartments"("archivedAt");
CREATE INDEX "resident_profiles_archivedAt_idx" ON "resident_profiles"("archivedAt");
CREATE INDEX "meters_archivedAt_idx" ON "meters"("archivedAt");
CREATE INDEX "issues_archivedAt_idx" ON "issues"("archivedAt");
CREATE INDEX "announcements_archivedAt_idx" ON "announcements"("archivedAt");

ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "archive_records" ADD CONSTRAINT "archive_records_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "archive_records" ADD CONSTRAINT "archive_records_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "archive_records" ADD CONSTRAINT "archive_records_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retention_events" ADD CONSTRAINT "retention_events_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retention_events" ADD CONSTRAINT "retention_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_targetResidentId_fkey" FOREIGN KEY ("targetResidentId") REFERENCES "resident_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meters" ADD CONSTRAINT "meters_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meters" ADD CONSTRAINT "meters_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
