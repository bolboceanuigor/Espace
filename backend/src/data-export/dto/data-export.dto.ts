import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DataExportFormat, DataExportType, DataRequestScope, DataRequestStatus, DataRequestType } from '@prisma/client';

export class CreateDataRequestDto {
  @IsEnum(DataRequestType)
  type: DataRequestType;

  @IsEnum(DataRequestScope)
  scope: DataRequestScope;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(3000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  reason?: string;
}

export class UpdateDataRequestStatusDto {
  @IsEnum(DataRequestStatus)
  status: DataRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decisionNote?: string;
}

export class CreateDataExportDto {
  @IsEnum(DataExportType)
  exportType: DataExportType;

  @IsEnum(DataExportFormat)
  format: DataExportFormat;

  @IsOptional()
  @IsString()
  associationId?: string;

  @IsOptional()
  @IsString()
  dataRequestId?: string;

  @IsOptional()
  @IsString()
  residentId?: string;

  @IsOptional()
  filters?: Record<string, unknown>;
}

export class CancelDataExportDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
