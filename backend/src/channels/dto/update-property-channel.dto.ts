import { Channel } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePropertyChannelDto {
  @IsEnum(Channel)
  channel!: Channel;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  icsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalListingId?: string;
}

