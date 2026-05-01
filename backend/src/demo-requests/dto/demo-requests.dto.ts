import { IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateDemoRequestDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsEmail()
  @MaxLength(190)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  associationName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  apartmentsCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}

export class UpdateDemoRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  associationName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  apartmentsCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsIn(['NEW', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: 'NEW' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  leadId?: string | null;
}

export class ScheduleDemoRequestDto {
  @IsDateString()
  scheduledAt!: string;
}

export class CancelDemoRequestDto {
  @IsOptional()
  @IsIn(['CANCELLED', 'NO_SHOW'])
  status?: 'CANCELLED' | 'NO_SHOW';
}
