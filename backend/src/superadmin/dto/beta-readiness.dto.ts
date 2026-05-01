import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBetaReadinessCheckDto {
  @IsOptional()
  @IsIn(['NOT_CHECKED', 'PASSED', 'FAILED'])
  status?: 'NOT_CHECKED' | 'PASSED' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;
}

export class UpdateBetaLaunchStatusDto {
  @IsIn(['NOT_READY', 'READY_FOR_BETA', 'LIVE'])
  launchStatus!: 'NOT_READY' | 'READY_FOR_BETA' | 'LIVE';
}
