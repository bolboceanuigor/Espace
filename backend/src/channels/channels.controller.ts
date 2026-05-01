import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChannelsService } from './channels.service';
import { UpdatePropertyChannelDto } from './dto/update-property-channel.dto';
import { SyncIcalDto } from './dto/sync-ical.dto';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller('api/channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('settings')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async listSettings(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.channelsService.listSettings(organizationId);
  }

  @Patch('property/:propertyId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updatePropertyChannel(
    @CurrentUser() user: any,
    @Param('propertyId') propertyId: string,
    @Body() dto: UpdatePropertyChannelDto,
    @Req() req: Request,
  ) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.channelsService.updatePropertyChannel(organizationId, user.role, propertyId, dto);
  }

  @Post('ical/sync')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async syncIcal(@CurrentUser() user: any, @Body() dto: SyncIcalDto, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.channelsService.syncIcalPlaceholder(organizationId, user.role, dto);
  }
}

