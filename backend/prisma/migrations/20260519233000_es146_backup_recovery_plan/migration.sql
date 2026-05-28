CREATE TYPE "BackupReadinessStatus" AS ENUM ('NOT_CONFIGURED', 'NEEDS_ATTENTION', 'PARTIALLY_READY', 'READY', 'VERIFIED');
CREATE TYPE "BackupCheckStatus" AS ENUM ('NOT_CHECKED', 'PASSED', 'WARNING', 'FAILED', 'NOT_APPLICABLE');
CREATE TYPE "RecoveryDrillStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'PASSED', 'PARTIAL', 'FAILED', 'CANCELLED');
CREATE TYPE "ProductionIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED');
CREATE TYPE "ProductionIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "BackupScope" AS ENUM ('DATABASE', 'FILE_STORAGE', 'ENVIRONMENT_CONFIG', 'SOURCE_CODE', 'DEPLOYMENT_CONFIG', 'LEGAL_DOCS', 'EXPORTS', 'FULL_PLATFORM');
CREATE TYPE "RecoveryRunbookStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "RecoveryScenario" AS ENUM ('DATABASE_DOWN', 'BACKEND_DOWN', 'FRONTEND_DOWN', 'FAILED_DEPLOY', 'FAILED_MIGRATION', 'ACCIDENTAL_DATA_CHANGE', 'EXTERNAL_PROVIDER_DOWN', 'DOMAIN_DNS_ISSUE', 'SECURITY_INCIDENT', 'PAYMENT_PROVIDER_ISSUE', 'NOTIFICATION_PROVIDER_ISSUE');

CREATE TABLE "backup_checklist_items" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "BackupCheckStatus" NOT NULL DEFAULT 'NOT_CHECKED',
  "severity" "LaunchChecklistSeverity" NOT NULL DEFAULT 'INFO',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "actionUrl" TEXT,
  "evidence" TEXT,
  "checkedAt" TIMESTAMP(3),
  "checkedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "backup_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "backup_checks" (
  "id" TEXT NOT NULL,
  "scope" "BackupScope" NOT NULL,
  "status" "BackupCheckStatus" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "providerName" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedById" TEXT,
  "backupLocation" TEXT,
  "backupReference" TEXT,
  "backupDate" TIMESTAMP(3),
  "restoreTested" BOOLEAN NOT NULL DEFAULT false,
  "restoreTestedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "backup_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recovery_drills" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "RecoveryDrillStatus" NOT NULL DEFAULT 'PLANNED',
  "scope" "BackupScope" NOT NULL,
  "scenario" "RecoveryScenario",
  "plannedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "performedById" TEXT,
  "durationMinutes" INTEGER,
  "resultSummary" TEXT,
  "issuesFound" JSONB,
  "actionsTaken" JSONB,
  "nextActions" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recovery_drills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recovery_runbooks" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "scenario" "RecoveryScenario" NOT NULL,
  "severity" "ProductionIncidentSeverity" NOT NULL,
  "steps" JSONB NOT NULL,
  "status" "RecoveryRunbookStatus" NOT NULL DEFAULT 'ACTIVE',
  "owner" TEXT,
  "lastReviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recovery_runbooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_incidents" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "ProductionIncidentSeverity" NOT NULL,
  "status" "ProductionIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "affectedServices" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "detectedAt" TIMESTAMP(3),
  "mitigatedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "openedById" TEXT,
  "assignedToId" TEXT,
  "rootCause" TEXT,
  "resolutionSummary" TEXT,
  "nextActions" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "production_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_incident_updates" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "status" "ProductionIncidentStatus",
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_incident_updates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "backup_checklist_items_key_key" ON "backup_checklist_items"("key");
CREATE INDEX "backup_checklist_items_category_status_idx" ON "backup_checklist_items"("category", "status");
CREATE INDEX "backup_checklist_items_severity_status_idx" ON "backup_checklist_items"("severity", "status");
CREATE INDEX "backup_checks_scope_status_idx" ON "backup_checks"("scope", "status");
CREATE INDEX "backup_checks_checkedAt_idx" ON "backup_checks"("checkedAt");
CREATE INDEX "backup_checks_backupDate_idx" ON "backup_checks"("backupDate");
CREATE INDEX "recovery_drills_scope_status_idx" ON "recovery_drills"("scope", "status");
CREATE INDEX "recovery_drills_scenario_status_idx" ON "recovery_drills"("scenario", "status");
CREATE INDEX "recovery_drills_plannedAt_idx" ON "recovery_drills"("plannedAt");
CREATE UNIQUE INDEX "recovery_runbooks_key_key" ON "recovery_runbooks"("key");
CREATE INDEX "recovery_runbooks_scenario_status_idx" ON "recovery_runbooks"("scenario", "status");
CREATE INDEX "recovery_runbooks_severity_status_idx" ON "recovery_runbooks"("severity", "status");
CREATE INDEX "production_incidents_severity_status_idx" ON "production_incidents"("severity", "status");
CREATE INDEX "production_incidents_startedAt_idx" ON "production_incidents"("startedAt");
CREATE INDEX "production_incident_updates_incidentId_createdAt_idx" ON "production_incident_updates"("incidentId", "createdAt");

ALTER TABLE "backup_checklist_items" ADD CONSTRAINT "backup_checklist_items_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "backup_checks" ADD CONSTRAINT "backup_checks_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recovery_drills" ADD CONSTRAINT "recovery_drills_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recovery_runbooks" ADD CONSTRAINT "recovery_runbooks_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_incidents" ADD CONSTRAINT "production_incidents_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_incidents" ADD CONSTRAINT "production_incidents_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_incident_updates" ADD CONSTRAINT "production_incident_updates_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "production_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_incident_updates" ADD CONSTRAINT "production_incident_updates_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
