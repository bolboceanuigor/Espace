import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  BillingCurrency,
  RevenueForecastHorizon,
  RevenueForecastScenarioStatus,
  RevenueForecastScenarioType,
  UpgradeOpportunityPriority,
  UpgradeOpportunityReason,
  UpgradeOpportunityStatus,
} from '@prisma/client';

export class RevenueForecastScenarioDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(RevenueForecastScenarioType)
  type!: RevenueForecastScenarioType;

  @IsOptional()
  @IsEnum(RevenueForecastScenarioStatus)
  status?: RevenueForecastScenarioStatus;

  @IsOptional()
  @IsEnum(RevenueForecastHorizon)
  horizon?: RevenueForecastHorizon;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  trialConversionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  upgradeConversionRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  collectionRecoveryRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  churnRiskLossRate?: number;
}

export class CreateManualUpgradeOpportunityDto {
  @IsString()
  associationId!: string;

  @IsOptional()
  @IsString()
  clientAccountId?: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  currentPlanId?: string;

  @IsOptional()
  @IsString()
  recommendedPlanId?: string;

  @IsOptional()
  @IsEnum(UpgradeOpportunityReason)
  reason?: UpgradeOpportunityReason;

  @IsOptional()
  @IsEnum(UpgradeOpportunityPriority)
  priority?: UpgradeOpportunityPriority;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  currentMonthlyValue?: number;

  @IsOptional()
  @IsNumber()
  recommendedMonthlyValue?: number;

  @IsOptional()
  @IsEnum(BillingCurrency)
  currency?: BillingCurrency;
}

export class UpdateUpgradeOpportunityDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(UpgradeOpportunityPriority)
  priority?: UpgradeOpportunityPriority;

  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;
}

export class UpdateUpgradeOpportunityStatusDto {
  @IsEnum(UpgradeOpportunityStatus)
  status!: UpgradeOpportunityStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignUpgradeOpportunityDto {
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpgradeOpportunityNoteDto {
  @IsString()
  note!: string;
}

export class UpgradeOpportunityTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpgradeOpportunityFollowUpDto {
  @IsString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class ConvertUpgradeOpportunityDto {
  @IsBoolean()
  confirm!: boolean;

  @IsString()
  selectedPlanId!: string;

  @IsOptional()
  @IsString()
  billingCycle?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
