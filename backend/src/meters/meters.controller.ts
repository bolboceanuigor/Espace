import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { MetersService } from './meters.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Get(['meters', 'api/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listMeters(@CurrentUser() user: MvpUser) {
    return this.metersService.listMeters(user);
  }

  @Post(['meters', 'api/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createMeter(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.metersService.createMeter(user, body);
  }

  @Post(['meters/:meterId/readings', 'api/meters/:meterId/readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  addReading(@CurrentUser() user: MvpUser, @Param('meterId') meterId: string, @Body() body: unknown) {
    return this.metersService.addReading(user, meterId, body);
  }

  @Get(['meters/:id', 'api/meters/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  getMeter(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getMeter(user, id);
  }

  @Get(['admin/meters', 'api/admin/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listAdminMeters(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.listAdminMeters(user, query);
  }

  @Post(['admin/meters', 'api/admin/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createAdminMeter(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.metersService.createMeter(user, body);
  }

  @Get(['admin/meters/:id', 'api/admin/meters/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  getAdminMeter(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getMeter(user, id);
  }

  @Patch(['admin/meters/:id', 'api/admin/meters/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  updateAdminMeter(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.metersService.updateMeter(user, id, body);
  }

  @Patch(['admin/meters/:id/status', 'api/admin/meters/:id/status'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  changeAdminMeterStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.metersService.changeMeterStatus(user, id, body);
  }

  @Get(['admin/meter-readings/stats', 'api/admin/meter-readings/stats'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  getReadingStats(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.getReadingStats(user, query);
  }

  @Get(['admin/meter-readings', 'api/admin/meter-readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listAdminReadings(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.metersService.listAdminReadings(user, query);
  }

  @Post(['admin/meter-readings', 'api/admin/meter-readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createAdminReading(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.metersService.createAdminReading(user, body);
  }

  @Get(['admin/meter-readings/:id', 'api/admin/meter-readings/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  getAdminReading(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getAdminReading(user, id);
  }

  @Patch(['admin/meter-readings/:id/approve', 'api/admin/meter-readings/:id/approve'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  approveReading(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.metersService.approveReading(user, id, body);
  }

  @Patch(['admin/meter-readings/:id/reject', 'api/admin/meter-readings/:id/reject'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  rejectReading(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.metersService.rejectReading(user, id, body);
  }

  @Patch(['admin/meter-readings/:id/needs-review', 'api/admin/meter-readings/:id/needs-review'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  markReadingNeedsReview(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.metersService.markReadingNeedsReview(user, id, body);
  }

  @Get(['admin/apartments/:id/meters', 'api/admin/apartments/:id/meters'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listApartmentMeters(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.listApartmentMeters(user, id);
  }

  @Get(['admin/apartments/:id/meter-readings', 'api/admin/apartments/:id/meter-readings'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listApartmentReadings(@CurrentUser() user: MvpUser, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.metersService.listApartmentReadings(user, id, query);
  }
}
