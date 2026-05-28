import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

const FEEDBACK_STATUS = ['NEW', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const;
const FEEDBACK_PRIORITY = ['LOW', 'MEDIUM', 'HIGH'] as const;

export class UpdateFeedbackDto {
  @IsOptional()
  @IsEnum(FEEDBACK_STATUS)
  status?: (typeof FEEDBACK_STATUS)[number];

  @IsOptional()
  @IsEnum(FEEDBACK_PRIORITY)
  priority?: (typeof FEEDBACK_PRIORITY)[number];

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  linkedFeatureRequestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  internalNotes?: string;
}

export class ConvertFeedbackToFeatureDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  publicSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  expectedOutcome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}
