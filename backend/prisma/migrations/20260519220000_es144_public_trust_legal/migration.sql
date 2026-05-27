CREATE TYPE "LegalDocumentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_USE', 'COOKIE_POLICY', 'DATA_PROCESSING', 'SECURITY', 'TRUST_CENTER', 'CONTACT_POLICY', 'OTHER');
CREATE TYPE "LegalDocumentAudience" AS ENUM ('PUBLIC', 'ADMIN', 'RESIDENT', 'SUPERADMIN', 'ALL');
CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "LegalContactRequestType" AS ENUM ('PRIVACY', 'DATA_ACCESS', 'DATA_CORRECTION', 'DATA_DELETION', 'SECURITY', 'TERMS', 'GENERAL');
CREATE TYPE "LegalContactRequestStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'SPAM');

CREATE TABLE "legal_documents" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "LegalDocumentType" NOT NULL,
  "audience" "LegalDocumentAudience" NOT NULL DEFAULT 'PUBLIC',
  "status" "LegalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "locale" TEXT NOT NULL DEFAULT 'ro',
  "body" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_contact_requests" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "requestType" "LegalContactRequestType" NOT NULL DEFAULT 'GENERAL',
  "status" "LegalContactRequestStatus" NOT NULL DEFAULT 'NEW',
  "source" TEXT NOT NULL DEFAULT 'PUBLIC_LEGAL',
  "userId" TEXT,
  "associationId" TEXT,
  "handledById" TEXT,
  "handledAt" TIMESTAMP(3),
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_contact_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legal_documents_slug_locale_version_key" ON "legal_documents"("slug", "locale", "version");
CREATE INDEX "legal_documents_type_audience_locale_isActive_idx" ON "legal_documents"("type", "audience", "locale", "isActive");
CREATE INDEX "legal_documents_status_locale_updatedAt_idx" ON "legal_documents"("status", "locale", "updatedAt");
CREATE INDEX "legal_contact_requests_status_createdAt_idx" ON "legal_contact_requests"("status", "createdAt");
CREATE INDEX "legal_contact_requests_requestType_createdAt_idx" ON "legal_contact_requests"("requestType", "createdAt");
CREATE INDEX "legal_contact_requests_email_createdAt_idx" ON "legal_contact_requests"("email", "createdAt");
CREATE INDEX "legal_contact_requests_associationId_createdAt_idx" ON "legal_contact_requests"("associationId", "createdAt");

ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_contact_requests" ADD CONSTRAINT "legal_contact_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_contact_requests" ADD CONSTRAINT "legal_contact_requests_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_contact_requests" ADD CONSTRAINT "legal_contact_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
