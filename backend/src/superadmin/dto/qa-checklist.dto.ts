import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateQACheckDto {
  @IsOptional()
  @IsIn(['NOT_TESTED', 'PASSED', 'FAILED'])
  status?: 'NOT_TESTED' | 'PASSED' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;
}
