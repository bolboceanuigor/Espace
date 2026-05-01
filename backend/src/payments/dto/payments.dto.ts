import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminManualPaymentDto {
  @IsString()
  apartmentId!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE'])
  method!: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE';

  @IsOptional()
  @IsString()
  note?: string;
}

export class ResidentCreateIntentDto {
  @IsString()
  apartmentId!: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['MAIB', 'PAYNET', 'OPLATA', 'MANUAL_BANK_TRANSFER', 'CASH'])
  provider!: 'MAIB' | 'PAYNET' | 'OPLATA' | 'MANUAL_BANK_TRANSFER' | 'CASH';
}

export class AdminPaymentsQueryDto {
  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class UpdatePaymentProviderConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, any>;
}
