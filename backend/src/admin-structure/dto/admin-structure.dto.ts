import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBuildingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(240)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cadastralNumber?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalFloors!: number;
}

export class UpdateBuildingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cadastralNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalFloors?: number;
}

export class CreateStaircaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  floorsCount!: number;
}

export class UpdateStaircaseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  floorsCount?: number;
}

export class ListApartmentsQueryDto {
  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsIn(['OCCUPIED', 'EMPTY', 'RENTED'])
  status?: 'OCCUPIED' | 'EMPTY' | 'RENTED';

  @IsOptional()
  @IsString()
  search?: string;

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

export class ListResidentsQueryDto {
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

export class CreateApartmentDto {
  @IsString()
  buildingId!: string;

  @IsString()
  staircaseId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  number!: string;

  @Type(() => Number)
  @IsInt()
  floor!: number;

  @Type(() => Number)
  @IsNumber()
  areaM2!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rooms?: number;

  @IsIn(['OCCUPIED', 'EMPTY', 'RENTED'])
  status!: 'OCCUPIED' | 'EMPTY' | 'RENTED';
}

export class UpdateApartmentDto {
  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsString()
  staircaseId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  number?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  areaM2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rooms?: number;

  @IsOptional()
  @IsIn(['OCCUPIED', 'EMPTY', 'RENTED'])
  status?: 'OCCUPIED' | 'EMPTY' | 'RENTED';
}

export class CreateResidentDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsString()
  apartmentId!: string;

  @IsIn(['OWNER', 'TENANT', 'CONTACT'])
  type!: 'OWNER' | 'TENANT' | 'CONTACT';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateResidentDto {
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsIn(['OWNER', 'TENANT', 'CONTACT'])
  type?: 'OWNER' | 'TENANT' | 'CONTACT';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
