import { Channel } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SyncIcalDto {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;
}

