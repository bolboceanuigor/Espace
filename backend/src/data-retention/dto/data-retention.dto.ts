import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  DataDeletionRequestStatus,
  DataDeletionRequestType,
  DataRetentionAction,
  DataRetentionEntityType,
} from '@prisma/client';

export class ArchiveEntityDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class RestoreArchiveDto {
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class UpdateRetentionPolicyDto {
  @IsOptional()
  defaultRetentionDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(DataRetentionAction)
  retentionAction?: DataRetentionAction;
}

export class CreateLegalHoldDto {
  @IsOptional()
  associationId?: string;

  @IsOptional()
  @IsEnum(DataRetentionEntityType)
  entityType?: DataRetentionEntityType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityId?: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(2000)
  reason: string;
}

export class ReleaseLegalHoldDto {
  @IsString()
  @MaxLength(2000)
  reason: string;
}

export class CreateDeletionRequestDto {
  @IsOptional()
  associationId?: string;

  @IsOptional()
  requestedByUserId?: string;

  @IsOptional()
  targetUserId?: string;

  @IsOptional()
  targetResidentId?: string;

  @IsOptional()
  @IsEnum(DataRetentionEntityType)
  entityType?: DataRetentionEntityType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityId?: string;

  @IsEnum(DataDeletionRequestType)
  requestType: DataDeletionRequestType;

  @IsString()
  @MaxLength(2000)
  reason: string;
}

export class UpdateDeletionRequestStatusDto {
  @IsEnum(DataDeletionRequestStatus)
  status: DataDeletionRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decisionNote?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
