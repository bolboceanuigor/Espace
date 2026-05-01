import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { ChatService } from './chat.service';
import {
  AdminConversationFiltersDto,
  AssignConversationDto,
  CreateChatMessageDto,
  CreateCommunityConversationDto,
  CreateSupportConversationDto,
  UpdateConversationStatusDto,
} from './dto/chat.dto';

@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('resident/chat/conversations')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentListConversations(@CurrentUser() user: any) {
    return this.chatService.residentListConversations(user);
  }

  @Post('resident/chat/conversations')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentCreateConversation(@CurrentUser() user: any, @Body() dto: CreateSupportConversationDto) {
    return this.chatService.residentCreateConversation(user, dto);
  }

  @Get('resident/chat/conversations/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentGetMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.residentGetMessages(user, id);
  }

  @Post('resident/chat/conversations/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentSendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.residentSendMessage(user, id, dto);
  }

  @Patch('resident/chat/conversations/:id/read')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentMarkRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.residentMarkRead(user, id);
  }

  @Get('resident/chat/community')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentListCommunityChats(@CurrentUser() user: any) {
    return this.chatService.residentListCommunityConversations(user);
  }

  @Get('resident/chat/community/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentGetCommunityMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.residentGetCommunityMessages(user, id);
  }

  @Post('resident/chat/community/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  residentSendCommunityMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.residentSendCommunityMessage(user, id, dto);
  }

  @Get('admin/chat/conversations')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminListConversations(@CurrentUser() user: any, @Query() query: AdminConversationFiltersDto) {
    return this.chatService.adminListConversations(user, query);
  }

  @Get('admin/chat/conversations/:id/messages')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminGetMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminGetMessages(user, id);
  }

  @Post('admin/chat/conversations/:id/messages')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminSendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.adminSendMessage(user, id, dto);
  }

  @Patch('admin/chat/conversations/:id/assign')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminAssignConversation(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AssignConversationDto) {
    return this.chatService.adminAssignConversation(user, id, dto);
  }

  @Patch('admin/chat/conversations/:id/status')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminUpdateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateConversationStatusDto) {
    return this.chatService.adminUpdateConversationStatus(user, id, dto);
  }

  @Patch('admin/chat/conversations/:id/read')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminMarkRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminMarkRead(user, id);
  }

  @Get('admin/chat/community')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminListCommunityChats(@CurrentUser() user: any) {
    return this.chatService.adminListCommunityConversations(user);
  }

  @Post('admin/chat/community')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminCreateCommunityChat(@CurrentUser() user: any, @Body() dto: CreateCommunityConversationDto) {
    return this.chatService.adminCreateCommunityConversation(user, dto);
  }

  @Get('admin/chat/community/:id/messages')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminGetCommunityMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminGetCommunityMessages(user, id);
  }

  @Post('admin/chat/community/:id/messages')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminSendCommunityMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.adminSendCommunityMessage(user, id, dto);
  }

  @Patch('admin/chat/messages/:id/hide')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminHideChatMessage(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminHideMessage(user, id);
  }

  @Delete('admin/chat/messages/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminDeleteChatMessage(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminDeleteMessage(user, id);
  }
}
