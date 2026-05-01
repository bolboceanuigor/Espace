import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsIn(['OWNER', 'TENANT', 'CONTACT'])
  residentType?: 'OWNER' | 'TENANT' | 'CONTACT';
}
