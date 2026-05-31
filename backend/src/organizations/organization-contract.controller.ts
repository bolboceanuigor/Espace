import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { OrganizationContractService } from './organization-contract.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.SUPERADMIN)
export class OrganizationContractController {
  constructor(private readonly organizationContractService: OrganizationContractService) {}

  @Get(['superadmin/organizations/:id/contract', 'api/superadmin/organizations/:id/contract'])
  getContract(@Param('id') id: string) {
    return this.organizationContractService.getCommercialSummary(id);
  }

  @Put(['superadmin/organizations/:id/contract', 'api/superadmin/organizations/:id/contract'])
  upsertContract(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.organizationContractService.upsertContract(user, id, body);
  }

  @Put(['superadmin/organizations/:id/subscription', 'api/superadmin/organizations/:id/subscription'])
  upsertSubscription(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.organizationContractService.upsertSubscription(user, id, body);
  }
}
