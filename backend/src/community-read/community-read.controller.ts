import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { CommunityReadService } from './community-read.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class CommunityReadController {
  constructor(private readonly communityReadService: CommunityReadService) {}

  @Get(['issues', 'api/issues'])
  listIssues(@CurrentUser() user: MvpUser) {
    return this.communityReadService.listIssues(user);
  }

  @Get(['issues/:id', 'api/issues/:id'])
  getIssue(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getIssue(user, id);
  }

  @Patch(['issues/:id/status', 'api/issues/:id/status'])
  updateIssueStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.updateIssueStatus(user, id, body);
  }

  @Get(['announcements', 'api/announcements'])
  listAnnouncements(@CurrentUser() user: MvpUser) {
    return this.communityReadService.listAnnouncements(user);
  }

  @Post(['announcements', 'api/announcements'])
  createAnnouncement(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.communityReadService.createAnnouncement(user, body);
  }

  @Get(['announcements/:id', 'api/announcements/:id'])
  getAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getAnnouncement(user, id);
  }
}
