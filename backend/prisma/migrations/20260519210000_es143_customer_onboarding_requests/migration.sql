-- ES-143 customer onboarding requests for public website access/contact flow.
CREATE TYPE "CustomerOnboardingRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'IN_ONBOARDING', 'CONVERTED', 'CLOSED', 'SPAM');
CREATE TYPE "CustomerOnboardingRequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE "CustomerOnboardingRequestSource" AS ENUM ('PUBLIC_WEBSITE', 'CONTACT_PAGE', 'ACCESS_REQUEST', 'REFERRAL', 'MANUAL', 'OTHER');

CREATE TABLE "customer_onboarding_requests" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "associationName" TEXT NOT NULL,
  "associationCode" TEXT,
  "address" TEXT,
  "apartmentsCount" INTEGER,
  "role" TEXT,
  "currentManagementMethod" TEXT,
  "interestedModules" JSONB,
  "preferredContactMethod" TEXT,
  "message" TEXT,
  "source" "CustomerOnboardingRequestSource" NOT NULL DEFAULT 'PUBLIC_WEBSITE',
  "status" "CustomerOnboardingRequestStatus" NOT NULL DEFAULT 'NEW',
  "priority" "CustomerOnboardingRequestPriority" NOT NULL DEFAULT 'NORMAL',
  "assignedToId" TEXT,
  "contactedAt" TIMESTAMP(3),
  "qualifiedAt" TIMESTAMP(3),
  "convertedAssociationId" TEXT,
  "closedAt" TIMESTAMP(3),
  "closeReason" TEXT,
  "internalNotes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_onboarding_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_onboarding_requests_status_createdAt_idx" ON "customer_onboarding_requests"("status", "createdAt");
CREATE INDEX "customer_onboarding_requests_priority_createdAt_idx" ON "customer_onboarding_requests"("priority", "createdAt");
CREATE INDEX "customer_onboarding_requests_source_createdAt_idx" ON "customer_onboarding_requests"("source", "createdAt");
CREATE INDEX "customer_onboarding_requests_phone_createdAt_idx" ON "customer_onboarding_requests"("phone", "createdAt");
CREATE INDEX "customer_onboarding_requests_email_createdAt_idx" ON "customer_onboarding_requests"("email", "createdAt");
CREATE INDEX "customer_onboarding_requests_assignedToId_status_idx" ON "customer_onboarding_requests"("assignedToId", "status");
CREATE INDEX "customer_onboarding_requests_convertedAssociationId_idx" ON "customer_onboarding_requests"("convertedAssociationId");

ALTER TABLE "customer_onboarding_requests" ADD CONSTRAINT "customer_onboarding_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_onboarding_requests" ADD CONSTRAINT "customer_onboarding_requests_convertedAssociationId_fkey" FOREIGN KEY ("convertedAssociationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
