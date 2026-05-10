import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ApartmentsService } from './apartments.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class AdminApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Get(['admin/apartments', 'api/admin/apartments'])
  list(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.apartmentsService.listAdminApartments(user, query);
  }

  @Get(['admin/apartments/:id', 'api/admin/apartments/:id'])
  get(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.apartmentsService.getAdminApartment(user, id);
  }

  @Post(['admin/apartments', 'api/admin/apartments'])
  create(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.apartmentsService.createAdminApartment(user, body);
  }

  @Patch(['admin/apartments/:id', 'api/admin/apartments/:id'])
  update(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.apartmentsService.updateAdminApartment(user, id, body);
  }

  @Post(['admin/apartments/:id/residents', 'api/admin/apartments/:id/residents'])
  linkOrCreateResident(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.apartmentsService.linkOrCreateAdminResident(user, id, body);
  }

  @Patch(['admin/apartments/:id/primary-contact', 'api/admin/apartments/:id/primary-contact'])
  setPrimaryContact(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.apartmentsService.setPrimaryContact(user, id, body);
  }
}
