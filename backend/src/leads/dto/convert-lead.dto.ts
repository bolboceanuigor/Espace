import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConvertLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  organizationName?: string;
}

