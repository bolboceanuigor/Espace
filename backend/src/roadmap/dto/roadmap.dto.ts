import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RoadmapFeatureFiltersDto {
  @IsOptional()
  @IsIn(['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsIn(['PAYMENTS', 'REPORTS', 'MOBILE', 'INTEGRATIONS', 'UX', 'OTHER'])
  category?: string;
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
}

export class UpdateRoadmapFeatureDto {
  @IsOptional()
  @IsIn(['NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'RELEASED', 'REJECTED'])
  status?: string;

  @IsOptional()
  @IsIn(['INTERNAL', 'PUBLIC'])
  visibility?: string;
}
