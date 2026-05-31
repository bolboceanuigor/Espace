DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuperadminBillingTaskType') THEN
    CREATE TYPE "SuperadminBillingTaskType" AS ENUM (
      'CREATE_CONTRACT',
      'SIGN_CONTRACT',
      'ACTIVATE_SUBSCRIPTION',
      'CHECK_PAYMENT',
      'PAYMENT_FOLLOW_UP',
      'CONTRACT_EXPIRING',
      'CONTRACT_EXPIRED',
      'SUBSCRIPTION_INACTIVE',
      'TRIAL_ENDING',
      'PRICING_MISSING',
      'LIVE_WITHOUT_CONTRACT',
      'OTHER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuperadminBillingTaskStatus') THEN
    CREATE TYPE "SuperadminBillingTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuperadminBillingTaskPriority') THEN
    CREATE TYPE "SuperadminBillingTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuperadminBillingTaskSource') THEN
    CREATE TYPE "SuperadminBillingTaskSource" AS ENUM ('AUTO', 'MANUAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "superadmin_billing_tasks" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "SuperadminBillingTaskType" NOT NULL DEFAULT 'OTHER',
  "status" "SuperadminBillingTaskStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SuperadminBillingTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "dueDate" TIMESTAMP(3),
  "source" "SuperadminBillingTaskSource" NOT NULL DEFAULT 'MANUAL',
  "relatedContractId" TEXT,
  "relatedSubscriptionId" TEXT,
  "assignedToId" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "dismissedAt" TIMESTAMP(3),
  "dismissedById" TEXT,
  "internalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "superadmin_billing_tasks_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_billing_tasks_organizationId_fkey'
  ) THEN
    ALTER TABLE "superadmin_billing_tasks"
    ADD CONSTRAINT "superadmin_billing_tasks_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_billing_tasks_relatedContractId_fkey'
  ) THEN
    ALTER TABLE "superadmin_billing_tasks"
    ADD CONSTRAINT "superadmin_billing_tasks_relatedContractId_fkey"
    FOREIGN KEY ("relatedContractId") REFERENCES "organization_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_billing_tasks_relatedSubscriptionId_fkey'
  ) THEN
    ALTER TABLE "superadmin_billing_tasks"
    ADD CONSTRAINT "superadmin_billing_tasks_relatedSubscriptionId_fkey"
    FOREIGN KEY ("relatedSubscriptionId") REFERENCES "organization_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_billing_tasks_assignedToId_fkey'
  ) THEN
    ALTER TABLE "superadmin_billing_tasks"
    ADD CONSTRAINT "superadmin_billing_tasks_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_billing_tasks_completedById_fkey'
  ) THEN
    ALTER TABLE "superadmin_billing_tasks"
    ADD CONSTRAINT "superadmin_billing_tasks_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'superadmin_billing_tasks_dismissedById_fkey'
  ) THEN
    ALTER TABLE "superadmin_billing_tasks"
    ADD CONSTRAINT "superadmin_billing_tasks_dismissedById_fkey"
    FOREIGN KEY ("dismissedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_status_priority_idx" ON "superadmin_billing_tasks"("status", "priority");
CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_type_status_idx" ON "superadmin_billing_tasks"("type", "status");
CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_organizationId_status_idx" ON "superadmin_billing_tasks"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_dueDate_idx" ON "superadmin_billing_tasks"("dueDate");
CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_source_type_idx" ON "superadmin_billing_tasks"("source", "type");
CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_relatedContractId_idx" ON "superadmin_billing_tasks"("relatedContractId");
CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_relatedSubscriptionId_idx" ON "superadmin_billing_tasks"("relatedSubscriptionId");
CREATE INDEX IF NOT EXISTS "superadmin_billing_tasks_assignedToId_status_idx" ON "superadmin_billing_tasks"("assignedToId", "status");
