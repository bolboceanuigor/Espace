import { IsEmail, IsString, IsIn, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class AuthInviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(Role)
  @IsIn([Role.MANAGER, Role.ADMIN, Role.TENANT])
  role: Role;
}
