import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { FeatureFlagRuleEffect, FeatureFlagRuleScope, FeatureFlagStatus, FeatureFlagType, Role } from '@prisma/client';

export class ListFeatureFlagsDto {
  @IsOptional()
  @IsEnum(FeatureFlagStatus)
  status?: FeatureFlagStatus;

  @IsOptional()
  @IsEnum(FeatureFlagType)
  type?: FeatureFlagType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;
}

export class EvaluateFeatureFlagsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string;
}

export class CreateFeatureFlagDto {
  @IsString()
  @MaxLength(120)
  key!: string;

  @IsString()
  @MaxLength(220)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsEnum(FeatureFlagType)
  type?: FeatureFlagType;

  @IsOptional()
  @IsEnum(FeatureFlagStatus)
  status?: FeatureFlagStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string;

  @IsOptional()
  @IsBoolean()
  defaultEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsBoolean()
  visibleInNavigation?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string | null;

  @IsOptional()
  @IsEnum(FeatureFlagType)
  type?: FeatureFlagType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string | null;

  @IsOptional()
  @IsBoolean()
  defaultEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsBoolean()
  visibleInNavigation?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class UpdateFeatureFlagStatusDto {
  @IsEnum(FeatureFlagStatus)
  status!: FeatureFlagStatus;
}

export class CreateFeatureFlagRuleDto {
  @IsEnum(FeatureFlagRuleScope)
  scope!: FeatureFlagRuleScope;

  @IsOptional()
  @IsEnum(FeatureFlagRuleEffect)
  effect?: FeatureFlagRuleEffect;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  betaCohortId?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateFeatureFlagRuleDto {
  @IsOptional()
  @IsEnum(FeatureFlagRuleScope)
  scope?: FeatureFlagRuleScope;

  @IsOptional()
  @IsEnum(FeatureFlagRuleEffect)
  effect?: FeatureFlagRuleEffect;

  @IsOptional()
  @IsString()
  planId?: string | null;

  @IsOptional()
  @IsString()
  organizationId?: string | null;

  @IsOptional()
  @IsString()
  betaCohortId?: string | null;

  @IsOptional()
  @IsEnum(Role)
  role?: Role | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown> | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class PreviewFeatureFlagsDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  userId?: string;
}
