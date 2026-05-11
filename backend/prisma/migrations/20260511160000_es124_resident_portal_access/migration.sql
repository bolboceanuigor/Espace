-- ES-124 Resident Portal Access & Invitations

CREATE TYPE "ResidentPortalAccessStatus" AS ENUM ('NO_ACCESS', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "ResidentPortalInvitationStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'REVOKED');
CREATE TYPE "ResidentPortalInvitationDeliveryMethod" AS ENUM ('COPY_LINK', 'EMAIL_PLACEHOLDER', 'SMS_PLACEHOLDER', 'MANUAL');

ALTER TABLE "resident_profiles"
  ADD COLUMN "portalAccessStatus" "ResidentPortalAccessStatus",
  ADD COLUMN "portalAccessActivatedAt" TIMESTAMP(3),
  ADD COLUMN "portalAccessRevokedAt" TIMESTAMP(3),
  ADD COLUMN "portalAccessRevokedById" TEXT;

CREATE TABLE "resident_portal_invitations" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "residentId" TEXT NOT NULL,
  "apartmentId" TEXT,
  "invitedEmail" TEXT,
  "invitedPhone" TEXT,
  "tokenHash" TEXT NOT NULL,
  "tokenPreview" TEXT,
  "status" "ResidentPortalInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedByUserId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokeReason" TEXT,
  "createdById" TEXT NOT NULL,
  "lastSentAt" TIMESTAMP(3),
  "sendCount" INTEGER NOT NULL DEFAULT 0,
  "deliveryMethod" "ResidentPortalInvitationDeliveryMethod" NOT NULL DEFAULT 'COPY_LINK',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resident_portal_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resident_portal_invitations_tokenHash_key" ON "resident_portal_invitations"("tokenHash");
CREATE INDEX "resident_portal_invitations_associationId_status_expiresAt_idx" ON "resident_portal_invitations"("associationId", "status", "expiresAt");
CREATE INDEX "resident_portal_invitations_residentId_createdAt_idx" ON "resident_portal_invitations"("residentId", "createdAt");
CREATE INDEX "resident_portal_invitations_apartmentId_idx" ON "resident_portal_invitations"("apartmentId");
CREATE INDEX "resident_portal_invitations_createdById_createdAt_idx" ON "resident_portal_invitations"("createdById", "createdAt");
CREATE INDEX "resident_profiles_portalAccessStatus_idx" ON "resident_profiles"("portalAccessStatus");
CREATE INDEX "resident_profiles_portalAccessRevokedById_idx" ON "resident_profiles"("portalAccessRevokedById");

ALTER TABLE "resident_profiles"
  ADD CONSTRAINT "resident_profiles_portalAccessRevokedById_fkey" FOREIGN KEY ("portalAccessRevokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "resident_portal_invitations"
  ADD CONSTRAINT "resident_portal_invitations_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "resident_portal_invitations_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "resident_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "resident_portal_invitations_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "resident_portal_invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "resident_portal_invitations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "resident_portal_invitations_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "resident_portal_invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
