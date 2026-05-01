import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportConversationDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;
}

export class CreateChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsIn(['TEXT', 'FILE', 'SYSTEM'])
  messageType?: 'TEXT' | 'FILE' | 'SYSTEM';

  @IsOptional()
  @IsString()
  fileAssetId?: string;
}

export class CreateCommunityConversationDto {
  @IsIn(['ORGANIZATION', 'BUILDING', 'STAIRCASE'])
  targetType!: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE';

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isDefault?: string;
}

export class AssignConversationDto {
  @IsOptional()
  @IsString()
  assignedToUserId?: string | null;
}

export class UpdateConversationStatusDto {
  @IsIn(['OPEN', 'PENDING', 'CLOSED'])
  status!: 'OPEN' | 'PENDING' | 'CLOSED';
}

export class AdminConversationFiltersDto {
  @IsOptional()
  @IsIn(['OPEN', 'PENDING', 'CLOSED'])
  status?: 'OPEN' | 'PENDING' | 'CLOSED';

  @IsOptional()
  @IsIn(['true', 'false'])
  assignedToMe?: string;
}
