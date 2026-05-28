CREATE TYPE "CustomerSuccessReportType" AS ENUM ('PORTFOLIO_OVERVIEW', 'HEALTH_DISTRIBUTION', 'HEALTH_TRENDS', 'ONBOARDING_PIPELINE', 'REVENUE_ESTIMATE', 'SAAS_INVOICES', 'FOLLOW_UP_PERFORMANCE', 'TASK_PERFORMANCE', 'PLAYBOOK_PERFORMANCE', 'USAGE_BY_PLAN', 'CHURN_RISK', 'CUSTOMER_LIFECYCLE', 'OWNER_PERFORMANCE', 'CUSTOM');
CREATE TYPE "CustomerSuccessReportPeriod" AS ENUM ('TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS', 'MONTH_TO_DATE', 'QUARTER_TO_DATE', 'YEAR_TO_DATE', 'CUSTOM');
CREATE TYPE "CustomerSuccessMetricGranularity" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');
CREATE TYPE "SavedCustomerReportStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CustomerSuccessReportExportFormat" AS ENUM ('CSV', 'JSON');
CREATE TYPE "CustomerSuccessReportExportStatus" AS ENUM ('REQUESTED', 'READY', 'FAILED', 'EXPIRED');

CREATE TABLE "customer_success_metric_snapshots" (
  "id" TEXT NOT NULL,
  "reportType" "CustomerSuccessReportType" NOT NULL,
  "period" "CustomerSuccessReportPeriod" NOT NULL DEFAULT 'CUSTOM',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "granularity" "CustomerSuccessMetricGranularity" NOT NULL DEFAULT 'WEEKLY',
  "metrics" JSONB NOT NULL,
  "filters" JSONB,
  "generatedById" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_success_metric_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_customer_success_reports" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "reportType" "CustomerSuccessReportType" NOT NULL,
  "status" "SavedCustomerReportStatus" NOT NULL DEFAULT 'ACTIVE',
  "filters" JSONB NOT NULL,
  "columns" JSONB,
  "chartConfig" JSONB,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_customer_success_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_success_report_exports" (
  "id" TEXT NOT NULL,
  "reportType" "CustomerSuccessReportType" NOT NULL,
  "format" "CustomerSuccessReportExportFormat" NOT NULL DEFAULT 'CSV',
  "status" "CustomerSuccessReportExportStatus" NOT NULL DEFAULT 'REQUESTED',
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER,
  "filters" JSONB NOT NULL,
  "generatedById" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_success_report_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_success_metric_snapshots_reportType_generatedAt_idx" ON "customer_success_metric_snapshots"("reportType", "generatedAt");
CREATE INDEX "customer_success_metric_snapshots_periodStart_periodEnd_idx" ON "customer_success_metric_snapshots"("periodStart", "periodEnd");
CREATE INDEX "customer_success_metric_snapshots_generatedById_generatedAt_idx" ON "customer_success_metric_snapshots"("generatedById", "generatedAt");
CREATE INDEX "saved_customer_success_reports_reportType_status_idx" ON "saved_customer_success_reports"("reportType", "status");
CREATE INDEX "saved_customer_success_reports_createdById_status_idx" ON "saved_customer_success_reports"("createdById", "status");
CREATE INDEX "saved_customer_success_reports_isFavorite_status_idx" ON "saved_customer_success_reports"("isFavorite", "status");
CREATE INDEX "customer_success_report_exports_reportType_createdAt_idx" ON "customer_success_report_exports"("reportType", "createdAt");
CREATE INDEX "customer_success_report_exports_generatedById_createdAt_idx" ON "customer_success_report_exports"("generatedById", "createdAt");
CREATE INDEX "customer_success_report_exports_status_createdAt_idx" ON "customer_success_report_exports"("status", "createdAt");
