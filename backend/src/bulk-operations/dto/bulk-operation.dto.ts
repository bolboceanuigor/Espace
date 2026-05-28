import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { BulkEntityType, BulkOperationType } from '@prisma/client';

export class BulkOperationPreviewDto {
  @IsEnum(BulkEntityType)
  entityType: BulkEntityType;

  @IsEnum(BulkOperationType)
  operationType: BulkOperationType;

  @IsArray()
  selectedIds: string[];

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

export class BulkOperationConfirmDto {
  @IsBoolean()
  confirm: boolean;
}

export class BulkOperationCancelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
