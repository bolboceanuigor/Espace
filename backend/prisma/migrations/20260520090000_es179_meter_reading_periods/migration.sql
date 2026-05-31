-- CreateEnum
CREATE TYPE "MeterReadingPeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_REVIEW', 'LOCKED', 'CANCELLED');

-- AlterTable
ALTER TABLE "meter_readings" ADD COLUMN "periodId" TEXT;

-- CreateTable
CREATE TABLE "meter_reading_periods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "MeterReadingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_reading_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meter_readings_periodId_idx" ON "meter_readings"("periodId");

-- CreateIndex
CREATE INDEX "meter_reading_periods_organizationId_status_createdAt_idx" ON "meter_reading_periods"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "meter_reading_periods_organizationId_year_month_key" ON "meter_reading_periods"("organizationId", "year", "month");

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "meter_reading_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_reading_periods" ADD CONSTRAINT "meter_reading_periods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_reading_periods" ADD CONSTRAINT "meter_reading_periods_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
