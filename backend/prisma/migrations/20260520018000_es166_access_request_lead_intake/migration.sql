DO $$ BEGIN
  ALTER TYPE "CustomerOnboardingRequestStatus" ADD VALUE IF NOT EXISTS 'ONBOARDING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "CustomerOnboardingRequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerOnboardingRequestType" AS ENUM ('APC', 'ADMINISTRATOR', 'PROPERTY_MANAGER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "type" "CustomerOnboardingRequestType" NOT NULL DEFAULT 'APC';
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "apcCode" TEXT;
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "blocksCount" INTEGER;
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "contactRole" TEXT;
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "possibleDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customer_onboarding_requests" ADD COLUMN IF NOT EXISTS "duplicateOfRequestId" TEXT;

UPDATE "customer_onboarding_requests"
SET "apcCode" = COALESCE("apcCode", "associationCode")
WHERE "apcCode" IS NULL AND "associationCode" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "customer_onboarding_requests_type_status_idx" ON "customer_onboarding_requests"("type", "status");
CREATE INDEX IF NOT EXISTS "customer_onboarding_requests_city_status_idx" ON "customer_onboarding_requests"("city", "status");
CREATE INDEX IF NOT EXISTS "customer_onboarding_requests_apcCode_createdAt_idx" ON "customer_onboarding_requests"("apcCode", "createdAt");
CREATE INDEX IF NOT EXISTS "customer_onboarding_requests_possibleDuplicate_createdAt_idx" ON "customer_onboarding_requests"("possibleDuplicate", "createdAt");
