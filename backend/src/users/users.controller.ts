import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.usersService.create({
      ...createUserDto,
      organizationId,
    });
  }

  @Get()
  findAll(@CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.usersService.findAll(organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.usersService.findOneInOrg(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.usersService.updateInOrg(id, organizationId, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.usersService.removeInOrg(id, organizationId);
  }
}
