import { IsString, IsDateString, IsNumber, Min, IsOptional, IsIn } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  propertyId: string;

  @IsString()
  guestName: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** If omitted, calculated as basePrice * nights + cleaningFee from property. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number;

  @IsOptional()
  @IsString()
  @IsIn(['CONFIRMED', 'PENDING', 'CANCELLED', 'BLOCKED'])
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  cleaningStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
