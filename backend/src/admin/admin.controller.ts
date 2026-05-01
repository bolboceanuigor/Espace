import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { addDays } from 'date-fns';
import { AdminService } from './admin.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { UpdateOrgStatusDto } from './dto/update-org-status.dto';
import { UpdateOrgPlanDto } from './dto/update-org-plan.dto';
import { SetCustomPriceDto } from './dto/set-custom-price.dto';
import { SetDiscountDto } from './dto/set-discount.dto';
import { ExtendTrialDto } from './dto/extend-trial.dto';
import { SetPropertyLimitDto } from './dto/set-property-limit.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('crm-stats')
  getCrmStats() {
    return this.adminService.getCrmStats();
  }

  @Get('organizations')
  getOrganizations(@Query('search') search?: string) {
    return this.adminService.getOrganizations(search ? { search } : undefined);
  }

  @Get('organization/:id')
  getOrganizationDetail(@Param('id') id: string) {
    return this.adminService.getOrganizationDetail(id);
  }

  @Get('platform-stats')
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Patch('organization/:id/status')
  updateOrganizationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrgStatusDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.adminService.updateOrganizationStatus(id, dto.isActive, user.id, user.role);
  }

  @Patch('organization/:id/activate')
  activateOrganization(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.adminService.updateOrganizationStatus(id, true, user.id, user.role);
  }

  @Patch('organization/:id/deactivate')
  deactivateOrganization(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.adminService.updateOrganizationStatus(id, false, user.id, user.role);
  }

  @Patch('organization/:id/plan')
  updateOrganizationPlan(
    @Param('id') id: string,
    @Body() dto: UpdateOrgPlanDto,
  ) {
    return this.adminService.updateOrganizationPlan(id, dto.plan);
  }

  @Patch('organization/:id/change-plan')
  changePlan(
    @Param('id') id: string,
    @Body() dto: UpdateOrgPlanDto,
  ) {
    return this.adminService.updateOrganizationPlan(id, dto.plan);
  }

  @Patch('organization/:id/custom-price')
  setCustomPrice(
    @Param('id') id: string,
    @Body() dto: SetCustomPriceDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.adminService.setCustomPrice(id, dto.customPrice, user.id, user.role);
  }

  @Patch('organization/:id/discount')
  setDiscount(
    @Param('id') id: string,
    @Body() dto: SetDiscountDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.adminService.setDiscountPercent(id, dto.discountPercent, user.id, user.role);
  }

  @Patch('organization/:id/extend-trial')
  extendTrial(
    @Param('id') id: string,
    @Body() dto: ExtendTrialDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const trialEndsAt = dto.trialEndsAt
      ? new Date(dto.trialEndsAt)
      : addDays(new Date(), typeof dto.extendDays === 'number' ? dto.extendDays : 14);
    return this.adminService.extendTrial(id, trialEndsAt, user.id, user.role);
  }

  @Patch('invoice/:id/mark-paid')
  markInvoicePaid(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.adminService.markInvoicePaid(id, user.id, user.role);
  }

  @Patch('organization/:id/property-limit')
  setPropertyLimit(
    @Param('id') id: string,
    @Body() dto: SetPropertyLimitDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.adminService.setPropertyLimit(id, dto.propertyLimit, user.id, user.role);
  }
}
