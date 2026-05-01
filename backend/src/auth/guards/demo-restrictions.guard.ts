import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class DemoRestrictionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { isDemoUser?: boolean } | undefined;
    if (!user?.isDemoUser) return true;

    const method = String(request.method || 'GET').toUpperCase();
    const path = String(request.path || request.url || '').toLowerCase();

    if (method === 'DELETE') {
      throw new ForbiddenException('În modul demo, ștergerea datelor nu este permisă.');
    }

    if (path.includes('/payment-providers')) {
      throw new ForbiddenException('În modul demo, această acțiune este restricționată.');
    }

    if (path.includes('/subscription') && method !== 'GET') {
      throw new ForbiddenException('În modul demo, această acțiune este restricționată.');
    }

    if (path.includes('/backup/export') || path.includes('/exports')) {
      throw new ForbiddenException('În modul demo, această acțiune este restricționată.');
    }

    return true;
  }
}

