import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SaasLimitEnforcementService } from '../saas-usage/saas-limit-enforcement.service';
import { ResidentsService } from './residents.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class AdminResidentsController {
  constructor(
    private readonly residentsService: ResidentsService,
    private readonly saasLimits: SaasLimitEnforcementService,
  ) {}

  @Get(['admin/resident-update-requests', 'api/admin/resident-update-requests'])
  @RequirePermission('RESIDENTS', 'VIEW')
  listUpdateRequests(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.residentsService.listAdminResidentUpdateRequests(user, query);
  }

  @Get(['admin/resident-update-requests/stats', 'api/admin/resident-update-requests/stats'])
  @RequirePermission('RESIDENTS', 'VIEW')
  updateRequestStats(@CurrentUser() user: MvpUser) {
    return this.residentsService.getAdminResidentUpdateRequestStats(user);
  }

  @Get(['admin/resident-update-requests/:id', 'api/admin/resident-update-requests/:id'])
  @RequirePermission('RESIDENTS', 'VIEW')
  getUpdateRequest(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentsService.getAdminResidentUpdateRequest(user, id);
  }

  @Patch(['admin/resident-update-requests/:id/approve', 'api/admin/resident-update-requests/:id/approve'])
  @RequirePermission('RESIDENTS', 'UPDATE')
  async approveUpdateRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.residentsService.approveAdminResidentUpdateRequest(user, id, body);
  }

  @Patch(['admin/resident-update-requests/:id/reject', 'api/admin/resident-update-requests/:id/reject'])
  @RequirePermission('RESIDENTS', 'UPDATE')
  async rejectUpdateRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.residentsService.rejectAdminResidentUpdateRequest(user, id, body);
  }

  @Get(['admin/residents', 'api/admin/residents'])
  @RequirePermission('RESIDENTS', 'VIEW')
  list(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.residentsService.listAdminResidents(user, query);
  }

  @Get(['admin/owners', 'api/admin/owners'])
  @RequirePermission('RESIDENTS', 'VIEW')
  listOwners(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.residentsService.listAdminOwners(user, query);
  }

  @Get(['admin/residents/:id/update-requests', 'api/admin/residents/:id/update-requests'])
  @RequirePermission('RESIDENTS', 'VIEW')
  residentUpdateRequests(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentsService.listAdminResidentUpdateRequestsForResident(user, id);
  }

  @Get(['admin/residents/:id', 'api/admin/residents/:id'])
  @RequirePermission('RESIDENTS', 'VIEW')
  get(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentsService.getAdminResident(user, id);
  }

  @Get(['admin/owners/:id', 'api/admin/owners/:id'])
  @RequirePermission('RESIDENTS', 'VIEW')
  getOwner(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentsService.getAdminOwner(user, id);
  }

  @Post(['admin/residents', 'api/admin/residents'])
  @RequirePermission('RESIDENTS', 'CREATE')
  async create(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    await this.saasLimits.assertCanCreateResident(user.organizationId, user);
    return this.residentsService.createAdminResident(user, body);
  }

  @Patch(['admin/residents/:id', 'api/admin/residents/:id'])
  @RequirePermission('RESIDENTS', 'UPDATE')
  async update(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.residentsService.updateAdminResident(user, id, body);
  }

  @Post(['admin/residents/:id/apartments', 'api/admin/residents/:id/apartments'])
  @RequirePermission('RESIDENTS', 'UPDATE')
  async linkApartment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.residentsService.linkApartmentToAdminResident(user, id, body);
  }

  @Patch(['admin/residents/:id/apartments/:apartmentId', 'api/admin/residents/:id/apartments/:apartmentId'])
  @RequirePermission('RESIDENTS', 'UPDATE')
  async updateApartmentRelation(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('apartmentId') apartmentId: string,
    @Body() body: unknown,
  ) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.residentsService.updateAdminResidentApartmentRelation(user, id, apartmentId, body);
  }

  @Delete(['admin/residents/:id/apartments/:apartmentId', 'api/admin/residents/:id/apartments/:apartmentId'])
  @RequirePermission('RESIDENTS', 'DELETE')
  async unlinkApartment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('apartmentId') apartmentId: string) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.residentsService.unlinkApartmentFromAdminResident(user, id, apartmentId);
  }

  @Patch(['admin/residents/:id/status', 'api/admin/residents/:id/status'])
  @RequirePermission('RESIDENTS', 'UPDATE')
  async updateStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    await this.saasLimits.assertSubscriptionAllowsWrite(user.organizationId, user);
    return this.residentsService.updateAdminResidentStatus(user, id, body);
  }
}
