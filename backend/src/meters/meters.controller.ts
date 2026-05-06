import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { MetersService } from './meters.service';

@Controller(['meters', 'api/meters'])
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  @Get()
  listMeters(@CurrentUser() user: MvpUser) {
    return this.metersService.listMeters(user);
  }

  @Post()
  createMeter(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.metersService.createMeter(user, body);
  }

  @Post(':meterId/readings')
  addReading(@CurrentUser() user: MvpUser, @Param('meterId') meterId: string, @Body() body: unknown) {
    return this.metersService.addReading(user, meterId, body);
  }

  @Get(':id')
  getMeter(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.metersService.getMeter(user, id);
  }
}
