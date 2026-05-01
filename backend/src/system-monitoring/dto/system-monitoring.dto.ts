import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientErrorDto {
  @IsString()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;
}

export class ListSystemErrorsDto {
  @IsOptional()
  @IsIn(['BACKEND', 'FRONTEND', 'JOB', 'WEBHOOK', 'PAYMENT_PROVIDER'])
  source?: string;

  @IsOptional()
  @IsIn(['INFO', 'WARNING', 'ERROR', 'CRITICAL'])
  level?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  resolved?: boolean;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
