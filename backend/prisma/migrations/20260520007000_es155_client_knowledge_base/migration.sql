CREATE TYPE "ClientKnowledgeItemType" AS ENUM (
  'NOTE',
  'DECISION',
  'FILE',
  'LINK',
  'CONTACT',
  'KNOWN_ISSUE',
  'CHECKLIST',
  'ONBOARDING_CONTEXT',
  'SUPPORT_CONTEXT',
  'BILLING_CONTEXT',
  'SECURITY_CONTEXT',
  'LEGAL_CONTEXT',
  'TECHNICAL_CONTEXT'
);

CREATE TYPE "ClientKnowledgeCategory" AS ENUM (
  'GENERAL',
  'ONBOARDING',
  'SUPPORT',
  'BILLING',
  'SUBSCRIPTION',
  'TECHNICAL',
  'LEGAL',
  'SECURITY',
  'DATA_IMPORT',
  'PEOPLE',
  'DECISIONS',
  'RISKS',
  'INCIDENTS',
  'DOCUMENTS',
  'OTHER'
);

CREATE TYPE "ClientKnowledgeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ClientKnowledgeVisibility" AS ENUM ('INTERNAL_SUPERADMIN', 'INTERNAL_SUPPORT', 'INTERNAL_BILLING', 'INTERNAL_TECHNICAL');
CREATE TYPE "ClientKnowledgePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "ClientFileStorageProvider" AS ENUM ('NONE', 'LOCAL', 'SUPABASE', 'S3', 'EXTERNAL_LINK');
CREATE TYPE "ClientContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ClientDecisionImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ClientDecisionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'ARCHIVED');
CREATE TYPE "ClientKnownIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "ClientKnownIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ClientLinkStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ClientChecklistStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "client_knowledge_items" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "type" "ClientKnowledgeItemType" NOT NULL,
  "category" "ClientKnowledgeCategory" NOT NULL DEFAULT 'GENERAL',
  "status" "ClientKnowledgeStatus" NOT NULL DEFAULT 'ACTIVE',
  "visibility" "ClientKnowledgeVisibility" NOT NULL DEFAULT 'INTERNAL_SUPERADMIN',
  "priority" "ClientKnowledgePriority" NOT NULL DEFAULT 'NORMAL',
  "title" TEXT NOT NULL,
  "content" TEXT,
  "summary" TEXT,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "tags" JSONB,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "metadata" JSONB,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "archiveReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_knowledge_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_files" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "knowledgeItemId" TEXT,
  "fileName" TEXT NOT NULL,
  "originalFileName" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "storageProvider" "ClientFileStorageProvider" NOT NULL DEFAULT 'EXTERNAL_LINK',
  "storagePath" TEXT,
  "externalUrl" TEXT,
  "description" TEXT,
  "category" "ClientKnowledgeCategory" NOT NULL DEFAULT 'DOCUMENTS',
  "status" "ClientKnowledgeStatus" NOT NULL DEFAULT 'ACTIVE',
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "archiveReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_contacts" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "fullName" TEXT NOT NULL,
  "role" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "preferredContactMethod" TEXT,
  "notes" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "ClientContactStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_decisions" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "decisionDate" TIMESTAMP(3) NOT NULL,
  "decidedBy" TEXT,
  "impact" "ClientDecisionImpact" NOT NULL DEFAULT 'MEDIUM',
  "category" "ClientKnowledgeCategory" NOT NULL DEFAULT 'DECISIONS',
  "status" "ClientDecisionStatus" NOT NULL DEFAULT 'ACTIVE',
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_known_issues" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ClientKnownIssueStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "ClientKnownIssueSeverity" NOT NULL DEFAULT 'MEDIUM',
  "category" "ClientKnowledgeCategory" NOT NULL DEFAULT 'RISKS',
  "workaround" TEXT,
  "resolution" TEXT,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "assignedToId" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_known_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_links" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "description" TEXT,
  "category" "ClientKnowledgeCategory" NOT NULL DEFAULT 'GENERAL',
  "status" "ClientLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_checklists" (
  "id" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "associationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" "ClientKnowledgeCategory" NOT NULL DEFAULT 'ONBOARDING',
  "status" "ClientChecklistStatus" NOT NULL DEFAULT 'ACTIVE',
  "items" JSONB NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_checklists_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "client_knowledge_items" ADD CONSTRAINT "client_knowledge_items_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_decisions" ADD CONSTRAINT "client_decisions_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_known_issues" ADD CONSTRAINT "client_known_issues_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_links" ADD CONSTRAINT "client_links_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_checklists" ADD CONSTRAINT "client_checklists_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "client_knowledge_items_clientAccountId_type_status_idx" ON "client_knowledge_items"("clientAccountId", "type", "status");
CREATE INDEX "client_knowledge_items_associationId_type_status_idx" ON "client_knowledge_items"("associationId", "type", "status");
CREATE INDEX "client_knowledge_items_category_status_updatedAt_idx" ON "client_knowledge_items"("category", "status", "updatedAt");
CREATE INDEX "client_knowledge_items_priority_status_updatedAt_idx" ON "client_knowledge_items"("priority", "status", "updatedAt");
CREATE INDEX "client_knowledge_items_isPinned_updatedAt_idx" ON "client_knowledge_items"("isPinned", "updatedAt");
CREATE INDEX "client_knowledge_items_createdById_updatedAt_idx" ON "client_knowledge_items"("createdById", "updatedAt");

CREATE INDEX "client_files_clientAccountId_status_uploadedAt_idx" ON "client_files"("clientAccountId", "status", "uploadedAt");
CREATE INDEX "client_files_associationId_status_uploadedAt_idx" ON "client_files"("associationId", "status", "uploadedAt");
CREATE INDEX "client_files_knowledgeItemId_idx" ON "client_files"("knowledgeItemId");
CREATE INDEX "client_files_category_status_idx" ON "client_files"("category", "status");

CREATE INDEX "client_contacts_clientAccountId_status_isPrimary_idx" ON "client_contacts"("clientAccountId", "status", "isPrimary");
CREATE INDEX "client_contacts_associationId_status_idx" ON "client_contacts"("associationId", "status");
CREATE INDEX "client_contacts_email_idx" ON "client_contacts"("email");
CREATE INDEX "client_contacts_phone_idx" ON "client_contacts"("phone");

CREATE INDEX "client_decisions_clientAccountId_status_decisionDate_idx" ON "client_decisions"("clientAccountId", "status", "decisionDate");
CREATE INDEX "client_decisions_associationId_status_decisionDate_idx" ON "client_decisions"("associationId", "status", "decisionDate");
CREATE INDEX "client_decisions_impact_status_idx" ON "client_decisions"("impact", "status");

CREATE INDEX "client_known_issues_clientAccountId_status_severity_idx" ON "client_known_issues"("clientAccountId", "status", "severity");
CREATE INDEX "client_known_issues_associationId_status_severity_idx" ON "client_known_issues"("associationId", "status", "severity");
CREATE INDEX "client_known_issues_assignedToId_status_idx" ON "client_known_issues"("assignedToId", "status");
CREATE INDEX "client_known_issues_category_status_idx" ON "client_known_issues"("category", "status");

CREATE INDEX "client_links_clientAccountId_status_createdAt_idx" ON "client_links"("clientAccountId", "status", "createdAt");
CREATE INDEX "client_links_associationId_status_createdAt_idx" ON "client_links"("associationId", "status", "createdAt");
CREATE INDEX "client_links_category_status_idx" ON "client_links"("category", "status");

CREATE INDEX "client_checklists_clientAccountId_status_createdAt_idx" ON "client_checklists"("clientAccountId", "status", "createdAt");
CREATE INDEX "client_checklists_associationId_status_createdAt_idx" ON "client_checklists"("associationId", "status", "createdAt");
CREATE INDEX "client_checklists_category_status_idx" ON "client_checklists"("category", "status");
