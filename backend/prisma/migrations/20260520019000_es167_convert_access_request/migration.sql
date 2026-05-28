ALTER TABLE "customer_onboarding_requests"
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "convertedById" TEXT,
  ADD COLUMN "convertedOrganizationId" TEXT,
  ADD COLUMN "conversionNote" TEXT;

CREATE INDEX "customer_onboarding_requests_convertedOrganizationId_idx"
  ON "customer_onboarding_requests"("convertedOrganizationId");

CREATE INDEX "customer_onboarding_requests_convertedById_idx"
  ON "customer_onboarding_requests"("convertedById");

CREATE INDEX "customer_onboarding_requests_convertedAt_idx"
  ON "customer_onboarding_requests"("convertedAt");

ALTER TABLE "customer_onboarding_requests"
  ADD CONSTRAINT "customer_onboarding_requests_convertedById_fkey"
  FOREIGN KEY ("convertedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_onboarding_requests"
  ADD CONSTRAINT "customer_onboarding_requests_convertedOrganizationId_fkey"
  FOREIGN KEY ("convertedOrganizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
