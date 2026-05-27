CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');
CREATE TYPE "NotificationProviderType" AS ENUM ('CONSOLE', 'SMTP', 'RESEND', 'SENDGRID', 'MAILGUN', 'TWILIO', 'CUSTOM_HTTP', 'DISABLED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "TransactionalNotificationType" AS ENUM ('RESIDENT_PORTAL_INVITATION', 'STAFF_INVITATION', 'PASSWORD_RESET', 'RESIDENT_INVOICE_ISSUED', 'RESIDENT_PAYMENT_RECORDED', 'RESIDENT_PAYMENT_CANCELLED', 'ANNOUNCEMENT_PUBLISHED', 'ANNOUNCEMENT_URGENT', 'REQUEST_ADMIN_REPLY', 'REQUEST_STATUS_CHANGED', 'METER_READING_APPROVED', 'METER_READING_REJECTED', 'PROFILE_UPDATE_APPROVED', 'PROFILE_UPDATE_REJECTED', 'SAAS_INVOICE_ISSUED', 'SAAS_INVOICE_OVERDUE', 'SAAS_UPGRADE_REQUEST_APPROVED', 'SAAS_UPGRADE_REQUEST_REJECTED', 'SYSTEM_SECURITY_ALERT');
CREATE TYPE "NotificationTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

ALTER TABLE "organization_settings" ADD COLUMN "notificationSettings" JSONB;

CREATE TABLE "notification_templates" (
  "id" TEXT NOT NULL,
  "type" "TransactionalNotificationType" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'ro',
  "name" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "smsBody" TEXT,
  "variables" JSONB,
  "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "associationId" TEXT,
  "recipientUserId" TEXT,
  "recipientResidentId" TEXT,
  "recipientEmail" TEXT,
  "recipientPhone" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "type" "TransactionalNotificationType" NOT NULL,
  "providerType" "NotificationProviderType" NOT NULL,
  "templateId" TEXT,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "reasonCode" TEXT,
  "subject" TEXT,
  "bodyPreview" TEXT,
  "providerMessageId" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "queuedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_templates_type_channel_locale_status_idx" ON "notification_templates"("type", "channel", "locale", "status");
CREATE INDEX "notification_templates_status_updatedAt_idx" ON "notification_templates"("status", "updatedAt");
CREATE INDEX "notification_deliveries_associationId_createdAt_idx" ON "notification_deliveries"("associationId", "createdAt");
CREATE INDEX "notification_deliveries_recipientUserId_createdAt_idx" ON "notification_deliveries"("recipientUserId", "createdAt");
CREATE INDEX "notification_deliveries_recipientResidentId_createdAt_idx" ON "notification_deliveries"("recipientResidentId", "createdAt");
CREATE INDEX "notification_deliveries_channel_status_createdAt_idx" ON "notification_deliveries"("channel", "status", "createdAt");
CREATE INDEX "notification_deliveries_type_relatedEntityType_relatedEntityId_idx" ON "notification_deliveries"("type", "relatedEntityType", "relatedEntityId");
CREATE INDEX "notification_deliveries_providerType_status_idx" ON "notification_deliveries"("providerType", "status");

ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipientResidentId_fkey" FOREIGN KEY ("recipientResidentId") REFERENCES "resident_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
