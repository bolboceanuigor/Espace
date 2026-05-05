import { IsEmail, IsString, IsIn, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  @IsIn([Role.ADMIN, Role.RESIDENT])
  role: Role;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
