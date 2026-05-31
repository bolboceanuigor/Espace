-- CreateEnum
CREATE TYPE "BillingPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UtilityTariffType" AS ENUM ('COLD_WATER', 'HOT_WATER', 'ELECTRICITY', 'GAS', 'HEATING', 'MAINTENANCE', 'ELEVATOR', 'REPAIR_FUND', 'INVESTMENT_FUND', 'OTHER');

-- CreateEnum
CREATE TYPE "UtilityTariffUnit" AS ENUM ('M3', 'KWH', 'GJ', 'M2', 'APARTMENT', 'PERSON', 'FIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingDraftInvoiceStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "billing_periods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "BillingPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "meterReadingPeriodId" TEXT,
    "title" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utility_tariffs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingPeriodId" TEXT,
    "type" "UtilityTariffType" NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "UtilityTariffUnit" NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_draft_invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "residentId" TEXT,
    "ownerId" TEXT,
    "invoiceNumber" TEXT,
    "status" "BillingDraftInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
    "dueDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_draft_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_draft_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apartmentId" TEXT,
    "meterId" TEXT,
    "meterReadingId" TEXT,
    "type" "UtilityTariffType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_draft_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_periods_organizationId_status_createdAt_idx" ON "billing_periods"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "billing_periods_meterReadingPeriodId_idx" ON "billing_periods"("meterReadingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_organizationId_year_month_key" ON "billing_periods"("organizationId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "utility_tariffs_billingPeriodId_type_key" ON "utility_tariffs"("billingPeriodId", "type");

-- CreateIndex
CREATE INDEX "utility_tariffs_organizationId_billingPeriodId_idx" ON "utility_tariffs"("organizationId", "billingPeriodId");

-- CreateIndex
CREATE INDEX "utility_tariffs_organizationId_type_isActive_idx" ON "utility_tariffs"("organizationId", "type", "isActive");

-- CreateIndex
CREATE INDEX "billing_draft_invoices_organizationId_status_updatedAt_idx" ON "billing_draft_invoices"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "billing_draft_invoices_apartmentId_idx" ON "billing_draft_invoices"("apartmentId");

-- CreateIndex
CREATE INDEX "billing_draft_invoices_residentId_idx" ON "billing_draft_invoices"("residentId");

-- CreateIndex
CREATE INDEX "billing_draft_invoices_ownerId_idx" ON "billing_draft_invoices"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_draft_invoices_billingPeriodId_apartmentId_key" ON "billing_draft_invoices"("billingPeriodId", "apartmentId");

-- CreateIndex
CREATE INDEX "billing_draft_invoice_lines_invoiceId_idx" ON "billing_draft_invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX "billing_draft_invoice_lines_organizationId_idx" ON "billing_draft_invoice_lines"("organizationId");

-- CreateIndex
CREATE INDEX "billing_draft_invoice_lines_apartmentId_idx" ON "billing_draft_invoice_lines"("apartmentId");

-- CreateIndex
CREATE INDEX "billing_draft_invoice_lines_meterId_idx" ON "billing_draft_invoice_lines"("meterId");

-- CreateIndex
CREATE INDEX "billing_draft_invoice_lines_meterReadingId_idx" ON "billing_draft_invoice_lines"("meterReadingId");

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_meterReadingPeriodId_fkey" FOREIGN KEY ("meterReadingPeriodId") REFERENCES "meter_reading_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_tariffs" ADD CONSTRAINT "utility_tariffs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_tariffs" ADD CONSTRAINT "utility_tariffs_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "billing_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoices" ADD CONSTRAINT "billing_draft_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoices" ADD CONSTRAINT "billing_draft_invoices_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "billing_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoices" ADD CONSTRAINT "billing_draft_invoices_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoices" ADD CONSTRAINT "billing_draft_invoices_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoices" ADD CONSTRAINT "billing_draft_invoices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "resident_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoices" ADD CONSTRAINT "billing_draft_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoice_lines" ADD CONSTRAINT "billing_draft_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "billing_draft_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoice_lines" ADD CONSTRAINT "billing_draft_invoice_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoice_lines" ADD CONSTRAINT "billing_draft_invoice_lines_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoice_lines" ADD CONSTRAINT "billing_draft_invoice_lines_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_draft_invoice_lines" ADD CONSTRAINT "billing_draft_invoice_lines_meterReadingId_fkey" FOREIGN KEY ("meterReadingId") REFERENCES "meter_readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
