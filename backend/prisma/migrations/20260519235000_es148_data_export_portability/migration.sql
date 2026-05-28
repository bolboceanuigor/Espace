CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'PORTABILITY', 'CORRECTION', 'EXPORT', 'ANONYMIZATION', 'DELETION', 'RESTRICTION', 'OTHER');
CREATE TYPE "DataRequestStatus" AS ENUM ('NEW', 'IN_REVIEW', 'WAITING_FOR_INFO', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DataRequestScope" AS ENUM ('RESIDENT_PERSONAL_DATA', 'ASSOCIATION_DATA', 'APARTMENT_DATA', 'INVOICE_PAYMENT_DATA', 'METER_DATA', 'ACCOUNT_ACCESS_DATA', 'FULL_ASSOCIATION_EXPORT', 'FULL_RESIDENT_EXPORT', 'OTHER');
CREATE TYPE "DataExportType" AS ENUM ('ASSOCIATION_FULL_EXPORT', 'ASSOCIATION_FINANCIAL_EXPORT', 'ASSOCIATION_RESIDENTS_EXPORT', 'ASSOCIATION_APARTMENTS_EXPORT', 'ASSOCIATION_METERS_EXPORT', 'RESIDENT_PERSONAL_EXPORT', 'RESIDENT_FINANCIAL_EXPORT', 'RESIDENT_METER_EXPORT', 'AUDIT_EXPORT', 'CUSTOM_EXPORT');
CREATE TYPE "DataExportFormat" AS ENUM ('CSV', 'JSON', 'ZIP');
CREATE TYPE "DataExportStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "DataExportEventType" AS ENUM ('EXPORT_REQUESTED', 'EXPORT_STARTED', 'EXPORT_READY', 'EXPORT_FAILED', 'EXPORT_DOWNLOADED', 'EXPORT_CANCELLED', 'EXPORT_EXPIRED');

CREATE TABLE "data_requests" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "requesterUserId" TEXT,
  "requesterResidentId" TEXT,
  "requesterEmail" TEXT,
  "requesterPhone" TEXT,
  "type" "DataRequestType" NOT NULL,
  "scope" "DataRequestScope" NOT NULL,
  "status" "DataRequestStatus" NOT NULL DEFAULT 'NEW',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "reason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "relatedExportId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_export_jobs" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "requestedById" TEXT,
  "residentId" TEXT,
  "dataRequestId" TEXT,
  "exportType" "DataExportType" NOT NULL,
  "format" "DataExportFormat" NOT NULL,
  "status" "DataExportStatus" NOT NULL DEFAULT 'REQUESTED',
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER,
  "storagePath" TEXT,
  "downloadUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "filters" JSONB,
  "includedEntities" JSONB,
  "rowCounts" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_export_events" (
  "id" TEXT NOT NULL,
  "exportJobId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "DataExportEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "data_export_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_requests_associationId_status_createdAt_idx" ON "data_requests"("associationId", "status", "createdAt");
CREATE INDEX "data_requests_requesterUserId_createdAt_idx" ON "data_requests"("requesterUserId", "createdAt");
CREATE INDEX "data_requests_requesterResidentId_createdAt_idx" ON "data_requests"("requesterResidentId", "createdAt");
CREATE INDEX "data_requests_type_scope_status_idx" ON "data_requests"("type", "scope", "status");
CREATE INDEX "data_export_jobs_associationId_status_createdAt_idx" ON "data_export_jobs"("associationId", "status", "createdAt");
CREATE INDEX "data_export_jobs_requestedById_createdAt_idx" ON "data_export_jobs"("requestedById", "createdAt");
CREATE INDEX "data_export_jobs_residentId_createdAt_idx" ON "data_export_jobs"("residentId", "createdAt");
CREATE INDEX "data_export_jobs_dataRequestId_idx" ON "data_export_jobs"("dataRequestId");
CREATE INDEX "data_export_jobs_exportType_format_status_idx" ON "data_export_jobs"("exportType", "format", "status");
CREATE INDEX "data_export_events_exportJobId_createdAt_idx" ON "data_export_events"("exportJobId", "createdAt");
CREATE INDEX "data_export_events_eventType_createdAt_idx" ON "data_export_events"("eventType", "createdAt");

ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_requesterResidentId_fkey" FOREIGN KEY ("requesterResidentId") REFERENCES "resident_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_relatedExportId_fkey" FOREIGN KEY ("relatedExportId") REFERENCES "data_export_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_dataRequestId_fkey" FOREIGN KEY ("dataRequestId") REFERENCES "data_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_export_events" ADD CONSTRAINT "data_export_events_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "data_export_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_export_events" ADD CONSTRAINT "data_export_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
