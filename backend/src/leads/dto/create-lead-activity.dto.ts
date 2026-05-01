import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const LEAD_ACTIVITY_TYPE = ['CALL', 'EMAIL', 'MEETING', 'DEMO', 'NOTE'] as const;

export class CreateLeadActivityDto {
  @IsEnum(LEAD_ACTIVITY_TYPE)
  type: (typeof LEAD_ACTIVITY_TYPE)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}

