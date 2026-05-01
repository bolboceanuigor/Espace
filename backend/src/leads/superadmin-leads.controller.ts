import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller(['superadmin/leads', 'api/superadmin/leads'])
@UseGuards(RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  list(@Query('city') city?: string, @Query('source') source?: string, @Query('status') status?: string) {
    return this.leadsService.listForSuperadmin({ city, source, status });
  }

  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.createForSuperadmin(dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.leadsService.getForSuperadmin(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.updateForSuperadmin(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.leadsService.deleteForSuperadmin(id);
  }

  @Post(':id/activities')
  addActivity(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: CreateLeadActivityDto) {
    return this.leadsService.addActivity(id, user?.sub || user?.id, dto);
  }

  @Post(':id/convert-to-organization')
  convertToOrganization(@Param('id') id: string, @Body() dto: ConvertLeadDto) {
    return this.leadsService.convertToOrganization(id, dto);
  }
}

