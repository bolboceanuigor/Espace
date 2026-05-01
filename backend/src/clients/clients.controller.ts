import {
  Controller,
  Get,
  Body,
  Post,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';
import { getOrgId } from '../common/org-scope';

@Controller(['clients', 'api/clients'])
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  create(@Body() createClientDto: CreateClientDto, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.clientsService.create(organizationId, user.id, user.role, createClientDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('showArchived') showArchived: string | undefined,
    @Req() req: Request,
  ) {
    const organizationId = getOrgId(user, req);
    return this.clientsService.findAll(organizationId, page, pageSize, showArchived);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.clientsService.findOne(id, organizationId);
  }

  @Get(':id/reservations')
  findReservations(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.clientsService.findReservations(id, organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.clientsService.update(id, organizationId, user.role, user.id, updateClientDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgId(user, req);
    return this.clientsService.remove(id, organizationId, user.role);
  }
}
