import { IsNumber, Min } from 'class-validator';

export class SetApartmentLimitDto {
  @IsNumber()
  @Min(0)
  apartmentLimit: number;
}
