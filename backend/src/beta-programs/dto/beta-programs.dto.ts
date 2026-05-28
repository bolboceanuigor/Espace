import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  BetaCohortMemberStatus,
  BetaCohortMemberType,
  BetaCohortStatus,
  BetaFeedbackSentiment,
  BetaFeedbackSeverity,
  BetaFeedbackStatus,
  BetaProgramStatus,
  Role,
} from '@prisma/client';

export class ListBetaProgramsDto {
  @IsOptional()
  @IsEnum(BetaProgramStatus)
  status?: BetaProgramStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;
}

export class CreateBetaProgramDto {
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
  @IsEnum(BetaProgramStatus)
  status?: BetaProgramStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  featureFlagId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetRelease?: string;

  @IsOptional()
  @IsObject()
  successCriteria?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  riskNotes?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateBetaProgramDto {
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
  @IsString()
  @MaxLength(120)
  moduleKey?: string | null;

  @IsOptional()
  @IsString()
  featureFlagId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetRelease?: string | null;

  @IsOptional()
  @IsObject()
  successCriteria?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  riskNotes?: string | null;

  @IsOptional()
  @IsString()
  ownerId?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class UpdateBetaProgramStatusDto {
  @IsEnum(BetaProgramStatus)
  status!: BetaProgramStatus;
}

export class CreateBetaCohortDto {
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
  @IsEnum(BetaCohortStatus)
  status?: BetaCohortStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  featureFlagId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsObject()
  entryCriteria?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  exitCriteria?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateBetaCohortDto extends PartialType(CreateBetaCohortDto) {}

export class UpdateBetaCohortStatusDto {
  @IsEnum(BetaCohortStatus)
  status!: BetaCohortStatus;
}

export class AddBetaCohortMemberDto {
  @IsEnum(BetaCohortMemberType)
  memberType!: BetaCohortMemberType;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(BetaCohortMemberStatus)
  status?: BetaCohortMemberStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateBetaCohortMemberDto {
  @IsOptional()
  @IsEnum(BetaCohortMemberStatus)
  status?: BetaCohortMemberStatus;

  @IsOptional()
  @IsEnum(Role)
  role?: Role | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class SubmitBetaFeedbackDto {
  @IsOptional()
  @IsString()
  betaProgramId?: string;

  @IsOptional()
  @IsString()
  betaCohortId?: string;

  @IsOptional()
  @IsString()
  featureFlagId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  moduleKey?: string;

  @IsString()
  @MaxLength(220)
  title!: string;

  @IsString()
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsEnum(BetaFeedbackSentiment)
  sentiment?: BetaFeedbackSentiment;

  @IsOptional()
  @IsEnum(BetaFeedbackSeverity)
  severity?: BetaFeedbackSeverity;

  @IsOptional()
  @IsString()
  pageUrl?: string;

  @IsOptional()
  @IsString()
  screenshotUrl?: string;

  @IsOptional()
  @IsObject()
  contextJson?: Record<string, unknown>;
}

export class ListBetaFeedbackDto {
  @IsOptional()
  @IsString()
  betaProgramId?: string;

  @IsOptional()
  @IsString()
  betaCohortId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsEnum(BetaFeedbackStatus)
  status?: BetaFeedbackStatus;

  @IsOptional()
  @IsEnum(BetaFeedbackSeverity)
  severity?: BetaFeedbackSeverity;
}

export class UpdateBetaFeedbackDto {
  @IsOptional()
  @IsEnum(BetaFeedbackStatus)
  status?: BetaFeedbackStatus;

  @IsOptional()
  @IsEnum(BetaFeedbackSeverity)
  severity?: BetaFeedbackSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNotes?: string | null;
}
