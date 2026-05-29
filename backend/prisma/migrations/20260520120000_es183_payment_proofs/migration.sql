CREATE TYPE "PaymentProofStatus" AS ENUM (
  'SUBMITTED',
  'IN_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'PARTIALLY_ACCEPTED',
  'CANCELLED'
);

CREATE TABLE "payment_proofs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "apartmentId" TEXT NOT NULL,
  "residentUserId" TEXT NOT NULL,
  "paymentId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentProofStatus" NOT NULL DEFAULT 'SUBMITTED',
  "proofFileUrl" TEXT,
  "proofFileName" TEXT,
  "proofFileMimeType" TEXT,
  "proofFileSize" INTEGER,
  "externalReference" TEXT,
  "paidAt" TIMESTAMP(3),
  "residentNote" TEXT,
  "adminNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "acceptedAmount" DOUBLE PRECISION,
  "rejectionReason" TEXT,
  "possibleDuplicate" BOOLEAN NOT NULL DEFAULT false,
  "duplicatePaymentProofId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_proofs_paymentId_key" ON "payment_proofs"("paymentId");
CREATE INDEX "payment_proofs_organizationId_status_createdAt_idx" ON "payment_proofs"("organizationId", "status", "createdAt");
CREATE INDEX "payment_proofs_organizationId_invoiceId_idx" ON "payment_proofs"("organizationId", "invoiceId");
CREATE INDEX "payment_proofs_apartmentId_idx" ON "payment_proofs"("apartmentId");
CREATE INDEX "payment_proofs_residentUserId_idx" ON "payment_proofs"("residentUserId");
CREATE INDEX "payment_proofs_paymentId_idx" ON "payment_proofs"("paymentId");
CREATE INDEX "payment_proofs_reviewedById_idx" ON "payment_proofs"("reviewedById");
CREATE INDEX "payment_proofs_paidAt_idx" ON "payment_proofs"("paidAt");

ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "billing_draft_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_residentUserId_fkey" FOREIGN KEY ("residentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
