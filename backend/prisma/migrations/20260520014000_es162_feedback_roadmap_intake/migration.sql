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
  CREATE TYPE "FeedbackSource" AS ENUM ('IN_APP', 'SUPPORT', 'CALL', 'EMAIL', 'SUPERADMIN', 'IMPORT');
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

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  "pageUrl" TEXT,
  "type" "FeedbackType" NOT NULL,
  "source" "FeedbackSource" NOT NULL DEFAULT 'IN_APP',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "moduleKey" TEXT,
  "customerImpact" TEXT,
  "reproductionSteps" TEXT,
  "environment" TEXT,
  "browserInfo" TEXT,
  "deviceInfo" TEXT,
  "contextJson" JSONB,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "priority" "FeedbackPriority" NOT NULL DEFAULT 'MEDIUM',
  "screenshotUrl" TEXT,
  "internalNotes" TEXT,
  "assignedToId" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "linkedFeatureRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feature_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "ownerId" TEXT,
  "sourceFeedbackId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "publicSummary" TEXT,
  "customerProblem" TEXT,
  "expectedOutcome" TEXT,
  "moduleKey" TEXT,
  "category" "FeatureRequestCategory" NOT NULL,
  "status" "FeatureRequestStatus" NOT NULL DEFAULT 'NEW',
  "visibility" "FeatureRequestVisibility" NOT NULL DEFAULT 'INTERNAL',
  "impactScore" INTEGER NOT NULL DEFAULT 0,
  "effortScore" INTEGER NOT NULL DEFAULT 0,
  "reachScore" INTEGER NOT NULL DEFAULT 0,
  "confidenceScore" INTEGER NOT NULL DEFAULT 0,
  "roadmapQuarter" TEXT,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feature_votes" (
  "id" TEXT NOT NULL,
  "featureRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_votes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feature_request_comments" (
  "id" TEXT NOT NULL,
  "featureRequestId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "internalOnly" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feature_request_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feature_request_events" (
  "id" TEXT NOT NULL,
  "featureRequestId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_request_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "source" "FeedbackSource" NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "moduleKey" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "customerImpact" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "reproductionSteps" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "environment" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "browserInfo" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "deviceInfo" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "contextJson" JSONB;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "linkedFeatureRequestId" TEXT;

ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "sourceFeedbackId" TEXT;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "publicSummary" TEXT;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "customerProblem" TEXT;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "expectedOutcome" TEXT;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "moduleKey" TEXT;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "impactScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "effortScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "reachScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "confidenceScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "roadmapQuarter" TEXT;
ALTER TABLE "feature_requests" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

DO $$ BEGIN
  ALTER TABLE "feedback" ADD CONSTRAINT "feedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feedback" ADD CONSTRAINT "feedback_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feedback" ADD CONSTRAINT "feedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_sourceFeedbackId_fkey" FOREIGN KEY ("sourceFeedbackId") REFERENCES "feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feedback" ADD CONSTRAINT "feedback_linkedFeatureRequestId_fkey" FOREIGN KEY ("linkedFeatureRequestId") REFERENCES "feature_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_votes" ADD CONSTRAINT "feature_votes_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_votes" ADD CONSTRAINT "feature_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_request_comments" ADD CONSTRAINT "feature_request_comments_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_request_comments" ADD CONSTRAINT "feature_request_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_request_events" ADD CONSTRAINT "feature_request_events_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_request_events" ADD CONSTRAINT "feature_request_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "feedback_organizationId_status_createdAt_idx" ON "feedback"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "feedback_userId_createdAt_idx" ON "feedback"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "feedback_type_priority_status_idx" ON "feedback"("type", "priority", "status");
CREATE INDEX IF NOT EXISTS "feedback_linkedFeatureRequestId_idx" ON "feedback"("linkedFeatureRequestId");
CREATE INDEX IF NOT EXISTS "feature_requests_status_category_visibility_idx" ON "feature_requests"("status", "category", "visibility");
CREATE INDEX IF NOT EXISTS "feature_requests_organizationId_createdAt_idx" ON "feature_requests"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_requests_createdByUserId_createdAt_idx" ON "feature_requests"("createdByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_requests_ownerId_status_idx" ON "feature_requests"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "feature_requests_sourceFeedbackId_idx" ON "feature_requests"("sourceFeedbackId");
CREATE UNIQUE INDEX IF NOT EXISTS "feature_votes_featureRequestId_userId_key" ON "feature_votes"("featureRequestId", "userId");
CREATE INDEX IF NOT EXISTS "feature_votes_userId_createdAt_idx" ON "feature_votes"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_request_comments_featureRequestId_createdAt_idx" ON "feature_request_comments"("featureRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_request_comments_authorId_createdAt_idx" ON "feature_request_comments"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_request_events_featureRequestId_createdAt_idx" ON "feature_request_events"("featureRequestId", "createdAt");
