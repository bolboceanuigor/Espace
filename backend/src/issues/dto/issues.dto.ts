import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ResidentIssueFiltersDto {
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'])
  status?: 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
}

export class CreateResidentIssueDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsIn(['WATER', 'ELECTRICITY', 'ELEVATOR', 'CLEANING', 'HEATING', 'SECURITY', 'OTHER'])
  category!: 'WATER' | 'ELECTRICITY' | 'ELEVATOR' | 'CLEANING' | 'HEATING' | 'SECURITY' | 'OTHER';

  @IsIn(['APARTMENT', 'BUILDING', 'STAIRCASE', 'COMMON_AREA'])
  locationType!: 'APARTMENT' | 'BUILDING' | 'STAIRCASE' | 'COMMON_AREA';

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export class CreateIssueCommentDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isInternal?: boolean;
}

export class CreateIssueAttachmentDto {
  @IsString()
  fileUrl!: string;

  @IsString()
  fileName!: string;

  @IsString()
  fileType!: string;
}

export class AdminIssueFiltersDto {
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'])
  status?: 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsIn(['WATER', 'ELECTRICITY', 'ELEVATOR', 'CLEANING', 'HEATING', 'SECURITY', 'OTHER'])
  category?: 'WATER' | 'ELECTRICITY' | 'ELEVATOR' | 'CLEANING' | 'HEATING' | 'SECURITY' | 'OTHER';

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class AdminUpdateIssueDto {
  @IsOptional()
  @IsIn(['NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'])
  status?: 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsString()
  assignedToUserId?: string | null;
}
