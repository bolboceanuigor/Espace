DO $$ BEGIN
  CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'IDEA', 'QUESTION', 'COMPLAINT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeedbackPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureRequestCategory" AS ENUM ('PAYMENTS', 'REPORTS', 'MOBILE', 'INTEGRATIONS', 'UX', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureRequestStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureRequestVisibility" AS ENUM ('INTERNAL', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReleaseNoteTargetRole" AS ENUM ('ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductReleaseStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductUpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductUpdateType" AS ENUM ('FEATURE', 'IMPROVEMENT', 'FIX', 'SECURITY', 'DEPRECATION', 'NOTICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductUpdateVisibility" AS ENUM ('PUBLIC_CHANGELOG', 'IN_APP_ONLY', 'INTERNAL_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductUpdatePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  "pageUrl" TEXT,
  "type" "FeedbackType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "priority" "FeedbackPriority" NOT NULL DEFAULT 'MEDIUM',
  "screenshotUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "feature_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "FeatureRequestCategory" NOT NULL,
  "status" "FeatureRequestStatus" NOT NULL DEFAULT 'NEW',
  "visibility" "FeatureRequestVisibility" NOT NULL DEFAULT 'INTERNAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feature_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "feature_requests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "feature_votes" (
  "id" TEXT NOT NULL,
  "featureRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feature_votes_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "feature_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "release_notes" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" TEXT,
  "targetRole" "ReleaseNoteTargetRole" NOT NULL DEFAULT 'ALL',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "release_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "release_note_reads" (
  "id" TEXT NOT NULL,
  "releaseNoteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "release_note_reads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "release_note_reads_releaseNoteId_fkey" FOREIGN KEY ("releaseNoteId") REFERENCES "release_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "release_note_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "product_releases" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "status" "ProductReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "releaseDate" TIMESTAMP(3),
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "publicSlug" TEXT,
  "internalNotes" TEXT,
  "createdById" TEXT,
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_releases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_releases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_releases_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "product_updates" (
  "id" TEXT NOT NULL,
  "productReleaseId" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "updateType" "ProductUpdateType" NOT NULL DEFAULT 'IMPROVEMENT',
  "status" "ProductUpdateStatus" NOT NULL DEFAULT 'DRAFT',
  "audience" "ReleaseNoteTargetRole" NOT NULL DEFAULT 'ALL',
  "visibility" "ProductUpdateVisibility" NOT NULL DEFAULT 'IN_APP_ONLY',
  "priority" "ProductUpdatePriority" NOT NULL DEFAULT 'NORMAL',
  "moduleKey" TEXT,
  "version" TEXT,
  "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "publishedById" TEXT,
  "linkedFeatureRequestId" TEXT,
  "linkedFeedbackId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_updates_productReleaseId_fkey" FOREIGN KEY ("productReleaseId") REFERENCES "product_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_updates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_updates_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_updates_linkedFeatureRequestId_fkey" FOREIGN KEY ("linkedFeatureRequestId") REFERENCES "feature_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "product_updates_linkedFeedbackId_fkey" FOREIGN KEY ("linkedFeedbackId") REFERENCES "feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "product_update_acknowledgements" (
  "id" TEXT NOT NULL,
  "productUpdateId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "userRole" TEXT,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_update_acknowledgements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_update_acknowledgements_productUpdateId_fkey" FOREIGN KEY ("productUpdateId") REFERENCES "product_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_update_acknowledgements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "feedback_organizationId_createdAt_idx" ON "feedback"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "feedback_userId_createdAt_idx" ON "feedback"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_requests_status_category_visibility_idx" ON "feature_requests"("status", "category", "visibility");
CREATE INDEX IF NOT EXISTS "feature_requests_organizationId_createdAt_idx" ON "feature_requests"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_requests_createdByUserId_createdAt_idx" ON "feature_requests"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "feature_votes_featureRequestId_userId_key" ON "feature_votes"("featureRequestId", "userId");
CREATE INDEX IF NOT EXISTS "feature_votes_userId_createdAt_idx" ON "feature_votes"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "release_notes_isPublished_targetRole_createdAt_idx" ON "release_notes"("isPublished", "targetRole", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "release_note_reads_releaseNoteId_userId_key" ON "release_note_reads"("releaseNoteId", "userId");
CREATE INDEX IF NOT EXISTS "release_note_reads_userId_readAt_idx" ON "release_note_reads"("userId", "readAt");
CREATE UNIQUE INDEX IF NOT EXISTS "product_releases_version_key" ON "product_releases"("version");
CREATE UNIQUE INDEX IF NOT EXISTS "product_releases_publicSlug_key" ON "product_releases"("publicSlug");
CREATE INDEX IF NOT EXISTS "product_releases_status_publishedAt_idx" ON "product_releases"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "product_releases_releaseDate_idx" ON "product_releases"("releaseDate");
CREATE INDEX IF NOT EXISTS "product_updates_status_audience_publishedAt_idx" ON "product_updates"("status", "audience", "publishedAt");
CREATE INDEX IF NOT EXISTS "product_updates_visibility_publishedAt_idx" ON "product_updates"("visibility", "publishedAt");
CREATE INDEX IF NOT EXISTS "product_updates_productReleaseId_idx" ON "product_updates"("productReleaseId");
CREATE INDEX IF NOT EXISTS "product_updates_linkedFeatureRequestId_idx" ON "product_updates"("linkedFeatureRequestId");
CREATE INDEX IF NOT EXISTS "product_updates_linkedFeedbackId_idx" ON "product_updates"("linkedFeedbackId");
CREATE UNIQUE INDEX IF NOT EXISTS "product_update_acknowledgements_productUpdateId_userId_key" ON "product_update_acknowledgements"("productUpdateId", "userId");
CREATE INDEX IF NOT EXISTS "product_update_acknowledgements_userId_acknowledgedAt_idx" ON "product_update_acknowledgements"("userId", "acknowledgedAt");
CREATE INDEX IF NOT EXISTS "product_update_acknowledgements_organizationId_acknowledgedAt_idx" ON "product_update_acknowledgements"("organizationId", "acknowledgedAt");
