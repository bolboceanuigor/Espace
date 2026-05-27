CREATE TYPE "SaasInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID');
CREATE TYPE "SaasInvoiceLineType" AS ENUM ('SUBSCRIPTION_FEE', 'PLAN_UPGRADE', 'PLAN_DOWNGRADE_CREDIT', 'DISCOUNT', 'MANUAL_ADJUSTMENT', 'SETUP_FEE', 'OTHER');
CREATE TYPE "SaasInvoiceSource" AS ENUM ('MANUAL', 'SUBSCRIPTION', 'UPGRADE_REQUEST', 'SYSTEM');
CREATE TYPE "SaasInvoiceEventType" AS ENUM ('INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_ISSUED', 'INVOICE_MARKED_PARTIALLY_PAID', 'INVOICE_MARKED_PAID', 'INVOICE_CANCELLED', 'INVOICE_VOIDED', 'INVOICE_OVERDUE_MARKED', 'INTERNAL_NOTE_ADDED');

CREATE TABLE "saas_invoices" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "planId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "billingPeriodStart" TIMESTAMP(3) NOT NULL,
  "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
  "billingMonth" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "SaasInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "internalNotes" TEXT,
  "source" "SaasInvoiceSource" NOT NULL DEFAULT 'MANUAL',
  "sourceUpgradeRequestId" TEXT,
  "issuedAt" TIMESTAMP(3),
  "issuedById" TEXT,
  "paidAt" TIMESTAMP(3),
  "markedPaidById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidedById" TEXT,
  "voidReason" TEXT,
  "duplicateReason" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saas_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_invoice_lines" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "lineType" "SaasInvoiceLineType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "planId" TEXT,
  "subscriptionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saas_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_invoice_events" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "SaasInvoiceEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_invoice_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saas_invoices_invoiceNumber_key" ON "saas_invoices"("invoiceNumber");
CREATE INDEX "saas_invoices_associationId_status_createdAt_idx" ON "saas_invoices"("associationId", "status", "createdAt");
CREATE INDEX "saas_invoices_subscriptionId_billingPeriodStart_billingPeriodEnd_idx" ON "saas_invoices"("subscriptionId", "billingPeriodStart", "billingPeriodEnd");
CREATE INDEX "saas_invoices_planId_idx" ON "saas_invoices"("planId");
CREATE INDEX "saas_invoices_billingMonth_idx" ON "saas_invoices"("billingMonth");
CREATE INDEX "saas_invoices_status_dueDate_idx" ON "saas_invoices"("status", "dueDate");
CREATE INDEX "saas_invoices_sourceUpgradeRequestId_idx" ON "saas_invoices"("sourceUpgradeRequestId");
CREATE INDEX "saas_invoice_lines_invoiceId_idx" ON "saas_invoice_lines"("invoiceId");
CREATE INDEX "saas_invoice_lines_planId_idx" ON "saas_invoice_lines"("planId");
CREATE INDEX "saas_invoice_lines_subscriptionId_idx" ON "saas_invoice_lines"("subscriptionId");
CREATE INDEX "saas_invoice_events_invoiceId_createdAt_idx" ON "saas_invoice_events"("invoiceId", "createdAt");
CREATE INDEX "saas_invoice_events_associationId_createdAt_idx" ON "saas_invoice_events"("associationId", "createdAt");
CREATE INDEX "saas_invoice_events_eventType_createdAt_idx" ON "saas_invoice_events"("eventType", "createdAt");

ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_sourceUpgradeRequestId_fkey" FOREIGN KEY ("sourceUpgradeRequestId") REFERENCES "saas_upgrade_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_markedPaidById_fkey" FOREIGN KEY ("markedPaidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoice_lines" ADD CONSTRAINT "saas_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "saas_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_invoice_lines" ADD CONSTRAINT "saas_invoice_lines_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoice_lines" ADD CONSTRAINT "saas_invoice_lines_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saas_invoice_events" ADD CONSTRAINT "saas_invoice_events_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "saas_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_invoice_events" ADD CONSTRAINT "saas_invoice_events_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_invoice_events" ADD CONSTRAINT "saas_invoice_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
