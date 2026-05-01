import { IsDateString } from 'class-validator';

export class MoveReservationDto {
  @IsDateString()
  newCheckIn: string;

  @IsDateString()
  newCheckOut: string;
}
