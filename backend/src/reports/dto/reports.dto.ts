import { IsDateString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class MonthlyReportQueryDto {
  @IsOptional()
  @IsNumberString()
  month?: string;

  @IsOptional()
  @IsNumberString()
  year?: string;
}

export class DebtsReportQueryDto {
  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsNumberString()
  floor?: string;

  @IsOptional()
  @IsNumberString()
  minDebt?: string;

  @IsOptional()
  @IsNumberString()
  maxDebt?: string;
}

export class PaymentsReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ResidentStatementQueryDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;
}
