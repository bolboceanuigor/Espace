-- ES-142 Help Center and onboarding docs.
CREATE TYPE "HelpAudience" AS ENUM ('PUBLIC', 'SUPERADMIN', 'ADMIN', 'STAFF', 'RESIDENT');
CREATE TYPE "HelpArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "HelpArticleType" AS ENUM ('GUIDE', 'FAQ', 'TROUBLESHOOTING', 'CHECKLIST', 'RELEASE_NOTE', 'POLICY', 'HOW_TO');
CREATE TYPE "HelpCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "OnboardingGuideStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "help_categories" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "audience" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "HelpCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "help_articles"
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "excerpt" TEXT,
  ADD COLUMN "body" TEXT,
  ADD COLUMN "type" "HelpArticleType" NOT NULL DEFAULT 'GUIDE',
  ADD COLUMN "status" "HelpArticleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "audience" JSONB,
  ADD COLUMN "tags" JSONB,
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ro',
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isContextual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "relatedRoute" TEXT,
  ADD COLUMN "relatedModule" TEXT,
  ADD COLUMN "estimatedReadMinutes" INTEGER,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT;

UPDATE "help_articles"
SET
  "body" = COALESCE("body", "content"),
  "status" = CASE WHEN "isPublished" THEN 'PUBLISHED'::"HelpArticleStatus" ELSE 'DRAFT'::"HelpArticleStatus" END,
  "audience" = CASE
    WHEN "targetRole" = 'ALL' THEN '["PUBLIC","ADMIN","STAFF","RESIDENT"]'::jsonb
    WHEN "targetRole" = 'SUPER_ADMIN' THEN '["SUPERADMIN"]'::jsonb
    WHEN "targetRole" = 'ADMIN' THEN '["ADMIN","STAFF"]'::jsonb
    WHEN "targetRole" = 'RESIDENT' THEN '["RESIDENT"]'::jsonb
    ELSE '["PUBLIC"]'::jsonb
  END,
  "publishedAt" = CASE WHEN "isPublished" THEN COALESCE("publishedAt", "createdAt") ELSE "publishedAt" END;

CREATE TABLE "help_article_feedback" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "userId" TEXT,
  "audience" "HelpAudience",
  "helpful" BOOLEAN NOT NULL,
  "comment" TEXT,
  "route" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "help_article_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "onboarding_guides" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "audience" "HelpAudience" NOT NULL,
  "status" "OnboardingGuideStatus" NOT NULL DEFAULT 'ACTIVE',
  "steps" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "onboarding_guides_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_onboarding_progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "associationId" TEXT,
  "guideKey" TEXT NOT NULL,
  "completedSteps" JSONB,
  "skippedSteps" JSONB,
  "completedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_onboarding_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "help_categories_slug_key" ON "help_categories"("slug");
CREATE INDEX "help_categories_status_sortOrder_idx" ON "help_categories"("status", "sortOrder");
CREATE INDEX "help_articles_categoryId_status_sortOrder_idx" ON "help_articles"("categoryId", "status", "sortOrder");
CREATE INDEX "help_articles_status_locale_updatedAt_idx" ON "help_articles"("status", "locale", "updatedAt");
CREATE INDEX "help_articles_relatedModule_isContextual_idx" ON "help_articles"("relatedModule", "isContextual");
CREATE INDEX "help_article_feedback_articleId_createdAt_idx" ON "help_article_feedback"("articleId", "createdAt");
CREATE INDEX "help_article_feedback_helpful_createdAt_idx" ON "help_article_feedback"("helpful", "createdAt");
CREATE UNIQUE INDEX "onboarding_guides_key_key" ON "onboarding_guides"("key");
CREATE INDEX "onboarding_guides_audience_status_idx" ON "onboarding_guides"("audience", "status");
CREATE UNIQUE INDEX "user_onboarding_progress_userId_associationId_guideKey_key" ON "user_onboarding_progress"("userId", "associationId", "guideKey");
CREATE INDEX "user_onboarding_progress_associationId_guideKey_idx" ON "user_onboarding_progress"("associationId", "guideKey");

ALTER TABLE "help_categories" ADD CONSTRAINT "help_categories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_categories" ADD CONSTRAINT "help_categories_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "help_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_article_feedback" ADD CONSTRAINT "help_article_feedback_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_article_feedback" ADD CONSTRAINT "help_article_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_onboarding_progress" ADD CONSTRAINT "user_onboarding_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_onboarding_progress" ADD CONSTRAINT "user_onboarding_progress_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
