-- ES-133 Superadmin SaaS Plans & Subscription Management

CREATE TYPE "SaasPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "SaasSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "SaasBillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "SaasSubscriptionEventType" AS ENUM (
  'SUBSCRIPTION_CREATED',
  'PLAN_ASSIGNED',
  'TRIAL_STARTED',
  'SUBSCRIPTION_ACTIVATED',
  'SUBSCRIPTION_SUSPENDED',
  'SUBSCRIPTION_REACTIVATED',
  'SUBSCRIPTION_CANCELLED',
  'SUBSCRIPTION_EXPIRED',
  'PLAN_CHANGED',
  'INTERNAL_NOTE_ADDED'
);

CREATE TABLE "saas_plans" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "SaasPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "yearlyPrice" DOUBLE PRECISION,
  "trialDays" INTEGER NOT NULL DEFAULT 14,
  "maxApartments" INTEGER,
  "maxResidents" INTEGER,
  "maxStaffMembers" INTEGER,
  "maxMeters" INTEGER,
  "maxInvoicesPerMonth" INTEGER,
  "maxAnnouncementsPerMonth" INTEGER,
  "maxRequestsPerMonth" INTEGER,
  "maxStorageMB" INTEGER,
  "features" JSONB NOT NULL,
  "limits" JSONB,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_subscriptions" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SaasSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "billingCycle" "SaasBillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trialStartedAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "suspendedById" TEXT,
  "suspensionReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "planSnapshot" JSONB NOT NULL,
  "limitsSnapshot" JSONB NOT NULL,
  "featuresSnapshot" JSONB NOT NULL,
  "internalNotes" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_subscription_events" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "SaasSubscriptionEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saas_plans_code_key" ON "saas_plans"("code");
CREATE INDEX "saas_plans_status_idx" ON "saas_plans"("status");
CREATE INDEX "saas_plans_isPublic_idx" ON "saas_plans"("isPublic");
CREATE INDEX "saas_plans_isDefault_idx" ON "saas_plans"("isDefault");
CREATE INDEX "saas_subscriptions_associationId_status_idx" ON "saas_subscriptions"("associationId", "status");
CREATE INDEX "saas_subscriptions_planId_status_idx" ON "saas_subscriptions"("planId", "status");
CREATE INDEX "saas_subscriptions_status_createdAt_idx" ON "saas_subscriptions"("status", "createdAt");
CREATE INDEX "saas_subscriptions_trialEndsAt_idx" ON "saas_subscriptions"("trialEndsAt");
CREATE UNIQUE INDEX "saas_subscriptions_one_current_per_association_idx"
  ON "saas_subscriptions"("associationId")
  WHERE "status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');
CREATE INDEX "saas_subscription_events_subscriptionId_createdAt_idx" ON "saas_subscription_events"("subscriptionId", "createdAt");
CREATE INDEX "saas_subscription_events_associationId_createdAt_idx" ON "saas_subscription_events"("associationId", "createdAt");
CREATE INDEX "saas_subscription_events_eventType_createdAt_idx" ON "saas_subscription_events"("eventType", "createdAt");

ALTER TABLE "saas_plans"
  ADD CONSTRAINT "saas_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_plans_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saas_subscriptions"
  ADD CONSTRAINT "saas_subscriptions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_subscriptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_subscriptions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_subscriptions_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_subscriptions_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saas_subscription_events"
  ADD CONSTRAINT "saas_subscription_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_subscription_events_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "saas_subscription_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
