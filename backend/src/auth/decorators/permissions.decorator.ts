import { SetMetadata } from '@nestjs/common';
import type { TeamPermissionKey } from '../../team/team-permissions';

export const PERMISSIONS_KEY = 'team_permissions';
export const RequiresPermissions = (...permissions: TeamPermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

