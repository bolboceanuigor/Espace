import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ResidentsService } from './residents.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class AdminResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Get(['admin/residents', 'api/admin/residents'])
  list(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.residentsService.listAdminResidents(user, query);
  }

  @Get(['admin/residents/:id', 'api/admin/residents/:id'])
  get(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentsService.getAdminResident(user, id);
  }

  @Post(['admin/residents', 'api/admin/residents'])
  create(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.residentsService.createAdminResident(user, body);
  }

  @Patch(['admin/residents/:id', 'api/admin/residents/:id'])
  update(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentsService.updateAdminResident(user, id, body);
  }

  @Post(['admin/residents/:id/apartments', 'api/admin/residents/:id/apartments'])
  linkApartment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentsService.linkApartmentToAdminResident(user, id, body);
  }

  @Patch(['admin/residents/:id/apartments/:apartmentId', 'api/admin/residents/:id/apartments/:apartmentId'])
  updateApartmentRelation(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Param('apartmentId') apartmentId: string,
    @Body() body: unknown,
  ) {
    return this.residentsService.updateAdminResidentApartmentRelation(user, id, apartmentId, body);
  }

  @Delete(['admin/residents/:id/apartments/:apartmentId', 'api/admin/residents/:id/apartments/:apartmentId'])
  unlinkApartment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Param('apartmentId') apartmentId: string) {
    return this.residentsService.unlinkApartmentFromAdminResident(user, id, apartmentId);
  }

  @Patch(['admin/residents/:id/status', 'api/admin/residents/:id/status'])
  updateStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.residentsService.updateAdminResidentStatus(user, id, body);
  }
}
