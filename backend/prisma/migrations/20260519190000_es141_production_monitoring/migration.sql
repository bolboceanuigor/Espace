-- ES-141 production monitoring and error tracking.
ALTER TYPE "SystemErrorSource" ADD VALUE IF NOT EXISTS 'DATABASE';
ALTER TYPE "SystemErrorSource" ADD VALUE IF NOT EXISTS 'PRISMA';
ALTER TYPE "SystemErrorSource" ADD VALUE IF NOT EXISTS 'AUTH';
ALTER TYPE "SystemErrorSource" ADD VALUE IF NOT EXISTS 'PAYMENTS';
ALTER TYPE "SystemErrorSource" ADD VALUE IF NOT EXISTS 'NOTIFICATIONS';
ALTER TYPE "SystemErrorSource" ADD VALUE IF NOT EXISTS 'SYSTEM';

CREATE TYPE "SystemHealthStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'DOWN', 'UNKNOWN');
CREATE TYPE "SystemServiceKey" AS ENUM ('BACKEND_API', 'FRONTEND_APP', 'DATABASE', 'PRISMA', 'AUTH', 'NOTIFICATIONS', 'PAYMENTS', 'FILE_STORAGE', 'JOBS', 'EXTERNAL_PROVIDERS');
CREATE TYPE "DeploymentProvider" AS ENUM ('VERCEL', 'RENDER', 'GITHUB', 'MANUAL', 'UNKNOWN');
CREATE TYPE "DeploymentStatus" AS ENUM ('QUEUED', 'BUILDING', 'READY', 'FAILED', 'CANCELLED', 'UNKNOWN');

CREATE TABLE "system_error_events" (
  "id" TEXT NOT NULL,
  "source" "SystemErrorSource" NOT NULL,
  "severity" "SystemErrorLevel" NOT NULL,
  "message" TEXT NOT NULL,
  "stack" TEXT,
  "code" TEXT,
  "route" TEXT,
  "method" TEXT,
  "statusCode" INTEGER,
  "userId" TEXT,
  "associationId" TEXT,
  "requestId" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "metadata" JSONB,
  "fingerprint" TEXT,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_error_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_health_snapshots" (
  "id" TEXT NOT NULL,
  "status" "SystemHealthStatus" NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "services" JSONB NOT NULL,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deployment_records" (
  "id" TEXT NOT NULL,
  "provider" "DeploymentProvider" NOT NULL DEFAULT 'UNKNOWN',
  "environment" TEXT,
  "branch" TEXT,
  "commitSha" TEXT,
  "commitMessage" TEXT,
  "status" "DeploymentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "deployedAt" TIMESTAMP(3),
  "buildStartedAt" TIMESTAMP(3),
  "buildFinishedAt" TIMESTAMP(3),
  "url" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deployment_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_error_events_source_severity_lastSeenAt_idx" ON "system_error_events"("source", "severity", "lastSeenAt");
CREATE INDEX "system_error_events_associationId_lastSeenAt_idx" ON "system_error_events"("associationId", "lastSeenAt");
CREATE INDEX "system_error_events_userId_lastSeenAt_idx" ON "system_error_events"("userId", "lastSeenAt");
CREATE INDEX "system_error_events_requestId_idx" ON "system_error_events"("requestId");
CREATE INDEX "system_error_events_fingerprint_resolvedAt_idx" ON "system_error_events"("fingerprint", "resolvedAt");
CREATE INDEX "system_error_events_resolvedAt_lastSeenAt_idx" ON "system_error_events"("resolvedAt", "lastSeenAt");
CREATE INDEX "system_health_snapshots_status_checkedAt_idx" ON "system_health_snapshots"("status", "checkedAt");
CREATE INDEX "deployment_records_provider_environment_deployedAt_idx" ON "deployment_records"("provider", "environment", "deployedAt");
CREATE INDEX "deployment_records_status_deployedAt_idx" ON "deployment_records"("status", "deployedAt");

ALTER TABLE "system_error_events" ADD CONSTRAINT "system_error_events_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_error_events" ADD CONSTRAINT "system_error_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_error_events" ADD CONSTRAINT "system_error_events_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
