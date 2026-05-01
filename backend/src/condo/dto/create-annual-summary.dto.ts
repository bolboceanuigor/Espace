import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAnnualSummaryDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsString()
  @MinLength(2)
  adminName: string;

  @IsNumber()
  totalBudgetMdl: number;

  @IsNumber()
  totalExpensesMdl: number;

  @IsNumber()
  repairFundMdl: number;

  @IsNumber()
  debtTotalMdl: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
