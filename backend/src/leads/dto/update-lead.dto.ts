import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const LEAD_STATUS = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'TRIAL_STARTED', 'WON', 'LOST'] as const;
const LEAD_SOURCE = ['WEBSITE', 'MANUAL', 'REFERRAL', 'FACEBOOK', 'OTHER'] as const;

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LEAD_STATUS)
  status?: (typeof LEAD_STATUS)[number];

  @IsOptional()
  @IsEnum(LEAD_SOURCE)
  source?: (typeof LEAD_SOURCE)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

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
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

