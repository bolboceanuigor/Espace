-- CreateEnum
CREATE TYPE "PasswordResetRequestStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuthSecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED_NO_PORTAL_ACCESS', 'LOGIN_BLOCKED_SUSPENDED', 'LOGIN_BLOCKED_REVOKED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_USED', 'PASSWORD_RESET_FAILED', 'INVITATION_ACCEPTED_LOGIN_READY', 'SESSION_EXPIRED', 'LOGOUT');

-- CreateEnum
CREATE TYPE "AuthSecurityEventSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "password_reset_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT,
    "status" "PasswordResetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "requestedIp" TEXT,
    "requestedUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "eventType" "AuthSecurityEventType" NOT NULL,
    "severity" "AuthSecurityEventSeverity" NOT NULL DEFAULT 'INFO',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_requests_tokenHash_key" ON "password_reset_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_requests_userId_status_createdAt_idx" ON "password_reset_requests"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "password_reset_requests_email_createdAt_idx" ON "password_reset_requests"("email", "createdAt");

-- CreateIndex
CREATE INDEX "password_reset_requests_status_expiresAt_idx" ON "password_reset_requests"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "auth_security_events_userId_createdAt_idx" ON "auth_security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "auth_security_events_email_createdAt_idx" ON "auth_security_events"("email", "createdAt");

-- CreateIndex
CREATE INDEX "auth_security_events_eventType_createdAt_idx" ON "auth_security_events"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_security_events" ADD CONSTRAINT "auth_security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
