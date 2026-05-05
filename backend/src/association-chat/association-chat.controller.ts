import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';
import { AssociationChatService } from './association-chat.service';
import { CreateAssociationChatMessageDto } from './dto/create-association-chat-message.dto';
import { ListAssociationChatMessagesDto } from './dto/list-association-chat-messages.dto';

@Controller(['association-chat', 'api/association-chat'])
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN, Role.RESIDENT)
export class AssociationChatController {
  constructor(private readonly associationChatService: AssociationChatService) {}

  @Get('messages')
  listMessages(@CurrentUser() user: any, @Req() req: Request, @Query() query: ListAssociationChatMessagesDto) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    return this.associationChatService.listMessages(organizationId, query);
  }

  @Post('messages')
  sendMessage(@CurrentUser() user: any, @Req() req: Request, @Body() dto: CreateAssociationChatMessageDto) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    const userId = user?.id ?? user?.sub;
    return this.associationChatService.sendMessage(organizationId, userId, dto.text);
  }
}
