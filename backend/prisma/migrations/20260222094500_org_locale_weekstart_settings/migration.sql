-- Ensure organizations has locale/week-start columns required by current schema.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "defaultLocale" TEXT NOT NULL DEFAULT 'ro',
  ADD COLUMN IF NOT EXISTS "weekStart" TEXT NOT NULL DEFAULT 'MONDAY';

-- Ensure organization_settings table exists for persisted org preferences.
CREATE TABLE IF NOT EXISTS "organization_settings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "weekStart" TEXT NOT NULL DEFAULT 'MONDAY',
  "defaultLocale" TEXT NOT NULL DEFAULT 'ro',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- Keep one settings row per organization.
CREATE UNIQUE INDEX IF NOT EXISTS "organization_settings_organizationId_key"
  ON "organization_settings"("organizationId");

CREATE INDEX IF NOT EXISTS "organization_settings_organizationId_idx"
  ON "organization_settings"("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_settings_organizationId_fkey'
  ) THEN
    ALTER TABLE "organization_settings"
      ADD CONSTRAINT "organization_settings_organizationId_fkey"
      FOREIGN KEY ("organizationId")
      REFERENCES "organizations"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
