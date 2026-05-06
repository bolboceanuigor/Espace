import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ResidentsService } from './residents.service';

@Controller(['residents', 'api/residents'])
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Get()
  listResidents(@CurrentUser() user: MvpUser) {
    return this.residentsService.listResidents(user);
  }

  @Post()
  createResident(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.residentsService.createResident(user, body);
  }

  @Get(':id')
  getResident(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.residentsService.getResident(user, id);
  }
}
