import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  LaunchChecklistSeverity,
  LaunchChecklistStatus,
  PlatformServiceBillingCycle,
  PlatformServiceCriticality,
  PlatformServiceStatus,
  PlatformServiceType,
} from '@prisma/client';

export class UpdateLaunchChecklistItemDto {
  @IsOptional()
  @IsEnum(LaunchChecklistStatus)
  status?: LaunchChecklistStatus;

  @IsOptional()
  @IsEnum(LaunchChecklistSeverity)
  severity?: LaunchChecklistSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  evidence?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  owner?: string;
}

export class UpsertPlatformServiceDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsEnum(PlatformServiceType)
  type: PlatformServiceType;

  @IsString()
  @MaxLength(160)
  providerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @MaxLength(1000)
  purpose: string;

  @IsEnum(PlatformServiceCriticality)
  criticality: PlatformServiceCriticality;

  @IsEnum(PlatformServiceStatus)
  status: PlatformServiceStatus;

  @IsEnum(PlatformServiceBillingCycle)
  billingCycle: PlatformServiceBillingCycle;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string;

  @IsOptional()
  @IsNumber()
  estimatedMonthlyCost?: number;

  @IsOptional()
  @IsNumber()
  estimatedYearlyCost?: number;

  @IsOptional()
  @IsDateString()
  nextPaymentDate?: string;

  @IsOptional()
  @IsDateString()
  renewalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountEmail?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  dashboardUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  documentationUrl?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  managedBy?: string;

  @IsOptional()
  environmentKeys?: string[];

  @IsOptional()
  dependsOn?: string[];

  @IsString()
  @MaxLength(2000)
  impactIfDown: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isRequiredForLaunch?: boolean;
}

export class PlatformServicePaymentEventDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  currency?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsDateString()
  nextPaymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class MarkGoLiveDto {
  @IsBoolean()
  confirmed: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;
}
