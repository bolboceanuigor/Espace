import { Controller, Get, Patch, Post, Body, Query, Req, Param } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller(['organizations', 'api/organizations'])
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  getMyOrganization(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.organizationsService.findMyOrganization(organizationId);
  }

  @Get('onboarding')
  getOnboardingState(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.organizationsService.getOnboardingState(
      organizationId,
      user.sub ?? user.id,
      user.role,
    );
  }

  @Patch('me')
  updateMyOrganization(
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.organizationsService.updateMyOrganization(
      organizationId,
      user.role,
      updateOrganizationDto,
    );
  }

  @Post('invite')
  inviteUser(@Body() inviteUserDto: InviteUserDto, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.organizationsService.inviteUser(
      organizationId,
      user.role,
      inviteUserDto,
    );
  }

  @Get('activity')
  getActivity(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Req() req?: Request,
  ) {
    const organizationId = getOrgScope(user, req ? getRequestedOrgId(req) : undefined);
    return this.organizationsService.getActivity(organizationId, user.role, {
      limit: limit ? Number(limit) : undefined,
      entityType,
      userId,
    });
  }

  @Post('onboarding/dismiss')
  dismissOnboarding(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.organizationsService.dismissOnboarding(organizationId, user.sub ?? user.id);
  }

  @Post('onboarding/load-demo')
  loadDemo(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.organizationsService.loadDemoData(
      organizationId,
      user.sub ?? user.id,
      user.role,
    );
  }

  @Public()
  @Get()
  listPublicOrganizations() {
    return this.organizationsService.listPublicOrganizations();
  }

  @Public()
  @Get(':id')
  getPublicOrganization(@Param('id') id: string) {
    return this.organizationsService.findPublicOrganization(id);
  }
}
