import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateMonthlyInvoicesDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class InvoicesFilterDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'])
  status?: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SendRemindersDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'])
  status?: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';

  @IsOptional()
  @IsString()
  message?: string;
}
