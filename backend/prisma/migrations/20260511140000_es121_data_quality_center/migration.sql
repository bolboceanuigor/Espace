-- ES-121: Persistent data quality runs and issues for admin checks.

DO $$ BEGIN
  CREATE TYPE "DataQualityRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataQualityCategory" AS ENUM ('ASSOCIATION', 'APARTMENTS', 'RESIDENTS', 'TARIFFS', 'METERS', 'METER_READINGS', 'BILLING', 'INVOICES_PAYMENTS', 'IMPORTS', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataQualitySeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataQualityIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataQualityEntityType" AS ENUM ('ASSOCIATION', 'APARTMENT', 'RESIDENT', 'APARTMENT_RESIDENT', 'TARIFF', 'METER', 'METER_READING', 'BILLING_RUN', 'INVOICE_DRAFT', 'INTERNAL_INVOICE', 'PAYMENT', 'IMPORT_JOB', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataQualityBillingImpact" AS ENUM ('BLOCKS_BILLING', 'AFFECTS_BILLING', 'NO_BILLING_IMPACT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "data_quality_runs" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "billingMonth" TEXT,
  "status" "DataQualityRunStatus" NOT NULL DEFAULT 'RUNNING',
  "score" INTEGER NOT NULL DEFAULT 100,
  "criticalCount" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "infoCount" INTEGER NOT NULL DEFAULT 0,
  "resolvedCount" INTEGER NOT NULL DEFAULT 0,
  "ignoredCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "data_quality_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "data_quality_issues" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "runId" TEXT,
  "key" TEXT NOT NULL,
  "category" "DataQualityCategory" NOT NULL,
  "severity" "DataQualitySeverity" NOT NULL,
  "status" "DataQualityIssueStatus" NOT NULL DEFAULT 'OPEN',
  "entityType" "DataQualityEntityType" NOT NULL,
  "entityId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "actionUrl" TEXT,
  "billingImpact" "DataQualityBillingImpact" NOT NULL DEFAULT 'NO_BILLING_IMPACT',
  "metadata" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "ignoredAt" TIMESTAMP(3),
  "ignoredById" TEXT,
  "ignoreReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "data_quality_issues_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "data_quality_runs" ADD CONSTRAINT "data_quality_runs_associationId_fkey"
    FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "data_quality_runs" ADD CONSTRAINT "data_quality_runs_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_associationId_fkey"
    FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "data_quality_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_ignoredById_fkey"
    FOREIGN KEY ("ignoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "data_quality_issues_associationId_key_key"
  ON "data_quality_issues"("associationId", "key");
CREATE INDEX IF NOT EXISTS "data_quality_runs_associationId_createdAt_idx"
  ON "data_quality_runs"("associationId", "createdAt");
CREATE INDEX IF NOT EXISTS "data_quality_runs_associationId_status_createdAt_idx"
  ON "data_quality_runs"("associationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "data_quality_issues_associationId_status_severity_detectedAt_idx"
  ON "data_quality_issues"("associationId", "status", "severity", "detectedAt");
CREATE INDEX IF NOT EXISTS "data_quality_issues_associationId_category_status_idx"
  ON "data_quality_issues"("associationId", "category", "status");
CREATE INDEX IF NOT EXISTS "data_quality_issues_runId_idx"
  ON "data_quality_issues"("runId");
CREATE INDEX IF NOT EXISTS "data_quality_issues_entityType_entityId_idx"
  ON "data_quality_issues"("entityType", "entityId");
