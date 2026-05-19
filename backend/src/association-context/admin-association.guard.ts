import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AssociationContextService } from './association-context.service';
import { SupportSessionContextService } from './support-session-context.service';
import type { RequestWithTenantContext } from './association-context.types';

@Injectable()
export class AdminAssociationGuard implements CanActivate {
  constructor(
    private readonly associationContext: AssociationContextService,
    private readonly supportSessions: SupportSessionContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Autentificare necesară.',
      });
    }

    const activeContext = await this.associationContext.getAdminAssociationContext(user, request);
    request.associationContext = activeContext;
    if (activeContext.isSupportMode && activeContext.supportSession) {
      request.supportSessionContext = {
        ...activeContext.supportSession,
        associationId: activeContext.associationId,
        startedById: user.id || user.sub || '',
        isReadOnly: activeContext.supportSession.mode === 'READ_ONLY',
      };
      await this.supportSessions.enforceMutationPolicy(request);
    }
    request.user = {
      ...user,
      organizationId: activeContext.associationId,
    };
    return true;
  }
}
