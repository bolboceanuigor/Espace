-- ES-123 Duplicate Detection & Safe Merge Assistant

CREATE TYPE "DuplicateScanRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "DuplicateEntityType" AS ENUM ('RESIDENT', 'APARTMENT', 'METER', 'TARIFF');
CREATE TYPE "DuplicateGroupStatus" AS ENUM ('OPEN', 'REVIEWED', 'MERGED', 'IGNORED', 'NOT_DUPLICATE');
CREATE TYPE "DuplicateConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "DuplicateMergePlanStatus" AS ENUM ('DRAFT', 'APPLIED', 'CANCELLED');

CREATE TABLE "duplicate_scan_runs" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "status" "DuplicateScanRunStatus" NOT NULL DEFAULT 'RUNNING',
  "residentsGroupsFound" INTEGER NOT NULL DEFAULT 0,
  "apartmentsGroupsFound" INTEGER NOT NULL DEFAULT 0,
  "metersGroupsFound" INTEGER NOT NULL DEFAULT 0,
  "totalGroupsFound" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "duplicate_scan_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "duplicate_groups" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "scanRunId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "entityType" "DuplicateEntityType" NOT NULL,
  "status" "DuplicateGroupStatus" NOT NULL DEFAULT 'OPEN',
  "confidence" "DuplicateConfidence" NOT NULL,
  "reason" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "canonicalEntityId" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "mergedById" TEXT,
  "mergedAt" TIMESTAMP(3),
  "ignoredById" TEXT,
  "ignoredAt" TIMESTAMP(3),
  "ignoreReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "duplicate_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "duplicate_candidates" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityType" "DuplicateEntityType" NOT NULL,
  "displayName" TEXT NOT NULL,
  "matchReason" TEXT NOT NULL,
  "matchScore" INTEGER NOT NULL DEFAULT 0,
  "snapshot" JSONB,
  "isCanonical" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "duplicate_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "duplicate_merge_plans" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "entityType" "DuplicateEntityType" NOT NULL,
  "canonicalEntityId" TEXT NOT NULL,
  "mergeStrategy" TEXT NOT NULL,
  "plan" JSONB NOT NULL,
  "warnings" JSONB,
  "status" "DuplicateMergePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "appliedById" TEXT,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "duplicate_merge_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "duplicate_scan_runs_associationId_createdAt_idx" ON "duplicate_scan_runs"("associationId", "createdAt");
CREATE INDEX "duplicate_scan_runs_associationId_status_createdAt_idx" ON "duplicate_scan_runs"("associationId", "status", "createdAt");

CREATE UNIQUE INDEX "duplicate_groups_associationId_entityType_dedupeKey_key" ON "duplicate_groups"("associationId", "entityType", "dedupeKey");
CREATE INDEX "duplicate_groups_associationId_status_confidence_createdAt_idx" ON "duplicate_groups"("associationId", "status", "confidence", "createdAt");
CREATE INDEX "duplicate_groups_associationId_entityType_status_idx" ON "duplicate_groups"("associationId", "entityType", "status");
CREATE INDEX "duplicate_groups_scanRunId_idx" ON "duplicate_groups"("scanRunId");

CREATE UNIQUE INDEX "duplicate_candidates_groupId_entityId_key" ON "duplicate_candidates"("groupId", "entityId");
CREATE INDEX "duplicate_candidates_groupId_idx" ON "duplicate_candidates"("groupId");
CREATE INDEX "duplicate_candidates_entityType_entityId_idx" ON "duplicate_candidates"("entityType", "entityId");

CREATE INDEX "duplicate_merge_plans_associationId_entityType_status_createdAt_idx" ON "duplicate_merge_plans"("associationId", "entityType", "status", "createdAt");
CREATE INDEX "duplicate_merge_plans_groupId_status_idx" ON "duplicate_merge_plans"("groupId", "status");

ALTER TABLE "duplicate_scan_runs"
  ADD CONSTRAINT "duplicate_scan_runs_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_scan_runs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "duplicate_groups"
  ADD CONSTRAINT "duplicate_groups_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_groups_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "duplicate_scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_groups_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_groups_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_groups_ignoredById_fkey" FOREIGN KEY ("ignoredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "duplicate_candidates"
  ADD CONSTRAINT "duplicate_candidates_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "duplicate_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "duplicate_merge_plans"
  ADD CONSTRAINT "duplicate_merge_plans_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "duplicate_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_merge_plans_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_merge_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "duplicate_merge_plans_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
