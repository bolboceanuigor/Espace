-- ES-150: Admin Saved Views, Filters & Smart Lists

CREATE TYPE "SavedViewModule" AS ENUM (
  'APARTMENTS',
  'RESIDENTS',
  'INVOICES',
  'PAYMENTS',
  'METERS',
  'METER_READINGS',
  'REQUESTS',
  'ANNOUNCEMENTS',
  'DATA_QUALITY',
  'AUDIT_LOG',
  'IMPORTS',
  'EXPORTS',
  'FINANCIAL_REPORTS',
  'TEAM_ACTIVITY',
  'SAAS_SUBSCRIPTION',
  'OTHER'
);

CREATE TYPE "SavedViewScope" AS ENUM ('PERSONAL', 'TEAM', 'SYSTEM');
CREATE TYPE "SavedViewStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SavedViewDensity" AS ENUM ('COMPACT', 'COMFORTABLE', 'SPACIOUS');

CREATE TABLE "saved_views" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "module" "SavedViewModule" NOT NULL,
  "scope" "SavedViewScope" NOT NULL,
  "status" "SavedViewStatus" NOT NULL DEFAULT 'ACTIVE',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL,
  "sort" JSONB,
  "columns" JSONB,
  "density" "SavedViewDensity",
  "searchQuery" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "smartListKey" TEXT,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_module_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "module" "SavedViewModule" NOT NULL,
  "defaultSavedViewId" TEXT,
  "columns" JSONB,
  "density" "SavedViewDensity",
  "pageSize" INTEGER,
  "sort" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_module_preferences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_views_associationId_module_status_idx" ON "saved_views"("associationId", "module", "status");
CREATE INDEX "saved_views_associationId_scope_isFavorite_idx" ON "saved_views"("associationId", "scope", "isFavorite");
CREATE INDEX "saved_views_createdById_module_idx" ON "saved_views"("createdById", "module");
CREATE INDEX "saved_views_smartListKey_idx" ON "saved_views"("smartListKey");
CREATE UNIQUE INDEX "user_module_preferences_userId_associationId_module_key" ON "user_module_preferences"("userId", "associationId", "module");
CREATE INDEX "user_module_preferences_associationId_module_idx" ON "user_module_preferences"("associationId", "module");
CREATE INDEX "user_module_preferences_defaultSavedViewId_idx" ON "user_module_preferences"("defaultSavedViewId");

ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_module_preferences" ADD CONSTRAINT "user_module_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_module_preferences" ADD CONSTRAINT "user_module_preferences_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_module_preferences" ADD CONSTRAINT "user_module_preferences_defaultSavedViewId_fkey" FOREIGN KEY ("defaultSavedViewId") REFERENCES "saved_views"("id") ON DELETE SET NULL ON UPDATE CASCADE;
