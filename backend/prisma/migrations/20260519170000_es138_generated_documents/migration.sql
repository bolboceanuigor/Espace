-- ES-138 PDF/print document generation metadata.
CREATE TYPE "GeneratedDocumentType" AS ENUM (
  'INTERNAL_INVOICE',
  'PAYMENT_RECEIPT',
  'SAAS_INVOICE',
  'SAAS_PAYMENT_RECEIPT',
  'FINANCIAL_REPORT',
  'METER_CONSUMPTION_REPORT'
);

CREATE TYPE "GeneratedDocumentStatus" AS ENUM (
  'GENERATED',
  'FAILED',
  'SKIPPED',
  'PREVIEW_ONLY'
);

CREATE TABLE "generated_documents" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "generatedById" TEXT,
  "documentType" "GeneratedDocumentType" NOT NULL,
  "status" "GeneratedDocumentStatus" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER,
  "storagePath" TEXT,
  "publicUrl" TEXT,
  "checksum" TEXT,
  "metadata" JSONB,
  "errorMessage" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "generated_documents_associationId_documentType_generatedAt_idx" ON "generated_documents"("associationId", "documentType", "generatedAt");
CREATE INDEX "generated_documents_entityType_entityId_idx" ON "generated_documents"("entityType", "entityId");
CREATE INDEX "generated_documents_generatedById_generatedAt_idx" ON "generated_documents"("generatedById", "generatedAt");

ALTER TABLE "generated_documents"
  ADD CONSTRAINT "generated_documents_associationId_fkey"
  FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_documents"
  ADD CONSTRAINT "generated_documents_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
