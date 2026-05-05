import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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
  @Roles(Role.RESIDENT)
  residentListConversations(@CurrentUser() user: any) {
    return this.chatService.residentListConversations(user);
  }

  @Post('resident/chat/conversations')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentCreateConversation(@CurrentUser() user: any, @Body() dto: CreateSupportConversationDto) {
    return this.chatService.residentCreateConversation(user, dto);
  }

  @Get('resident/chat/conversations/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentGetMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.residentGetMessages(user, id);
  }

  @Post('resident/chat/conversations/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentSendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.residentSendMessage(user, id, dto);
  }

  @Patch('resident/chat/conversations/:id/read')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentMarkRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.residentMarkRead(user, id);
  }

  @Get('resident/chat/community')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentListCommunityChats(@CurrentUser() user: any) {
    return this.chatService.residentListCommunityConversations(user);
  }

  @Get('resident/chat/community/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentGetCommunityMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.residentGetCommunityMessages(user, id);
  }

  @Post('resident/chat/community/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT)
  residentSendCommunityMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.residentSendCommunityMessage(user, id, dto);
  }

  @Get('admin/chat/conversations')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminListConversations(@CurrentUser() user: any, @Query() query: AdminConversationFiltersDto) {
    return this.chatService.adminListConversations(user, query);
  }

  @Get('admin/chat/conversations/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminGetMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminGetMessages(user, id);
  }

  @Post('admin/chat/conversations/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminSendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.adminSendMessage(user, id, dto);
  }

  @Patch('admin/chat/conversations/:id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminAssignConversation(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AssignConversationDto) {
    return this.chatService.adminAssignConversation(user, id, dto);
  }

  @Patch('admin/chat/conversations/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminUpdateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateConversationStatusDto) {
    return this.chatService.adminUpdateConversationStatus(user, id, dto);
  }

  @Patch('admin/chat/conversations/:id/read')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminMarkRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminMarkRead(user, id);
  }

  @Get('admin/chat/community')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminListCommunityChats(@CurrentUser() user: any) {
    return this.chatService.adminListCommunityConversations(user);
  }

  @Post('admin/chat/community')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminCreateCommunityChat(@CurrentUser() user: any, @Body() dto: CreateCommunityConversationDto) {
    return this.chatService.adminCreateCommunityConversation(user, dto);
  }

  @Get('admin/chat/community/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminGetCommunityMessages(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminGetCommunityMessages(user, id);
  }

  @Post('admin/chat/community/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminSendCommunityMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateChatMessageDto) {
    return this.chatService.adminSendCommunityMessage(user, id, dto);
  }

  @Patch('admin/chat/messages/:id/hide')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminHideChatMessage(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminHideMessage(user, id);
  }

  @Delete('admin/chat/messages/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminDeleteChatMessage(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.adminDeleteMessage(user, id);
  }
}
