-- ES-119: CSV import preview/confirm metadata for apartments and residents.

ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'PARSED';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$ BEGIN
  CREATE TYPE "ImportMode" AS ENUM ('CREATE_ONLY', 'UPSERT_SAFE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImportRowStatus" AS ENUM ('VALID', 'WARNING', 'ERROR', 'SKIPPED', 'IMPORTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImportRowOperation" AS ENUM ('CREATE', 'UPDATE', 'LINK', 'SKIP', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "import_jobs"
  ADD COLUMN IF NOT EXISTS "mode" "ImportMode" NOT NULL DEFAULT 'CREATE_ONLY',
  ADD COLUMN IF NOT EXISTS "delimiter" TEXT NOT NULL DEFAULT ';',
  ADD COLUMN IF NOT EXISTS "warningRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "errorRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updatedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "skippedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "errorsCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "warningsCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "options" JSONB,
  ADD COLUMN IF NOT EXISTS "summary" JSONB,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "import_rows" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "status" "ImportRowStatus" NOT NULL,
  "operation" "ImportRowOperation" NOT NULL DEFAULT 'NONE',
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "errors" JSONB,
  "warnings" JSONB,
  "createdEntityId" TEXT,
  "updatedEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_importJobId_fkey"
    FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "import_jobs_organizationId_type_status_createdAt_idx"
  ON "import_jobs"("organizationId", "type", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "import_rows_organizationId_createdAt_idx"
  ON "import_rows"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "import_rows_importJobId_rowNumber_idx"
  ON "import_rows"("importJobId", "rowNumber");
CREATE INDEX IF NOT EXISTS "import_rows_importJobId_status_idx"
  ON "import_rows"("importJobId", "status");
