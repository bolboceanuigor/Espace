import { IsNumber, Min } from 'class-validator';

export class SetCustomPriceDto {
  @IsNumber()
  @Min(0)
  customPrice: number;
}
