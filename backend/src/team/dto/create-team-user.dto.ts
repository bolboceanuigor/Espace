import { IsEmail, IsEnum, IsOptional, IsObject } from 'class-validator';
import { OrganizationMemberRole } from '@prisma/client';
import type { TeamPermissionKey } from '../team-permissions';

export class CreateTeamUserDto {
  @IsEmail()
  email: string;

  @IsEnum(OrganizationMemberRole)
  role: OrganizationMemberRole;

  @IsOptional()
  @IsObject()
  permissions?: Partial<Record<TeamPermissionKey, boolean>>;
}
