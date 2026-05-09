import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { isSuperAdmin } from '../rbac';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!isSuperAdmin(user)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Nu ai acces la această zonă.',
      });
    }
    return true;
  }
}
