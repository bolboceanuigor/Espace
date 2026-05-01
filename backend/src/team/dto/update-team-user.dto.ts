import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { OrganizationMemberRole } from '@prisma/client';
import type { TeamPermissionKey } from '../team-permissions';

export class UpdateTeamUserDto {
  @IsOptional()
  @IsEnum(OrganizationMemberRole)
  role?: OrganizationMemberRole;

  @IsOptional()
  @IsObject()
  permissions?: Partial<Record<TeamPermissionKey, boolean>>;
}
