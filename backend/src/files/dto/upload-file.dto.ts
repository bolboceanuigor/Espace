import { FileAssetEntityType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @IsEnum(FileAssetEntityType)
  entityType!: FileAssetEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;
}

