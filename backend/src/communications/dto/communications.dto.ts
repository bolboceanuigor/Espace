import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(3)
  content!: string;

  @IsOptional()
  @IsIn(['ANNOUNCEMENT', 'DOCUMENT', 'MAINTENANCE', 'VOTE', 'SYSTEM_NOTICE'])
  contentType?: 'ANNOUNCEMENT' | 'DOCUMENT' | 'MAINTENANCE' | 'VOTE' | 'SYSTEM_NOTICE';

  @IsIn(['NORMAL', 'IMPORTANT', 'URGENT'])
  importance!: 'NORMAL' | 'IMPORTANT' | 'URGENT';

  @IsOptional()
  @IsIn(['true', 'false'])
  isPinned?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  commentsEnabled?: string;

  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'])
  targetType!: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  content?: string;

  @IsOptional()
  @IsIn(['ANNOUNCEMENT', 'DOCUMENT', 'MAINTENANCE', 'VOTE', 'SYSTEM_NOTICE'])
  contentType?: 'ANNOUNCEMENT' | 'DOCUMENT' | 'MAINTENANCE' | 'VOTE' | 'SYSTEM_NOTICE';

  @IsOptional()
  @IsIn(['NORMAL', 'IMPORTANT', 'URGENT'])
  importance?: 'NORMAL' | 'IMPORTANT' | 'URGENT';

  @IsOptional()
  @IsIn(['true', 'false'])
  isPinned?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  commentsEnabled?: string;

  @IsOptional()
  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'])
  targetType?: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;
}

export class ListAdminAnnouncementsDto {
  @IsOptional()
  @IsIn(['ANNOUNCEMENT', 'DOCUMENT', 'MAINTENANCE', 'VOTE', 'SYSTEM_NOTICE'])
  contentType?: 'ANNOUNCEMENT' | 'DOCUMENT' | 'MAINTENANCE' | 'VOTE' | 'SYSTEM_NOTICE';

  @IsOptional()
  @IsIn(['NORMAL', 'IMPORTANT', 'URGENT'])
  importance?: 'NORMAL' | 'IMPORTANT' | 'URGENT';

  @IsOptional()
  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'])
  targetType?: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';

  @IsOptional()
  @IsIn(['true', 'false'])
  pinned?: string;
}

export class CreateDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  fileUrl!: string;

  @IsString()
  fileName!: string;

  @IsString()
  fileType!: string;

  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'])
  targetType!: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE', 'APARTMENT'])
  targetType?: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;
}

export class MarkReadDto {
  @Type(() => String)
  id!: string;
}

export class CreateAnnouncementCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class UpdateAnnouncementCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
