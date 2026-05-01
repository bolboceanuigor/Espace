import { IsOptional, IsNumber, Min, IsDateString } from 'class-validator';

export class ExtendTrialDto {
  /** New trial end date (ISO string). */
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  /** Or extend by this many days from now. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  extendDays?: number;
}
