DO $$ BEGIN
  CREATE TYPE "AdminHandoverStatus" AS ENUM ('NOT_STARTED', 'INVITED', 'ACCEPTED', 'FIRST_LOGIN_DONE', 'ACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "SuperadminNotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_INVITATION_ACCEPTED';
ALTER TYPE "SuperadminNotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_FIRST_LOGIN_COMPLETED';

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "adminHandoverStatus" "AdminHandoverStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "adminInvitedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "adminAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "adminFirstLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "adminHandoverNote" TEXT,
  ADD COLUMN IF NOT EXISTS "adminFirstLoginChecklistJson" JSONB;

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptedUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "invitations_tokenHash_key" ON "invitations"("tokenHash");
CREATE INDEX IF NOT EXISTS "invitations_role_status_createdAt_idx" ON "invitations"("role", "status", "createdAt");

ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_acceptedUserId_fkey";
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_acceptedUserId_fkey"
  FOREIGN KEY ("acceptedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
