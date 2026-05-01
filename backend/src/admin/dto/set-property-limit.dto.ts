import { IsNumber, Min } from 'class-validator';

export class SetPropertyLimitDto {
  @IsNumber()
  @Min(0)
  propertyLimit: number;
}
