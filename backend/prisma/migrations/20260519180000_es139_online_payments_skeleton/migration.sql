-- ES-139 online payments planning and payment intent skeleton.
CREATE TYPE "OnlinePaymentProviderType" AS ENUM ('BPAY', 'BANK_CARD', 'PAYNET', 'MAIB', 'VICTORIABANK', 'MICB', 'STRIPE', 'CUSTOM', 'MANUAL_TEST');
CREATE TYPE "OnlinePaymentProviderStatus" AS ENUM ('DRAFT', 'DISABLED', 'TESTING', 'ACTIVE', 'ERROR', 'ARCHIVED');
CREATE TYPE "OnlinePaymentProviderMode" AS ENUM ('TEST', 'LIVE');
CREATE TYPE "OnlinePaymentConfigStatus" AS ENUM ('NOT_CONFIGURED', 'PARTIAL', 'CONFIGURED');
CREATE TYPE "PaymentIntentSource" AS ENUM ('RESIDENT_PORTAL', 'ADMIN_CREATED', 'SYSTEM', 'TEST');
CREATE TYPE "PaymentMethodType" AS ENUM ('ONLINE_CARD', 'BPAY', 'BANK_TRANSFER_REDIRECT', 'QR_CODE', 'TEST_METHOD');
CREATE TYPE "PaymentIntentEventType" AS ENUM ('INTENT_CREATED', 'INTENT_INITIALIZED', 'INTENT_PROVIDER_PENDING', 'INTENT_REQUIRES_ACTION', 'INTENT_PROCESSING', 'INTENT_SUCCEEDED_TEST', 'INTENT_FAILED', 'INTENT_CANCELLED', 'INTENT_EXPIRED', 'WEBHOOK_RECEIVED', 'WEBHOOK_IGNORED', 'NOTE_ADDED');
CREATE TYPE "PaymentWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

ALTER TYPE "PaymentIntentStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "PaymentIntentStatus" ADD VALUE IF NOT EXISTS 'PENDING_PROVIDER';
ALTER TYPE "PaymentIntentStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_ACTION';
ALTER TYPE "PaymentIntentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentIntentStatus" ADD VALUE IF NOT EXISTS 'SUCCEEDED';

CREATE TABLE "online_payment_providers" (
  "id" TEXT NOT NULL,
  "type" "OnlinePaymentProviderType" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "OnlinePaymentProviderStatus" NOT NULL DEFAULT 'DRAFT',
  "mode" "OnlinePaymentProviderMode" NOT NULL DEFAULT 'TEST',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "supportsCards" BOOLEAN NOT NULL DEFAULT false,
  "supportsBpay" BOOLEAN NOT NULL DEFAULT false,
  "supportsQr" BOOLEAN NOT NULL DEFAULT false,
  "supportsRedirect" BOOLEAN NOT NULL DEFAULT false,
  "supportsWebhooks" BOOLEAN NOT NULL DEFAULT false,
  "configStatus" "OnlinePaymentConfigStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "publicConfig" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "online_payment_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "association_payment_settings" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "onlinePaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "providerId" TEXT,
  "allowResidentOnlinePayments" BOOLEAN NOT NULL DEFAULT false,
  "allowPartialOnlinePayments" BOOLEAN NOT NULL DEFAULT false,
  "minPaymentAmount" DOUBLE PRECISION,
  "maxPaymentAmount" DOUBLE PRECISION,
  "defaultCurrency" "BillingCurrency" NOT NULL DEFAULT 'MDL',
  "paymentInstructions" TEXT,
  "testModeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "association_payment_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payment_intents" ADD COLUMN "residentId" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "providerId" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "providerType" "OnlinePaymentProviderType";
ALTER TABLE "payment_intents" ADD COLUMN "source" "PaymentIntentSource";
ALTER TABLE "payment_intents" ADD COLUMN "paymentMethodType" "PaymentMethodType";
ALTER TABLE "payment_intents" ADD COLUMN "providerIntentId" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "providerCheckoutUrl" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "providerReference" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "description" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "payment_intents" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "payment_intents" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "failedAt" TIMESTAMP(3);
ALTER TABLE "payment_intents" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN "succeededAt" TIMESTAMP(3);

CREATE TABLE "payment_intent_events" (
  "id" TEXT NOT NULL,
  "paymentIntentId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "PaymentIntentEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_intent_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_webhook_events" (
  "id" TEXT NOT NULL,
  "providerType" "OnlinePaymentProviderType" NOT NULL,
  "providerEventId" TEXT,
  "paymentIntentId" TEXT,
  "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "rawPayload" JSONB,
  "headers" JSONB,
  "signatureValid" BOOLEAN,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_payment_providers_code_key" ON "online_payment_providers"("code");
CREATE INDEX "online_payment_providers_type_idx" ON "online_payment_providers"("type");
CREATE INDEX "online_payment_providers_status_mode_idx" ON "online_payment_providers"("status", "mode");
CREATE INDEX "online_payment_providers_isDefault_idx" ON "online_payment_providers"("isDefault");
CREATE UNIQUE INDEX "association_payment_settings_associationId_key" ON "association_payment_settings"("associationId");
CREATE INDEX "association_payment_settings_providerId_idx" ON "association_payment_settings"("providerId");
CREATE INDEX "association_payment_settings_onlinePaymentsEnabled_idx" ON "association_payment_settings"("onlinePaymentsEnabled");
CREATE UNIQUE INDEX "payment_intents_idempotencyKey_key" ON "payment_intents"("idempotencyKey");
CREATE INDEX "payment_intents_residentId_idx" ON "payment_intents"("residentId");
CREATE INDEX "payment_intents_providerId_idx" ON "payment_intents"("providerId");
CREATE INDEX "payment_intents_providerType_idx" ON "payment_intents"("providerType");
CREATE INDEX "payment_intents_source_idx" ON "payment_intents"("source");
CREATE INDEX "payment_intent_events_paymentIntentId_createdAt_idx" ON "payment_intent_events"("paymentIntentId", "createdAt");
CREATE INDEX "payment_intent_events_associationId_createdAt_idx" ON "payment_intent_events"("associationId", "createdAt");
CREATE INDEX "payment_intent_events_eventType_createdAt_idx" ON "payment_intent_events"("eventType", "createdAt");
CREATE INDEX "payment_webhook_events_providerType_receivedAt_idx" ON "payment_webhook_events"("providerType", "receivedAt");
CREATE INDEX "payment_webhook_events_providerEventId_idx" ON "payment_webhook_events"("providerEventId");
CREATE INDEX "payment_webhook_events_paymentIntentId_idx" ON "payment_webhook_events"("paymentIntentId");
CREATE INDEX "payment_webhook_events_status_receivedAt_idx" ON "payment_webhook_events"("status", "receivedAt");

ALTER TABLE "online_payment_providers" ADD CONSTRAINT "online_payment_providers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "online_payment_providers" ADD CONSTRAINT "online_payment_providers_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "association_payment_settings" ADD CONSTRAINT "association_payment_settings_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "association_payment_settings" ADD CONSTRAINT "association_payment_settings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "online_payment_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "association_payment_settings" ADD CONSTRAINT "association_payment_settings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "association_payment_settings" ADD CONSTRAINT "association_payment_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "online_payment_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_intent_events" ADD CONSTRAINT "payment_intent_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
