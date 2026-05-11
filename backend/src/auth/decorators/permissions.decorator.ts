import { SetMetadata } from '@nestjs/common';
import {
  permissionKey,
  type PermissionActionKey,
  type PermissionModuleKey,
  type TeamPermissionKey,
} from '../../team/team-permissions';

export const PERMISSIONS_KEY = 'team_permissions';
export const RequiresPermissions = (...permissions: TeamPermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const RequirePermission = (module: PermissionModuleKey, action: PermissionActionKey) =>
  SetMetadata(PERMISSIONS_KEY, [permissionKey(module, action)]);
