import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssociationContextService } from './association-context.service';
import { AdminAssociationGuard } from './admin-association.guard';
import type { AssociationContextUser, RequestWithTenantContext } from './association-context.types';

@Controller('api')
export class AssociationContextController {
  constructor(private readonly associationContext: AssociationContextService) {}

  @Get('admin/context')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard)
  getAdminContext(@Req() request: RequestWithTenantContext) {
    return {
      user: this.userSummary(request.user),
      activeAssociation: request.associationContext?.activeAssociation,
      membership: request.associationContext
        ? {
            id: request.associationContext.membershipId,
            status: request.associationContext.activeAssociation.membershipStatus,
            role: {
              id: request.associationContext.roleId,
              name: request.associationContext.roleName,
              type: request.associationContext.roleType,
            },
          }
        : null,
      permissions: request.associationContext?.permissions || [],
      permissionLabels: request.associationContext?.permissionLabels || [],
      availableAssociations: request.associationContext?.availableAssociations || [],
      isSupportMode: Boolean(request.associationContext?.isSupportMode),
      supportSession: request.associationContext?.supportSession || null,
      warnings: [],
    };
  }

  @Post('admin/context/switch-association')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard)
  async switchAdminAssociation(
    @CurrentUser() user: AssociationContextUser,
    @Req() request: RequestWithTenantContext,
    @Body() body: { associationId?: string },
  ) {
    const associationId = String(body?.associationId || '').trim();
    if (!associationId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Asociația este obligatorie.',
      });
    }
    const context = await this.associationContext.switchAdminAssociation(user, request, associationId);
    return {
      activeAssociation: context.activeAssociation,
      membership: {
        id: context.membershipId,
        status: context.activeAssociation.membershipStatus,
        role: { id: context.roleId, name: context.roleName, type: context.roleType },
      },
      permissions: context.permissions,
      permissionLabels: context.permissionLabels,
      availableAssociations: context.availableAssociations,
    };
  }

  @Get('resident/context')
  @UseGuards(JwtAuthGuard)
  async getResidentContext(@CurrentUser() user: AssociationContextUser) {
    const context = await this.associationContext.getResidentAssociationContext(user);
    return {
      user: this.userSummary(user),
      resident: {
        id: context.residentId,
      },
      portalAccessStatus: context.portalAccessStatus,
      apartments: context.apartments,
      associations: context.associations,
      activeAssociation: context.activeAssociation,
      warnings: [],
    };
  }

  private userSummary(user?: AssociationContextUser | null) {
    if (!user) return null;
    return {
      id: user.id || user.sub,
      fullName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      email: user.email || null,
      role: user.role || null,
    };
  }
}
