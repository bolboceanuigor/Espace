import { IsEnum, IsOptional } from 'class-validator';

const FEEDBACK_STATUS = ['NEW', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const;
const FEEDBACK_PRIORITY = ['LOW', 'MEDIUM', 'HIGH'] as const;

export class UpdateFeedbackDto {
  @IsOptional()
  @IsEnum(FEEDBACK_STATUS)
  status?: (typeof FEEDBACK_STATUS)[number];

  @IsOptional()
  @IsEnum(FEEDBACK_PRIORITY)
  priority?: (typeof FEEDBACK_PRIORITY)[number];
}

