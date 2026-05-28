import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const FEEDBACK_TYPES = ['BUG', 'IDEA', 'QUESTION', 'COMPLAINT'] as const;
const FEEDBACK_SOURCES = ['IN_APP', 'SUPPORT', 'CALL', 'EMAIL', 'SUPERADMIN', 'IMPORT'] as const;

export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @IsEnum(FEEDBACK_TYPES)
  type: (typeof FEEDBACK_TYPES)[number];

  @IsOptional()
  @IsEnum(FEEDBACK_SOURCES)
  source?: (typeof FEEDBACK_SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerImpact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  reproductionSteps?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  environment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  browserInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  pageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  screenshotUrl?: string;
}
