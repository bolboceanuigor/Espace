ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_LAUNCH';
ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'LAUNCHED';
ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

CREATE TYPE "OrganizationLaunchStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'READY', 'LIVE');

ALTER TABLE "organizations"
  ADD COLUMN "launchStatus" "OrganizationLaunchStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN "launchedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingNote" TEXT,
  ADD COLUMN "launchChecklistJson" JSONB;

CREATE INDEX "organizations_launchStatus_idx" ON "organizations"("launchStatus");
CREATE INDEX "organizations_onboardingStatus_launchStatus_idx" ON "organizations"("onboardingStatus", "launchStatus");
