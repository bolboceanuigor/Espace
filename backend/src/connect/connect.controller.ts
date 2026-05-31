import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AdminAssociationGuard } from '../association-context/admin-association.guard';
import { MvpAuthGuard, MvpRolesGuard } from '../security/mvp-auth.guard';
import { ConnectService } from './connect.service';
import {
  ConnectResolutionDto,
  CreateAdminConnectConversationDto,
  CreateConnectMessageDto,
  CreateResidentConnectConversationDto,
  ListConnectConversationsDto,
  ListConnectResidentsDto,
  UpdateAdminConnectConversationDto,
} from './dto/connect.dto';

@Controller('api')
export class ConnectController {
  constructor(private readonly connectService: ConnectService) {}

  @Get('admin/connect/overview')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminOverview(@CurrentUser() user: any) {
    return this.connectService.adminOverview(user);
  }

  @Get('admin/connect/residents')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminResidents(@CurrentUser() user: any, @Query() query: ListConnectResidentsDto) {
    return this.connectService.adminRecipients(user, query);
  }

  @Get('admin/connect/conversations')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminConversations(@CurrentUser() user: any, @Query() query: ListConnectConversationsDto) {
    return this.connectService.adminList(user, query);
  }

  @Post('admin/connect/conversations')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminCreateConversation(@CurrentUser() user: any, @Body() dto: CreateAdminConnectConversationDto) {
    return this.connectService.adminCreate(user, dto);
  }

  @Get('admin/connect/conversations/:id')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminConversation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.connectService.adminDetail(user, id);
  }

  @Post('admin/connect/conversations/:id/messages')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminSendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateConnectMessageDto) {
    return this.connectService.adminSendMessage(user, id, dto);
  }

  @Post('admin/connect/conversations/:id/read')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.connectService.adminRead(user, id);
  }

  @Patch('admin/connect/conversations/:id')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminUpdateConversation(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAdminConnectConversationDto) {
    return this.connectService.adminUpdate(user, id, dto);
  }

  @Post('admin/connect/conversations/:id/resolve')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminResolve(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ConnectResolutionDto) {
    return this.connectService.adminResolve(user, id, dto);
  }

  @Post('admin/connect/conversations/:id/close')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminClose(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ConnectResolutionDto) {
    return this.connectService.adminClose(user, id, dto);
  }

  @Post('admin/connect/conversations/:id/reopen')
  @UseGuards(JwtAuthGuard, AdminAssociationGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminReopen(@CurrentUser() user: any, @Param('id') id: string) {
    return this.connectService.adminReopen(user, id);
  }

  @Get('resident/connect/overview')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentOverview(@CurrentUser() user: any) {
    return this.connectService.residentOverview(user);
  }

  @Get('resident/connect/context')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentContext(@CurrentUser() user: any) {
    return this.connectService.residentContext(user);
  }

  @Get('resident/connect/conversations')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentConversations(@CurrentUser() user: any, @Query() query: ListConnectConversationsDto) {
    return this.connectService.residentList(user, query);
  }

  @Post('resident/connect/conversations')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentCreateConversation(@CurrentUser() user: any, @Body() dto: CreateResidentConnectConversationDto) {
    return this.connectService.residentCreate(user, dto);
  }

  @Get('resident/connect/conversations/:id')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentConversation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.connectService.residentDetail(user, id);
  }

  @Post('resident/connect/conversations/:id/messages')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentSendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateConnectMessageDto) {
    return this.connectService.residentSendMessage(user, id, dto);
  }

  @Post('resident/connect/conversations/:id/read')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.connectService.residentRead(user, id);
  }

  @Post('resident/connect/conversations/:id/reopen')
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentReopen(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ConnectResolutionDto) {
    return this.connectService.residentReopen(user, id, dto);
  }
}
