import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { MessagesMvpService } from './messages-mvp.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
export class MessagesMvpController {
  constructor(private readonly messagesService: MessagesMvpService) {}

  @Get(['resident/messages', 'api/resident/messages'])
  @Roles(Role.RESIDENT)
  listResidentThreads(@CurrentUser() user: MvpUser) {
    return this.messagesService.listResidentThreads(user);
  }

  @Post(['resident/messages', 'api/resident/messages'])
  @Roles(Role.RESIDENT)
  sendResidentMessage(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.messagesService.sendResidentMessage(user, body);
  }

  @Get(['admin/messages', 'api/admin/messages'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listAdminThreads(@CurrentUser() user: MvpUser) {
    return this.messagesService.listAdminThreads(user);
  }

  @Post(['admin/messages', 'api/admin/messages'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  sendAdminMessage(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.messagesService.sendAdminMessage(user, body);
  }
}
