import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  CustomerSuccessMetricGranularity,
  CustomerSuccessReportExportFormat,
  CustomerSuccessReportPeriod,
  CustomerSuccessReportType,
} from '@prisma/client';

export class SaveMetricSnapshotDto {
  @IsEnum(CustomerSuccessReportType)
  reportType!: CustomerSuccessReportType;

  @IsOptional()
  @IsEnum(CustomerSuccessReportPeriod)
  period?: CustomerSuccessReportPeriod;

  @IsOptional()
  @IsEnum(CustomerSuccessMetricGranularity)
  granularity?: CustomerSuccessMetricGranularity;

  @IsOptional()
  filters?: Record<string, unknown>;
}

export class SaveCustomerReportDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CustomerSuccessReportType)
  reportType!: CustomerSuccessReportType;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  columns?: unknown[];

  @IsOptional()
  chartConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class UpdateSavedCustomerReportDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  columns?: unknown[];

  @IsOptional()
  chartConfig?: Record<string, unknown>;
}

export class ExportCustomerReportDto {
  @IsEnum(CustomerSuccessReportType)
  reportType!: CustomerSuccessReportType;

  @IsOptional()
  @IsEnum(CustomerSuccessReportExportFormat)
  format?: CustomerSuccessReportExportFormat;

  @IsOptional()
  filters?: Record<string, unknown>;
}
