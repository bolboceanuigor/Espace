import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class ListVoteSessionsDto {
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'CLOSED', 'PUBLISHED'])
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'PUBLISHED';
}

export class CreateVoteSessionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE'])
  targetType!: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE';

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsIn(['BY_APARTMENT', 'BY_AREA_M2'])
  votingMethod!: 'BY_APARTMENT' | 'BY_AREA_M2';

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}

export class UpdateVoteSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  description?: string;

  @IsOptional()
  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE'])
  targetType?: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE';

  @IsOptional()
  @IsString()
  buildingId?: string | null;

  @IsOptional()
  @IsString()
  staircaseId?: string | null;

  @IsOptional()
  @IsIn(['BY_APARTMENT', 'BY_AREA_M2'])
  votingMethod?: 'BY_APARTMENT' | 'BY_AREA_M2';

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class AddVoteOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;
}

export class CreateVoteOptionInlineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;
}

export class CastVoteDto {
  @IsString()
  apartmentId!: string;

  @IsString()
  voteOptionId!: string;
}
