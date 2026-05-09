import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  private normalizeRole(role: Role | string) {
    const value = String(role).toUpperCase();
    return value === 'SUPER_ADMIN' ? 'SUPERADMIN' : value;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Trebuie să te autentifici.',
      });
    }
    const currentRole = this.normalizeRole(user.role);
    const allowed = requiredRoles.some((role) => this.normalizeRole(role) === currentRole);
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Nu ai acces la această zonă.',
      });
    }
    return true;
  }
}
