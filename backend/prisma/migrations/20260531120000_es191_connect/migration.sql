CREATE TYPE "ConnectConversationType" AS ENUM (
  'GENERAL',
  'APARTMENT',
  'INVOICE',
  'PAYMENT',
  'PAYMENT_PROOF',
  'METER_READING',
  'SERVICE_TICKET',
  'DOCUMENT',
  'ANNOUNCEMENT',
  'SYSTEM'
);

CREATE TYPE "ConnectConversationStatus" AS ENUM (
  'OPEN',
  'PENDING_RESIDENT',
  'PENDING_ADMIN',
  'RESOLVED',
  'CLOSED',
  'ARCHIVED'
);

CREATE TYPE "ConnectPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

CREATE TYPE "ConnectSenderRole" AS ENUM (
  'ADMIN',
  'RESIDENT',
  'SUPERADMIN',
  'SYSTEM'
);

CREATE TYPE "ConnectMessageType" AS ENUM (
  'TEXT',
  'SYSTEM',
  'ATTACHMENT',
  'IMAGE',
  'DOCUMENT'
);

CREATE TYPE "ConnectMessageStatus" AS ENUM (
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED'
);

CREATE TABLE "connect_conversations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "apartmentId" TEXT,
  "residentUserId" TEXT,
  "adminUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "subject" TEXT,
  "type" "ConnectConversationType" NOT NULL DEFAULT 'GENERAL',
  "status" "ConnectConversationStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ConnectPriority" NOT NULL DEFAULT 'NORMAL',
  "relatedInvoiceId" TEXT,
  "relatedPaymentProofId" TEXT,
  "relatedMeterReadingId" TEXT,
  "relatedServiceTicketId" TEXT,
  "relatedDocumentId" TEXT,
  "relatedAnnouncementId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastMessagePreview" TEXT,
  "lastMessageById" TEXT,
  "adminUnreadCount" INTEGER NOT NULL DEFAULT 0,
  "residentUnreadCount" INTEGER NOT NULL DEFAULT 0,
  "closedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "internalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "connect_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "senderId" TEXT,
  "senderRole" "ConnectSenderRole" NOT NULL,
  "messageType" "ConnectMessageType" NOT NULL DEFAULT 'TEXT',
  "body" TEXT,
  "attachmentUrl" TEXT,
  "attachmentFileName" TEXT,
  "attachmentMimeType" TEXT,
  "attachmentFileSize" INTEGER,
  "status" "ConnectMessageStatus" NOT NULL DEFAULT 'SENT',
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "connect_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connect_conversations_organizationId_status_lastMessageAt_idx" ON "connect_conversations"("organizationId", "status", "lastMessageAt");
CREATE INDEX "connect_conversations_organizationId_type_priority_idx" ON "connect_conversations"("organizationId", "type", "priority");
CREATE INDEX "connect_conversations_organizationId_residentUserId_idx" ON "connect_conversations"("organizationId", "residentUserId");
CREATE INDEX "connect_conversations_organizationId_adminUserId_idx" ON "connect_conversations"("organizationId", "adminUserId");
CREATE INDEX "connect_conversations_apartmentId_idx" ON "connect_conversations"("apartmentId");
CREATE INDEX "connect_conversations_relatedInvoiceId_idx" ON "connect_conversations"("relatedInvoiceId");
CREATE INDEX "connect_conversations_relatedPaymentProofId_idx" ON "connect_conversations"("relatedPaymentProofId");
CREATE INDEX "connect_conversations_relatedMeterReadingId_idx" ON "connect_conversations"("relatedMeterReadingId");
CREATE INDEX "connect_conversations_relatedServiceTicketId_idx" ON "connect_conversations"("relatedServiceTicketId");
CREATE INDEX "connect_conversations_relatedDocumentId_idx" ON "connect_conversations"("relatedDocumentId");
CREATE INDEX "connect_conversations_relatedAnnouncementId_idx" ON "connect_conversations"("relatedAnnouncementId");
CREATE INDEX "connect_messages_organizationId_conversationId_createdAt_idx" ON "connect_messages"("organizationId", "conversationId", "createdAt");
CREATE INDEX "connect_messages_conversationId_messageType_createdAt_idx" ON "connect_messages"("conversationId", "messageType", "createdAt");
CREATE INDEX "connect_messages_senderId_idx" ON "connect_messages"("senderId");

ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_residentUserId_fkey" FOREIGN KEY ("residentUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_lastMessageById_fkey" FOREIGN KEY ("lastMessageById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_messages" ADD CONSTRAINT "connect_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "connect_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_messages" ADD CONSTRAINT "connect_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_messages" ADD CONSTRAINT "connect_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
