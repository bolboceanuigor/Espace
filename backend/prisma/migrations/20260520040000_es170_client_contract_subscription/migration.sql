ALTER TYPE "OrganizationSubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationContractStatus') THEN
    CREATE TYPE "OrganizationContractStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractBillingCycle') THEN
    CREATE TYPE "ContractBillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractPricingModel') THEN
    CREATE TYPE "ContractPricingModel" AS ENUM ('PER_APARTMENT', 'FIXED_MONTHLY', 'CUSTOM');
  END IF;
END $$;

ALTER TABLE "organization_subscriptions"
ADD COLUMN IF NOT EXISTS "planName" TEXT;

CREATE TABLE IF NOT EXISTS "organization_contracts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "OrganizationContractStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "contractNumber" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "billingCycle" "ContractBillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "pricingModel" "ContractPricingModel" NOT NULL DEFAULT 'PER_APARTMENT',
  "pricePerApartment" DECIMAL(12,2),
  "fixedMonthlyPrice" DECIMAL(12,2),
  "apartmentsIncluded" INTEGER,
  "minimumMonthlyFee" DECIMAL(12,2),
  "paymentDueDay" INTEGER,
  "documentUrl" TEXT,
  "internalNote" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_contracts_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_contracts_organizationId_fkey'
  ) THEN
    ALTER TABLE "organization_contracts"
    ADD CONSTRAINT "organization_contracts_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_contracts_createdById_fkey'
  ) THEN
    ALTER TABLE "organization_contracts"
    ADD CONSTRAINT "organization_contracts_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_contracts_updatedById_fkey'
  ) THEN
    ALTER TABLE "organization_contracts"
    ADD CONSTRAINT "organization_contracts_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "organization_contracts_organizationId_createdAt_idx" ON "organization_contracts"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "organization_contracts_status_idx" ON "organization_contracts"("status");
CREATE INDEX IF NOT EXISTS "organization_contracts_startDate_idx" ON "organization_contracts"("startDate");
CREATE INDEX IF NOT EXISTS "organization_contracts_endDate_idx" ON "organization_contracts"("endDate");
