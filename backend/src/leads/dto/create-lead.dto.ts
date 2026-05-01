import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const LEAD_SOURCE = ['WEBSITE', 'MANUAL', 'REFERRAL', 'FACEBOOK', 'OTHER'] as const;

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone: string;

  @IsEmail()
  @MaxLength(180)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  associationName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  apartmentsCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  city?: string;

  @IsOptional()
  @IsEnum(LEAD_SOURCE)
  source?: (typeof LEAD_SOURCE)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

