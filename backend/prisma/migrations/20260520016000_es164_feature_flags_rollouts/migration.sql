DO $$ BEGIN
  CREATE TYPE "FeatureFlagStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureFlagType" AS ENUM ('RELEASE_FLAG', 'MODULE_AVAILABILITY', 'EXPERIMENT', 'KILL_SWITCH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureFlagRuleScope" AS ENUM ('GLOBAL', 'PLAN', 'ORGANIZATION', 'ROLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureFlagRuleEffect" AS ENUM ('ENABLE', 'DISABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeatureFlagEventType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'RULE_CREATED', 'RULE_UPDATED', 'RULE_DELETED', 'EVALUATION_PREVIEWED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "FeatureFlagType" NOT NULL DEFAULT 'RELEASE_FLAG',
  "status" "FeatureFlagStatus" NOT NULL DEFAULT 'DRAFT',
  "moduleKey" TEXT,
  "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
  "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
  "visibleInNavigation" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feature_flag_rules" (
  "id" TEXT NOT NULL,
  "featureFlagId" TEXT NOT NULL,
  "scope" "FeatureFlagRuleScope" NOT NULL,
  "effect" "FeatureFlagRuleEffect" NOT NULL DEFAULT 'ENABLE',
  "planId" TEXT,
  "organizationId" TEXT,
  "role" "Role",
  "rolloutPercentage" INTEGER,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "conditions" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feature_flag_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feature_flag_events" (
  "id" TEXT NOT NULL,
  "featureFlagId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "FeatureFlagEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flag_events_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_events" ADD CONSTRAINT "feature_flag_events_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "feature_flag_events" ADD CONSTRAINT "feature_flag_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_key_key" ON "feature_flags"("key");
CREATE INDEX IF NOT EXISTS "feature_flags_status_type_idx" ON "feature_flags"("status", "type");
CREATE INDEX IF NOT EXISTS "feature_flags_moduleKey_status_idx" ON "feature_flags"("moduleKey", "status");
CREATE INDEX IF NOT EXISTS "feature_flag_rules_featureFlagId_priority_idx" ON "feature_flag_rules"("featureFlagId", "priority");
CREATE INDEX IF NOT EXISTS "feature_flag_rules_scope_effect_idx" ON "feature_flag_rules"("scope", "effect");
CREATE INDEX IF NOT EXISTS "feature_flag_rules_planId_idx" ON "feature_flag_rules"("planId");
CREATE INDEX IF NOT EXISTS "feature_flag_rules_organizationId_idx" ON "feature_flag_rules"("organizationId");
CREATE INDEX IF NOT EXISTS "feature_flag_rules_role_idx" ON "feature_flag_rules"("role");
CREATE INDEX IF NOT EXISTS "feature_flag_events_featureFlagId_createdAt_idx" ON "feature_flag_events"("featureFlagId", "createdAt");
CREATE INDEX IF NOT EXISTS "feature_flag_events_actorUserId_createdAt_idx" ON "feature_flag_events"("actorUserId", "createdAt");
