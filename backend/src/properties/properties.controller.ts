import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';
import { getOrgId } from '../common/org-scope';

@Controller(['properties', 'api/properties'])
@UseGuards(JwtAuthGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() createPropertyDto: CreatePropertyDto, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.propertiesService.create(userId, organizationId, user.role, createPropertyDto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('showArchived') showArchived: string | undefined, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.propertiesService.findAll(organizationId, userId, user.role, showArchived);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.propertiesService.getStats(id, organizationId, userId, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.propertiesService.findOne(id, organizationId, userId, user.role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.propertiesService.update(id, organizationId, userId, user.role, updatePropertyDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const userId = user.sub ?? user.id;
    const organizationId = getOrgId(user, req);
    return this.propertiesService.remove(id, organizationId, userId, user.role);
  }

  @Get('/meta/groups')
  listGroups(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.propertiesService.listGroups(organizationId);
  }

  @Post('/meta/groups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createGroup(@CurrentUser() user: any, @Body('name') name: string, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.propertiesService.createGroup(organizationId, user.role, name);
  }
}
