import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RoadmapFeatureFiltersDto {
  @IsOptional()
  @IsIn(['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsIn(['PAYMENTS', 'REPORTS', 'MOBILE', 'INTEGRATIONS', 'UX', 'OTHER'])
  category?: string;

  @IsOptional()
  @IsIn(['INTERNAL', 'PUBLIC'])
  visibility?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class CreateRoadmapFeatureDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MaxLength(3000)
  description!: string;

  @IsIn(['PAYMENTS', 'REPORTS', 'MOBILE', 'INTEGRATIONS', 'UX', 'OTHER'])
  category!: string;

  @IsOptional()
  @IsIn(['INTERNAL', 'PUBLIC'])
  visibility?: string;

  @IsOptional()
  @IsString()
  sourceFeedbackId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  publicSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  customerProblem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  expectedOutcome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  moduleKey?: string;
}

export class UpdateRoadmapFeatureDto {
  @IsOptional()
  @IsIn(['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsIn(['INTERNAL', 'PUBLIC'])
  visibility?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  publicSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  customerProblem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  expectedOutcome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  roadmapQuarter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  internalNotes?: string;

  @IsOptional()
  impactScore?: number;

  @IsOptional()
  effortScore?: number;

  @IsOptional()
  reachScore?: number;

  @IsOptional()
  confidenceScore?: number;
}

export class CreateFeatureRequestCommentDto {
  @IsString()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  internalOnly?: boolean;
}
