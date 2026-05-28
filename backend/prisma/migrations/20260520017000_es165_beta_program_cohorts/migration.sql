DO $$ BEGIN
  ALTER TYPE "FeatureFlagRuleScope" ADD VALUE IF NOT EXISTS 'COHORT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaCohortStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaCohortMemberType" AS ENUM ('ORGANIZATION', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaCohortMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'PAUSED', 'REMOVED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaFeedbackSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaFeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaFeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BetaProgramEventType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'COHORT_CREATED', 'COHORT_UPDATED', 'COHORT_STATUS_CHANGED', 'MEMBER_ADDED', 'MEMBER_UPDATED', 'MEMBER_REMOVED', 'FEEDBACK_SUBMITTED', 'FEEDBACK_REVIEWED', 'FEATURE_FLAG_LINKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "beta_programs" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "BetaProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "moduleKey" TEXT,
  "featureFlagId" TEXT,
  "targetRelease" TEXT,
  "successCriteria" JSONB,
  "riskNotes" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "ownerId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beta_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "beta_cohorts" (
  "id" TEXT NOT NULL,
  "betaProgramId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "BetaCohortStatus" NOT NULL DEFAULT 'DRAFT',
  "moduleKey" TEXT,
  "featureFlagId" TEXT,
  "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
  "entryCriteria" JSONB,
  "exitCriteria" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beta_cohorts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "beta_cohort_members" (
  "id" TEXT NOT NULL,
  "betaCohortId" TEXT NOT NULL,
  "memberType" "BetaCohortMemberType" NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "status" "BetaCohortMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "role" "Role",
  "notes" TEXT,
  "invitedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beta_cohort_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "beta_feedback" (
  "id" TEXT NOT NULL,
  "betaProgramId" TEXT,
  "betaCohortId" TEXT,
  "organizationId" TEXT,
  "userId" TEXT NOT NULL,
  "featureFlagId" TEXT,
  "moduleKey" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "sentiment" "BetaFeedbackSentiment" NOT NULL DEFAULT 'NEUTRAL',
  "severity" "BetaFeedbackSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "BetaFeedbackStatus" NOT NULL DEFAULT 'NEW',
  "pageUrl" TEXT,
  "screenshotUrl" TEXT,
  "contextJson" JSONB,
  "internalNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "beta_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "beta_program_events" (
  "id" TEXT NOT NULL,
  "betaProgramId" TEXT,
  "betaCohortId" TEXT,
  "actorUserId" TEXT,
  "eventType" "BetaProgramEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "beta_program_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "feature_flag_rules" ADD COLUMN IF NOT EXISTS "betaCohortId" TEXT;

DO $$ BEGIN
  ALTER TABLE "beta_programs" ADD CONSTRAINT "beta_programs_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "feature_flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_programs" ADD CONSTRAINT "beta_programs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_programs" ADD CONSTRAINT "beta_programs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_programs" ADD CONSTRAINT "beta_programs_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohorts" ADD CONSTRAINT "beta_cohorts_betaProgramId_fkey" FOREIGN KEY ("betaProgramId") REFERENCES "beta_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohorts" ADD CONSTRAINT "beta_cohorts_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "feature_flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohorts" ADD CONSTRAINT "beta_cohorts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohorts" ADD CONSTRAINT "beta_cohorts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohort_members" ADD CONSTRAINT "beta_cohort_members_betaCohortId_fkey" FOREIGN KEY ("betaCohortId") REFERENCES "beta_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohort_members" ADD CONSTRAINT "beta_cohort_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohort_members" ADD CONSTRAINT "beta_cohort_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohort_members" ADD CONSTRAINT "beta_cohort_members_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_cohort_members" ADD CONSTRAINT "beta_cohort_members_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_betaProgramId_fkey" FOREIGN KEY ("betaProgramId") REFERENCES "beta_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_betaCohortId_fkey" FOREIGN KEY ("betaCohortId") REFERENCES "beta_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "feature_flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_program_events" ADD CONSTRAINT "beta_program_events_betaProgramId_fkey" FOREIGN KEY ("betaProgramId") REFERENCES "beta_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_program_events" ADD CONSTRAINT "beta_program_events_betaCohortId_fkey" FOREIGN KEY ("betaCohortId") REFERENCES "beta_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "beta_program_events" ADD CONSTRAINT "beta_program_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_betaCohortId_fkey" FOREIGN KEY ("betaCohortId") REFERENCES "beta_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "beta_programs_key_key" ON "beta_programs"("key");
CREATE INDEX IF NOT EXISTS "beta_programs_status_updatedAt_idx" ON "beta_programs"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "beta_programs_moduleKey_status_idx" ON "beta_programs"("moduleKey", "status");
CREATE INDEX IF NOT EXISTS "beta_programs_featureFlagId_idx" ON "beta_programs"("featureFlagId");
CREATE INDEX IF NOT EXISTS "beta_programs_ownerId_idx" ON "beta_programs"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "beta_cohorts_betaProgramId_key_key" ON "beta_cohorts"("betaProgramId", "key");
CREATE INDEX IF NOT EXISTS "beta_cohorts_betaProgramId_status_idx" ON "beta_cohorts"("betaProgramId", "status");
CREATE INDEX IF NOT EXISTS "beta_cohorts_moduleKey_status_idx" ON "beta_cohorts"("moduleKey", "status");
CREATE INDEX IF NOT EXISTS "beta_cohorts_featureFlagId_idx" ON "beta_cohorts"("featureFlagId");
CREATE UNIQUE INDEX IF NOT EXISTS "beta_cohort_members_betaCohortId_organizationId_key" ON "beta_cohort_members"("betaCohortId", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "beta_cohort_members_betaCohortId_userId_key" ON "beta_cohort_members"("betaCohortId", "userId");
CREATE INDEX IF NOT EXISTS "beta_cohort_members_organizationId_status_idx" ON "beta_cohort_members"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "beta_cohort_members_userId_status_idx" ON "beta_cohort_members"("userId", "status");
CREATE INDEX IF NOT EXISTS "beta_cohort_members_memberType_status_idx" ON "beta_cohort_members"("memberType", "status");
CREATE INDEX IF NOT EXISTS "beta_feedback_betaProgramId_status_createdAt_idx" ON "beta_feedback"("betaProgramId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "beta_feedback_betaCohortId_status_createdAt_idx" ON "beta_feedback"("betaCohortId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "beta_feedback_organizationId_createdAt_idx" ON "beta_feedback"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "beta_feedback_userId_createdAt_idx" ON "beta_feedback"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "beta_feedback_featureFlagId_idx" ON "beta_feedback"("featureFlagId");
CREATE INDEX IF NOT EXISTS "beta_program_events_betaProgramId_createdAt_idx" ON "beta_program_events"("betaProgramId", "createdAt");
CREATE INDEX IF NOT EXISTS "beta_program_events_betaCohortId_createdAt_idx" ON "beta_program_events"("betaCohortId", "createdAt");
CREATE INDEX IF NOT EXISTS "beta_program_events_actorUserId_createdAt_idx" ON "beta_program_events"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_flag_rules_betaCohortId_idx" ON "feature_flag_rules"("betaCohortId");
