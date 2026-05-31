-- AlterTable
ALTER TABLE "billing_draft_invoices"
ADD COLUMN "publicNote" TEXT,
ADD COLUMN "internalNote" TEXT,
ADD COLUMN "viewedAt" TIMESTAMP(3),
ADD COLUMN "residentNotifiedAt" TIMESTAMP(3),
ADD COLUMN "publishedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "billing_draft_invoices_organizationId_invoiceNumber_key" ON "billing_draft_invoices"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "billing_draft_invoices_publishedById_idx" ON "billing_draft_invoices"("publishedById");

-- AddForeignKey
ALTER TABLE "billing_draft_invoices" ADD CONSTRAINT "billing_draft_invoices_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
