import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientErrorDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  route?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;
}

export class ListSystemErrorsDto {
  @IsOptional()
  @IsIn(['BACKEND', 'FRONTEND', 'DATABASE', 'PRISMA', 'AUTH', 'PAYMENTS', 'NOTIFICATIONS', 'JOB', 'WEBHOOK', 'SYSTEM', 'PAYMENT_PROVIDER'])
  source?: string;

  @IsOptional()
  @IsIn(['INFO', 'WARNING', 'ERROR', 'CRITICAL'])
  level?: string;

  @IsOptional()
  @IsIn(['INFO', 'WARNING', 'ERROR', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  resolved?: boolean;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  associationId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
