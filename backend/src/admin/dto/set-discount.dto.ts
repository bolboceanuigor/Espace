import { IsNumber, Min, Max } from 'class-validator';

export class SetDiscountDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;
}
