import { ImportedPaymentSource } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UploadReconciliationDto {
  @IsEnum(ImportedPaymentSource)
  source!: ImportedPaymentSource;
}

export class BatchMatchesQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateMappingTemplateDto {
  @IsEnum(ImportedPaymentSource)
  source!: ImportedPaymentSource;

  @IsString()
  name!: string;

  @IsObject()
  mappingJson!: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateMappingTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  mappingJson?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ApplyMappingDto {
  @IsObject()
  mappingJson!: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  saveAsTemplate?: boolean;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

