import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get(['admin/announcements', 'api/admin/announcements'])
  listAdminAnnouncements(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.communityReadService.listAdminAnnouncements(user, query);
  }

  @Get(['admin/announcements/stats', 'api/admin/announcements/stats'])
  getAdminAnnouncementStats(@CurrentUser() user: MvpUser) {
    return this.communityReadService.getAdminAnnouncementStats(user);
  }

  @Post(['announcements', 'api/announcements'])
  createAnnouncement(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.communityReadService.createAnnouncement(user, body);
  }

  @Post(['admin/announcements', 'api/admin/announcements'])
  createAdminAnnouncement(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.communityReadService.createAdminAnnouncement(user, body);
  }

  @Get(['admin/announcements/:id/read-stats', 'api/admin/announcements/:id/read-stats'])
  getAdminAnnouncementReadStats(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getAdminAnnouncementReadStats(user, id);
  }

  @Get(['admin/announcements/:id', 'api/admin/announcements/:id'])
  getAdminAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getAdminAnnouncement(user, id);
  }

  @Patch(['admin/announcements/:id', 'api/admin/announcements/:id'])
  updateAdminAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.updateAdminAnnouncement(user, id, body);
  }

  @Patch(['admin/announcements/:id/publish', 'api/admin/announcements/:id/publish'])
  publishAdminAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.publishAdminAnnouncement(user, id);
  }

  @Patch(['admin/announcements/:id/archive', 'api/admin/announcements/:id/archive'])
  archiveAdminAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.archiveAdminAnnouncement(user, id);
  }

  @Post(['admin/announcements/:id/duplicate', 'api/admin/announcements/:id/duplicate'])
  duplicateAdminAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.duplicateAdminAnnouncement(user, id);
  }

  @Delete(['admin/announcements/:id', 'api/admin/announcements/:id'])
  deleteAdminAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.deleteAdminAnnouncement(user, id);
  }

  @Get(['announcements/:id', 'api/announcements/:id'])
  getAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getAnnouncement(user, id);
  }

  @Roles(Role.RESIDENT)
  @Get(['resident/announcements/recent', 'api/resident/announcements/recent'])
  listRecentResidentAnnouncements(@CurrentUser() user: MvpUser) {
    return this.communityReadService.listRecentResidentAnnouncements(user);
  }

  @Roles(Role.RESIDENT)
  @Get(['resident/announcements/stats', 'api/resident/announcements/stats'])
  getResidentAnnouncementStats(@CurrentUser() user: MvpUser) {
    return this.communityReadService.getResidentAnnouncementStats(user);
  }

  @Roles(Role.RESIDENT)
  @Get(['resident/announcements', 'api/resident/announcements'])
  listResidentAnnouncements(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.communityReadService.listResidentAnnouncements(user, query);
  }

  @Roles(Role.RESIDENT)
  @Get(['resident/announcements/:id', 'api/resident/announcements/:id'])
  getResidentAnnouncement(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getResidentAnnouncement(user, id);
  }

  @Roles(Role.RESIDENT)
  @Patch(['resident/announcements/:id/read', 'api/resident/announcements/:id/read'])
  markResidentAnnouncementRead(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.markResidentAnnouncementRead(user, id);
  }
}
