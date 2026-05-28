CREATE TYPE "RevenueForecastType" AS ENUM ('CURRENT_MRR', 'CURRENT_ARR', 'TRIAL_CONVERSION', 'PLAN_UPGRADE', 'CHURN_RISK', 'COLLECTION_RECOVERY', 'EXPANSION_REVENUE', 'CONSERVATIVE', 'BASE', 'OPTIMISTIC');

CREATE TYPE "RevenueForecastHorizon" AS ENUM ('DAYS_30', 'DAYS_60', 'DAYS_90', 'MONTHS_6', 'MONTHS_12', 'CUSTOM');

CREATE TYPE "RevenueForecastScenarioStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TYPE "RevenueForecastScenarioType" AS ENUM ('CONSERVATIVE', 'BASE', 'OPTIMISTIC', 'CUSTOM');

CREATE TYPE "UpgradeOpportunityStatus" AS ENUM ('NEW', 'QUALIFIED', 'IN_DISCUSSION', 'PROPOSAL_SENT', 'ACCEPTED', 'REJECTED', 'LOST', 'DISMISSED', 'CONVERTED');

CREATE TYPE "UpgradeOpportunityReason" AS ENUM ('NEAR_APARTMENT_LIMIT', 'OVER_APARTMENT_LIMIT', 'NEAR_RESIDENT_LIMIT', 'OVER_RESIDENT_LIMIT', 'NEAR_STAFF_LIMIT', 'OVER_STAFF_LIMIT', 'NEAR_METER_LIMIT', 'OVER_METER_LIMIT', 'HIGH_INVOICE_VOLUME', 'HIGH_REQUEST_VOLUME', 'HIGH_ANNOUNCEMENT_VOLUME', 'FEATURE_NEEDED_DATA_QUALITY', 'FEATURE_NEEDED_ADVANCED_REPORTS', 'FEATURE_NEEDED_METER_TARIFFS', 'FEATURE_NEEDED_AUDIT_LOG', 'FEATURE_NEEDED_STAFF_ROLES', 'FEATURE_NEEDED_SUPPORT_ACCESS', 'PLAN_MISMATCH', 'ACTIVE_USAGE_GROWTH', 'MULTIPLE_APC_POTENTIAL', 'CUSTOMER_REQUESTED_UPGRADE', 'MANUAL', 'OTHER');

CREATE TYPE "UpgradeOpportunityPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "UpgradeOpportunityEventType" AS ENUM ('OPPORTUNITY_CREATED', 'OPPORTUNITY_STATUS_CHANGED', 'OPPORTUNITY_PRIORITY_CHANGED', 'OPPORTUNITY_ASSIGNED', 'OPPORTUNITY_QUALIFIED', 'PROPOSAL_SENT', 'OPPORTUNITY_ACCEPTED', 'OPPORTUNITY_REJECTED', 'OPPORTUNITY_LOST', 'OPPORTUNITY_DISMISSED', 'OPPORTUNITY_CONVERTED', 'TASK_CREATED', 'FOLLOW_UP_CREATED', 'NOTE_ADDED', 'SUBSCRIPTION_PLAN_CHANGED_LINKED');

CREATE TABLE "revenue_forecast_scenarios" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "RevenueForecastScenarioType" NOT NULL DEFAULT 'BASE',
  "status" "RevenueForecastScenarioStatus" NOT NULL DEFAULT 'DRAFT',
  "horizon" "RevenueForecastHorizon" NOT NULL DEFAULT 'DAYS_90',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "assumptions" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revenue_forecast_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "revenue_forecast_snapshots" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT,
  "forecastType" "RevenueForecastType" NOT NULL,
  "horizon" "RevenueForecastHorizon" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "currentMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentArr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "forecastMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "forecastArr" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "expansionPotential" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "churnRiskAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "collectionRecoveryPotential" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trialConversionPotential" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "upgradePotential" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "assumptions" JSONB NOT NULL,
  "breakdown" JSONB NOT NULL,
  "generatedById" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revenue_forecast_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "upgrade_opportunities" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "subscriptionId" TEXT,
  "currentPlanId" TEXT,
  "recommendedPlanId" TEXT,
  "status" "UpgradeOpportunityStatus" NOT NULL DEFAULT 'NEW',
  "reason" "UpgradeOpportunityReason" NOT NULL,
  "priority" "UpgradeOpportunityPriority" NOT NULL DEFAULT 'NORMAL',
  "score" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "currentMonthlyValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recommendedMonthlyValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedMonthlyIncrease" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedAnnualIncrease" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "evidence" JSONB NOT NULL,
  "recommendedActions" JSONB,
  "assignedToId" TEXT,
  "nextFollowUpAt" TIMESTAMP(3),
  "qualifiedAt" TIMESTAMP(3),
  "proposalSentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "dismissalReason" TEXT,
  "outcomeNotes" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "upgrade_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "upgrade_opportunity_events" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "actorUserId" TEXT,
  "eventType" "UpgradeOpportunityEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "upgrade_opportunity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "revenue_forecast_scenarios_type_status_idx" ON "revenue_forecast_scenarios"("type", "status");
CREATE INDEX "revenue_forecast_scenarios_status_updatedAt_idx" ON "revenue_forecast_scenarios"("status", "updatedAt");
CREATE INDEX "revenue_forecast_snapshots_scenarioId_generatedAt_idx" ON "revenue_forecast_snapshots"("scenarioId", "generatedAt");
CREATE INDEX "revenue_forecast_snapshots_forecastType_horizon_generatedAt_idx" ON "revenue_forecast_snapshots"("forecastType", "horizon", "generatedAt");
CREATE INDEX "revenue_forecast_snapshots_periodStart_periodEnd_idx" ON "revenue_forecast_snapshots"("periodStart", "periodEnd");
CREATE INDEX "upgrade_opportunities_associationId_status_idx" ON "upgrade_opportunities"("associationId", "status");
CREATE INDEX "upgrade_opportunities_clientAccountId_status_idx" ON "upgrade_opportunities"("clientAccountId", "status");
CREATE INDEX "upgrade_opportunities_subscriptionId_status_idx" ON "upgrade_opportunities"("subscriptionId", "status");
CREATE INDEX "upgrade_opportunities_currentPlanId_recommendedPlanId_idx" ON "upgrade_opportunities"("currentPlanId", "recommendedPlanId");
CREATE INDEX "upgrade_opportunities_reason_status_idx" ON "upgrade_opportunities"("reason", "status");
CREATE INDEX "upgrade_opportunities_score_status_idx" ON "upgrade_opportunities"("score", "status");
CREATE INDEX "upgrade_opportunities_assignedToId_status_nextFollowUpAt_idx" ON "upgrade_opportunities"("assignedToId", "status", "nextFollowUpAt");
CREATE INDEX "upgrade_opportunity_events_opportunityId_createdAt_idx" ON "upgrade_opportunity_events"("opportunityId", "createdAt");
CREATE INDEX "upgrade_opportunity_events_associationId_createdAt_idx" ON "upgrade_opportunity_events"("associationId", "createdAt");
CREATE INDEX "upgrade_opportunity_events_clientAccountId_createdAt_idx" ON "upgrade_opportunity_events"("clientAccountId", "createdAt");
CREATE INDEX "upgrade_opportunity_events_eventType_createdAt_idx" ON "upgrade_opportunity_events"("eventType", "createdAt");

ALTER TABLE "revenue_forecast_snapshots" ADD CONSTRAINT "revenue_forecast_snapshots_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "revenue_forecast_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "upgrade_opportunity_events" ADD CONSTRAINT "upgrade_opportunity_events_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "upgrade_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
