-- ES-128 Admin Staff Invitations & Internal User Onboarding

ALTER TYPE "OrganizationMemberStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "OrganizationMemberStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

CREATE TYPE "StaffInvitationStatus" AS ENUM ('DRAFT', 'PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'REVOKED');
CREATE TYPE "StaffInvitationDeliveryMethod" AS ENUM ('COPY_LINK', 'EMAIL_PLACEHOLDER', 'MANUAL');

ALTER TABLE "organization_members"
  ADD COLUMN "invitedAt" TIMESTAMP(3),
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedById" TEXT,
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedById" TEXT,
  ADD COLUMN "revokeReason" TEXT,
  ADD COLUMN "createdById" TEXT;

CREATE TABLE "association_staff_invitations" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "invitedEmail" TEXT NOT NULL,
  "invitedFullName" TEXT,
  "invitedPhone" TEXT,
  "roleId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPreview" TEXT,
  "status" "StaffInvitationStatus" NOT NULL DEFAULT 'PENDING',
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
  "deliveryMethod" "StaffInvitationDeliveryMethod" NOT NULL DEFAULT 'COPY_LINK',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "association_staff_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "association_staff_invitations_tokenHash_key" ON "association_staff_invitations"("tokenHash");
CREATE INDEX "association_staff_invitations_associationId_status_expiresAt_idx" ON "association_staff_invitations"("associationId", "status", "expiresAt");
CREATE INDEX "association_staff_invitations_associationId_invitedEmail_idx" ON "association_staff_invitations"("associationId", "invitedEmail");
CREATE INDEX "association_staff_invitations_roleId_idx" ON "association_staff_invitations"("roleId");
CREATE INDEX "association_staff_invitations_createdById_createdAt_idx" ON "association_staff_invitations"("createdById", "createdAt");
CREATE INDEX "organization_members_createdById_createdAt_idx" ON "organization_members"("createdById", "createdAt");
CREATE INDEX "organization_members_suspendedById_suspendedAt_idx" ON "organization_members"("suspendedById", "suspendedAt");
CREATE INDEX "organization_members_revokedById_revokedAt_idx" ON "organization_members"("revokedById", "revokedAt");

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_members_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_members_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "association_staff_invitations"
  ADD CONSTRAINT "association_staff_invitations_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "association_staff_invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "association_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "association_staff_invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "association_staff_invitations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "association_staff_invitations_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "association_staff_invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
