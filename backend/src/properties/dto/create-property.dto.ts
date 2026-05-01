import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const MAX_PRICE = 999_999.99;
const MAX_ROOMS = 1_000;
const PROPERTY_COLORS = ['gray', 'blue', 'teal', 'violet', 'rose', 'amber', 'emerald', 'slate'];

export class CreatePropertyDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(1, { message: 'Name must not be empty' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string;

  @IsNotEmpty({ message: 'Address is required' })
  @IsString()
  @MinLength(1, { message: 'Address must not be empty' })
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  address: string;

  @IsNotEmpty({ message: 'Base price is required' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Base price must be at least 0.01' })
  @Max(MAX_PRICE, { message: `Base price must not exceed ${MAX_PRICE}` })
  basePrice: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Cleaning fee cannot be negative' })
  @Max(MAX_PRICE, { message: `Cleaning fee must not exceed ${MAX_PRICE}` })
  cleaningFee: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Rooms must be at least 1' })
  @Max(MAX_ROOMS, { message: `Rooms must not exceed ${MAX_ROOMS}` })
  rooms: number;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(MAX_ROOMS)
  numberOfRooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PRICE)
  cleaningPrice?: number;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  @IsIn(PROPERTY_COLORS, { message: `Color must be one of: ${PROPERTY_COLORS.join(', ')}` })
  color?: string;
}
