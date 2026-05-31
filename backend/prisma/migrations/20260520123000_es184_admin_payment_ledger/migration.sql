ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MANUAL_BANK_TRANSFER';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'TERMINAL';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CARD_EXTERNAL';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_STATEMENT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_ACCEPTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REVERSED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentSource') THEN
    CREATE TYPE "PaymentSource" AS ENUM ('PAYMENT_PROOF', 'MANUAL_ENTRY', 'IMPORT', 'ADJUSTMENT', 'SYSTEM');
  END IF;
END $$;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "billingDraftInvoiceId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "residentUserId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "externalReference" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "source" "PaymentSource" NOT NULL DEFAULT 'MANUAL_ENTRY';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paymentProofId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "internalNote" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "acceptedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_billingDraftInvoiceId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_billingDraftInvoiceId_fkey"
      FOREIGN KEY ("billingDraftInvoiceId") REFERENCES "billing_draft_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_residentUserId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_residentUserId_fkey"
      FOREIGN KEY ("residentUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_acceptedById_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_acceptedById_fkey"
      FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_rejectedById_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_reversedById_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_reversedById_fkey"
      FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payments_billingDraftInvoiceId_idx" ON "payments"("billingDraftInvoiceId");
CREATE INDEX IF NOT EXISTS "payments_source_idx" ON "payments"("source");
CREATE INDEX IF NOT EXISTS "payments_paymentProofId_idx" ON "payments"("paymentProofId");
CREATE INDEX IF NOT EXISTS "payments_residentUserId_idx" ON "payments"("residentUserId");
CREATE INDEX IF NOT EXISTS "payments_acceptedById_idx" ON "payments"("acceptedById");
CREATE INDEX IF NOT EXISTS "payments_rejectedById_idx" ON "payments"("rejectedById");
CREATE INDEX IF NOT EXISTS "payments_reversedById_idx" ON "payments"("reversedById");
