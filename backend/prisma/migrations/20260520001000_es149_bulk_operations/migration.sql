-- ES-149: Admin Bulk Operations & Safe Batch Actions

CREATE TYPE "BulkOperationStatus" AS ENUM (
  'DRAFT',
  'PREVIEWED',
  'CONFIRMED',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "BulkOperationItemStatus" AS ENUM (
  'PENDING',
  'VALID',
  'WARNING',
  'SKIPPED',
  'APPLIED',
  'FAILED'
);

CREATE TYPE "BulkEntityType" AS ENUM (
  'APARTMENT',
  'RESIDENT',
  'APARTMENT_RESIDENT',
  'METER',
  'METER_READING',
  'INTERNAL_INVOICE',
  'PAYMENT',
  'REQUEST',
  'ANNOUNCEMENT',
  'DATA_QUALITY_ISSUE',
  'IMPORT_JOB',
  'EXPORT_LOG'
);

CREATE TYPE "BulkOperationType" AS ENUM (
  'APARTMENTS_SET_STATUS',
  'APARTMENTS_SET_STAIRCASE',
  'APARTMENTS_SET_BUILDING',
  'APARTMENTS_ARCHIVE',
  'RESIDENTS_SET_STATUS',
  'RESIDENTS_SET_PREFERRED_CONTACT_METHOD',
  'RESIDENTS_ARCHIVE',
  'RESIDENTS_SEND_PORTAL_INVITATIONS',
  'METERS_SET_STATUS',
  'METERS_SET_UNIT_FROM_TYPE',
  'METERS_ARCHIVE',
  'METER_READINGS_MARK_NEEDS_REVIEW',
  'REQUESTS_SET_STATUS',
  'REQUESTS_ASSIGN_TO_STAFF',
  'REQUESTS_ARCHIVE_CLOSED',
  'ANNOUNCEMENTS_ARCHIVE',
  'ANNOUNCEMENTS_MARK_PINNED',
  'ANNOUNCEMENTS_MARK_UNPINNED',
  'INVOICES_EXPORT_SELECTED',
  'INVOICES_PRINT_SELECTED',
  'INVOICES_MARK_AS_SENT_INTERNAL',
  'PAYMENTS_EXPORT_SELECTED',
  'DATA_QUALITY_MARK_RESOLVED',
  'DATA_QUALITY_MARK_IGNORED',
  'IMPORTS_ARCHIVE_COMPLETED',
  'EXPORTS_ARCHIVE_OLD'
);

CREATE TABLE "bulk_operations" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "entityType" "BulkEntityType" NOT NULL,
  "operationType" "BulkOperationType" NOT NULL,
  "status" "BulkOperationStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "payload" JSONB,
  "filters" JSONB,
  "selectedIds" JSONB NOT NULL,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "validItems" INTEGER NOT NULL DEFAULT 0,
  "warningItems" INTEGER NOT NULL DEFAULT 0,
  "skippedItems" INTEGER NOT NULL DEFAULT 0,
  "appliedItems" INTEGER NOT NULL DEFAULT 0,
  "failedItems" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "confirmedById" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "resultSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bulk_operation_items" (
  "id" TEXT NOT NULL,
  "bulkOperationId" TEXT NOT NULL,
  "entityType" "BulkEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityDisplayName" TEXT,
  "status" "BulkOperationItemStatus" NOT NULL DEFAULT 'PENDING',
  "warnings" JSONB,
  "errors" JSONB,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "appliedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bulk_operation_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bulk_operations_associationId_status_createdAt_idx" ON "bulk_operations"("associationId", "status", "createdAt");
CREATE INDEX "bulk_operations_associationId_entityType_operationType_idx" ON "bulk_operations"("associationId", "entityType", "operationType");
CREATE INDEX "bulk_operations_createdById_createdAt_idx" ON "bulk_operations"("createdById", "createdAt");
CREATE INDEX "bulk_operation_items_bulkOperationId_status_idx" ON "bulk_operation_items"("bulkOperationId", "status");
CREATE INDEX "bulk_operation_items_entityType_entityId_idx" ON "bulk_operation_items"("entityType", "entityId");

ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bulk_operation_items" ADD CONSTRAINT "bulk_operation_items_bulkOperationId_fkey" FOREIGN KEY ("bulkOperationId") REFERENCES "bulk_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
