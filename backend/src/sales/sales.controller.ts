import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalesAgentGuard } from '../auth/guards/sales-agent.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, SalesAgentGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('my-organizations')
  getMyOrganizations(@CurrentUser() user: any) {
    return this.salesService.getMyOrganizations(user.id);
  }

  @Get('commission')
  getCommission(@CurrentUser() user: any) {
    return this.salesService.getCommission(user.id);
  }

  @Post('organizations')
  createOrganization(
    @CurrentUser() user: any,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.salesService.createOrganization(user.id, {
      organizationName: dto.organizationName,
      ownerEmail: dto.ownerEmail,
      ownerFirstName: dto.ownerFirstName,
      ownerLastName: dto.ownerLastName,
      ownerPassword: dto.ownerPassword,
    });
  }
}
