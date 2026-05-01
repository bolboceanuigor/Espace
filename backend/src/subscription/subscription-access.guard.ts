import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SUBSCRIPTION_ACCESS_KEY, type SubscriptionAccessMode } from './subscription-access.decorator';

@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string; organizationId?: string | null } | undefined;
    if (!user?.role) return true;
    const role = String(user.role).toUpperCase();
    if (role === 'SUPERADMIN' || role === 'SUPER_ADMIN') return true;

    const mode =
      this.reflector.getAllAndOverride<SubscriptionAccessMode>(SUBSCRIPTION_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'ACTIVE_REQUIRED';

    if (role === 'ADMIN') {
      if (!user.organizationId) throw new ForbiddenException('Organization context missing');
      const subscription = await this.prisma.organizationSubscription.findUnique({
        where: { organizationId: user.organizationId },
        select: { status: true },
      });
      const status = String(subscription?.status || '').toUpperCase();

      if (mode === 'ALLOW_SUSPENDED_VIEW_ONLY') return true;
      if (mode === 'ALLOW_PAST_DUE') {
        if (['TRIAL', 'ACTIVE', 'PAST_DUE'].includes(status)) return true;
        throw new ForbiddenException('Subscription is suspended or cancelled');
      }
      if (['TRIAL', 'ACTIVE'].includes(status)) return true;
      throw new ForbiddenException('Active subscription required for this action');
    }

    if (role === 'RESIDENT' || role === 'TENANT') {
      // Residents keep partial read-only access on affected org statuses.
      const method = String(request.method || 'GET').toUpperCase();
      if (method !== 'GET') {
        throw new ForbiddenException('Resident write actions are restricted');
      }
      return true;
    }

    return true;
  }
}
