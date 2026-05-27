CREATE TYPE "SaasUpgradeRequestStatus" AS ENUM (
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "SaasUpgradeRequestReason" AS ENUM (
  'LIMIT_REACHED',
  'NEAR_LIMIT',
  'FEATURE_NEEDED',
  'MORE_STAFF',
  'MORE_APARTMENTS',
  'MORE_METERS',
  'MORE_INVOICES',
  'ADVANCED_REPORTS',
  'DATA_QUALITY',
  'SUPPORT_ACCESS',
  'OTHER'
);

CREATE TABLE "saas_upgrade_requests" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "currentPlanId" TEXT,
  "requestedPlanId" TEXT,
  "status" "SaasUpgradeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" "SaasUpgradeRequestReason" NOT NULL,
  "message" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "adminResponse" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "appliedPlanChange" BOOLEAN NOT NULL DEFAULT false,
  "appliedSubscriptionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "saas_upgrade_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saas_upgrade_requests_associationId_status_createdAt_idx" ON "saas_upgrade_requests"("associationId", "status", "createdAt");
CREATE INDEX "saas_upgrade_requests_subscriptionId_idx" ON "saas_upgrade_requests"("subscriptionId");
CREATE INDEX "saas_upgrade_requests_currentPlanId_idx" ON "saas_upgrade_requests"("currentPlanId");
CREATE INDEX "saas_upgrade_requests_requestedPlanId_idx" ON "saas_upgrade_requests"("requestedPlanId");
CREATE INDEX "saas_upgrade_requests_status_createdAt_idx" ON "saas_upgrade_requests"("status", "createdAt");
CREATE INDEX "saas_upgrade_requests_reason_createdAt_idx" ON "saas_upgrade_requests"("reason", "createdAt");

ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_currentPlanId_fkey" FOREIGN KEY ("currentPlanId") REFERENCES "saas_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_requestedPlanId_fkey" FOREIGN KEY ("requestedPlanId") REFERENCES "saas_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_upgrade_requests" ADD CONSTRAINT "saas_upgrade_requests_appliedSubscriptionId_fkey" FOREIGN KEY ("appliedSubscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
