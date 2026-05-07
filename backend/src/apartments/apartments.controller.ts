import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { ApartmentsService } from './apartments.service';

@Controller(['apartments', 'api/apartments'])
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Get()
  listApartments(@CurrentUser() user: MvpUser) {
    return this.apartmentsService.listApartments(user);
  }

  @Post()
  createApartment(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.apartmentsService.createApartment(user, body);
  }

  @Post(':apartmentId/residents')
  linkResident(@CurrentUser() user: MvpUser, @Param('apartmentId') apartmentId: string, @Body() body: unknown) {
    return this.apartmentsService.linkResident(user, apartmentId, body);
  }

  @Get(':id/financial-summary')
  getFinancialSummary(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.apartmentsService.getFinancialSummary(user, id);
  }

  @Get(':id')
  getApartment(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.apartmentsService.getApartment(user, id);
  }
}
