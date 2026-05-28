CREATE TYPE "RevenueCollectionStatus" AS ENUM ('NOT_STARTED', 'NEEDS_FOLLOW_UP', 'CONTACTED', 'PROMISE_TO_PAY', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'ESCALATED', 'SUSPENSION_RECOMMENDED', 'CLOSED', 'WRITTEN_OFF');
CREATE TYPE "PaymentPromiseStatus" AS ENUM ('OPEN', 'KEPT', 'MISSED', 'CANCELLED');
CREATE TYPE "RevenueCollectionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "RevenueCollectionReason" AS ENUM ('INVOICE_OVERDUE', 'INVOICE_DUE_SOON', 'PARTIAL_PAYMENT', 'MULTIPLE_OVERDUE_INVOICES', 'CLIENT_AT_RISK', 'SUBSCRIPTION_PAST_DUE', 'MANUAL_FOLLOW_UP', 'OTHER');
CREATE TYPE "RevenueAgingBucket" AS ENUM ('CURRENT', 'DAYS_1_7', 'DAYS_8_15', 'DAYS_16_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90_PLUS');
CREATE TYPE "RevenueCollectionContactMethod" AS ENUM ('PHONE', 'EMAIL', 'WHATSAPP', 'TELEGRAM', 'IN_PERSON', 'INTERNAL', 'OTHER');
CREATE TYPE "RevenueCollectionEventType" AS ENUM ('COLLECTION_CASE_CREATED', 'COLLECTION_STATUS_CHANGED', 'COLLECTION_PRIORITY_CHANGED', 'COLLECTION_ASSIGNED', 'COLLECTION_NOTE_ADDED', 'CLIENT_CONTACTED', 'PAYMENT_PROMISE_CREATED', 'PAYMENT_PROMISE_KEPT', 'PAYMENT_PROMISE_MISSED', 'PAYMENT_PROMISE_CANCELLED', 'FOLLOW_UP_SCHEDULED', 'TASK_CREATED', 'CASE_ESCALATED', 'CASE_CLOSED', 'INVOICE_MARKED_PAID_LINKED', 'SUSPENSION_RECOMMENDED');

CREATE TABLE "revenue_collection_cases" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "saasInvoiceId" TEXT,
  "saasSubscriptionId" TEXT,
  "status" "RevenueCollectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "priority" "RevenueCollectionPriority" NOT NULL DEFAULT 'NORMAL',
  "reason" "RevenueCollectionReason" NOT NULL,
  "agingBucket" "RevenueAgingBucket" NOT NULL DEFAULT 'CURRENT',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amountDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "dueDate" TIMESTAMP(3),
  "daysOverdue" INTEGER NOT NULL DEFAULT 0,
  "assignedToId" TEXT,
  "lastContactedAt" TIMESTAMP(3),
  "nextFollowUpAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "closeReason" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revenue_collection_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_promises" (
  "id" TEXT NOT NULL,
  "collectionCaseId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "saasInvoiceId" TEXT,
  "promisedAmount" DOUBLE PRECISION NOT NULL,
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "promisedDate" TIMESTAMP(3) NOT NULL,
  "status" "PaymentPromiseStatus" NOT NULL DEFAULT 'OPEN',
  "promisedByName" TEXT,
  "promisedByContact" TEXT,
  "note" TEXT,
  "keptAt" TIMESTAMP(3),
  "missedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_promises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "revenue_collection_notes" (
  "id" TEXT NOT NULL,
  "collectionCaseId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "saasInvoiceId" TEXT,
  "authorUserId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "contactMethod" "RevenueCollectionContactMethod",
  "contactedPerson" TEXT,
  "nextStep" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revenue_collection_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "revenue_collection_events" (
  "id" TEXT NOT NULL,
  "collectionCaseId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "clientAccountId" TEXT,
  "saasInvoiceId" TEXT,
  "actorUserId" TEXT,
  "eventType" "RevenueCollectionEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revenue_collection_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "revenue_collection_cases_associationId_status_idx" ON "revenue_collection_cases"("associationId", "status");
CREATE INDEX "revenue_collection_cases_clientAccountId_status_idx" ON "revenue_collection_cases"("clientAccountId", "status");
CREATE INDEX "revenue_collection_cases_saasInvoiceId_status_idx" ON "revenue_collection_cases"("saasInvoiceId", "status");
CREATE INDEX "revenue_collection_cases_status_priority_nextFollowUpAt_idx" ON "revenue_collection_cases"("status", "priority", "nextFollowUpAt");
CREATE INDEX "revenue_collection_cases_agingBucket_status_idx" ON "revenue_collection_cases"("agingBucket", "status");
CREATE INDEX "revenue_collection_cases_assignedToId_status_nextFollowUpAt_idx" ON "revenue_collection_cases"("assignedToId", "status", "nextFollowUpAt");
CREATE INDEX "payment_promises_collectionCaseId_status_idx" ON "payment_promises"("collectionCaseId", "status");
CREATE INDEX "payment_promises_associationId_status_promisedDate_idx" ON "payment_promises"("associationId", "status", "promisedDate");
CREATE INDEX "payment_promises_clientAccountId_status_promisedDate_idx" ON "payment_promises"("clientAccountId", "status", "promisedDate");
CREATE INDEX "payment_promises_saasInvoiceId_idx" ON "payment_promises"("saasInvoiceId");
CREATE INDEX "revenue_collection_notes_collectionCaseId_createdAt_idx" ON "revenue_collection_notes"("collectionCaseId", "createdAt");
CREATE INDEX "revenue_collection_notes_associationId_createdAt_idx" ON "revenue_collection_notes"("associationId", "createdAt");
CREATE INDEX "revenue_collection_notes_clientAccountId_createdAt_idx" ON "revenue_collection_notes"("clientAccountId", "createdAt");
CREATE INDEX "revenue_collection_notes_saasInvoiceId_createdAt_idx" ON "revenue_collection_notes"("saasInvoiceId", "createdAt");
CREATE INDEX "revenue_collection_events_collectionCaseId_createdAt_idx" ON "revenue_collection_events"("collectionCaseId", "createdAt");
CREATE INDEX "revenue_collection_events_associationId_createdAt_idx" ON "revenue_collection_events"("associationId", "createdAt");
CREATE INDEX "revenue_collection_events_clientAccountId_createdAt_idx" ON "revenue_collection_events"("clientAccountId", "createdAt");
CREATE INDEX "revenue_collection_events_saasInvoiceId_createdAt_idx" ON "revenue_collection_events"("saasInvoiceId", "createdAt");
CREATE INDEX "revenue_collection_events_eventType_createdAt_idx" ON "revenue_collection_events"("eventType", "createdAt");

ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_collectionCaseId_fkey" FOREIGN KEY ("collectionCaseId") REFERENCES "revenue_collection_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revenue_collection_notes" ADD CONSTRAINT "revenue_collection_notes_collectionCaseId_fkey" FOREIGN KEY ("collectionCaseId") REFERENCES "revenue_collection_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revenue_collection_events" ADD CONSTRAINT "revenue_collection_events_collectionCaseId_fkey" FOREIGN KEY ("collectionCaseId") REFERENCES "revenue_collection_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
