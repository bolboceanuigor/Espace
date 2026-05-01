import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const FEEDBACK_TYPES = ['BUG', 'IDEA', 'QUESTION', 'COMPLAINT'] as const;

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
  @IsString()
  @MaxLength(1024)
  pageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  screenshotUrl?: string;
}
