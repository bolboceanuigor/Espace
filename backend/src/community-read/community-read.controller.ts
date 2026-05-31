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

  @Roles(Role.RESIDENT)
  @Get(['resident/requests', 'api/resident/requests'])
  listResidentRequests(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.communityReadService.listResidentRequests(user, query);
  }

  @Roles(Role.RESIDENT)
  @Get(['resident/requests/stats', 'api/resident/requests/stats'])
  getResidentRequestStats(@CurrentUser() user: MvpUser) {
    return this.communityReadService.getResidentRequestStats(user);
  }

  @Roles(Role.RESIDENT)
  @Get(['resident/requests/overview', 'api/resident/requests/overview'])
  getResidentRequestsOverview(@CurrentUser() user: MvpUser) {
    return this.communityReadService.getResidentRequestsOverview(user);
  }

  @Roles(Role.RESIDENT)
  @Post(['resident/requests', 'api/resident/requests'])
  createResidentRequest(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.communityReadService.createResidentRequest(user, body);
  }

  @Roles(Role.RESIDENT)
  @Get(['resident/requests/:id', 'api/resident/requests/:id'])
  getResidentRequest(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getResidentRequest(user, id);
  }

  @Roles(Role.RESIDENT)
  @Post(['resident/requests/:id/comments', 'api/resident/requests/:id/comments'])
  addResidentRequestComment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.addResidentRequestComment(user, id, body);
  }

  @Roles(Role.RESIDENT)
  @Patch(['resident/requests/:id/cancel', 'api/resident/requests/:id/cancel'])
  cancelResidentRequest(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.cancelResidentRequest(user, id);
  }

  @Roles(Role.RESIDENT)
  @Patch(['resident/requests/:id/close', 'api/resident/requests/:id/close'])
  closeResidentRequestLegacy(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.closeResidentRequest(user, id, body);
  }

  @Roles(Role.RESIDENT)
  @Post(['resident/requests/:id/close', 'api/resident/requests/:id/close'])
  closeResidentRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.closeResidentRequest(user, id, body);
  }

  @Roles(Role.RESIDENT)
  @Post(['resident/requests/:id/reopen', 'api/resident/requests/:id/reopen'])
  reopenResidentRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.reopenResidentRequest(user, id, body);
  }

  @Roles(Role.RESIDENT)
  @Patch(['resident/requests/:id/mark-resolved', 'api/resident/requests/:id/mark-resolved'])
  markResidentRequestResolved(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.markResidentRequestResolved(user, id);
  }

  @Get(['admin/requests', 'api/admin/requests'])
  listAdminRequests(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.communityReadService.listAdminRequests(user, query);
  }

  @Get(['admin/requests/stats', 'api/admin/requests/stats'])
  getAdminRequestStats(@CurrentUser() user: MvpUser) {
    return this.communityReadService.getAdminRequestStats(user);
  }

  @Get(['admin/requests/overview', 'api/admin/requests/overview'])
  getAdminRequestsOverview(@CurrentUser() user: MvpUser) {
    return this.communityReadService.getAdminRequestsOverview(user);
  }

  @Get(['admin/requests/issues', 'api/admin/requests/issues'])
  listAdminRequestIssues(@CurrentUser() user: MvpUser, @Query() query: Record<string, string | undefined>) {
    return this.communityReadService.listAdminRequestIssues(user, query);
  }

  @Get(['admin/requests/:id', 'api/admin/requests/:id'])
  getAdminRequest(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.getAdminRequest(user, id);
  }

  @Patch(['admin/requests/:id', 'api/admin/requests/:id'])
  updateAdminRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.updateAdminRequest(user, id, body);
  }

  @Patch(['admin/requests/:id/status', 'api/admin/requests/:id/status'])
  updateAdminRequestStatus(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.updateAdminRequestStatus(user, id, body);
  }

  @Patch(['admin/requests/:id/priority', 'api/admin/requests/:id/priority'])
  updateAdminRequestPriority(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.updateAdminRequestPriority(user, id, body);
  }

  @Patch(['admin/requests/:id/assign', 'api/admin/requests/:id/assign'])
  assignAdminRequestLegacy(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.assignAdminRequest(user, id, body);
  }

  @Post(['admin/requests/:id/assign', 'api/admin/requests/:id/assign'])
  assignAdminRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.assignAdminRequest(user, id, body);
  }

  @Post(['admin/requests/:id/comments', 'api/admin/requests/:id/comments'])
  addAdminRequestComment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.addAdminRequestComment(user, id, body);
  }

  @Post(['admin/requests/:id/internal-notes', 'api/admin/requests/:id/internal-notes'])
  addAdminRequestInternalNote(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.addAdminRequestInternalNote(user, id, body);
  }

  @Patch(['admin/requests/:id/resolve', 'api/admin/requests/:id/resolve'])
  resolveAdminRequestLegacy(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.resolveAdminRequest(user, id, body);
  }

  @Post(['admin/requests/:id/resolve', 'api/admin/requests/:id/resolve'])
  resolveAdminRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.resolveAdminRequest(user, id, body);
  }

  @Patch(['admin/requests/:id/close', 'api/admin/requests/:id/close'])
  closeAdminRequestLegacy(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.closeAdminRequest(user, id, body);
  }

  @Post(['admin/requests/:id/close', 'api/admin/requests/:id/close'])
  closeAdminRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.closeAdminRequest(user, id, body);
  }

  @Post(['admin/requests/:id/cancel', 'api/admin/requests/:id/cancel'])
  cancelAdminRequest(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.communityReadService.cancelAdminRequest(user, id, body);
  }

  @Patch(['admin/requests/:id/reopen', 'api/admin/requests/:id/reopen'])
  reopenAdminRequest(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.reopenAdminRequest(user, id);
  }

  @Get(['admin/residents/:id/requests', 'api/admin/residents/:id/requests'])
  listAdminResidentRequests(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.listAdminResidentRequests(user, id);
  }

  @Get(['admin/apartments/:id/requests', 'api/admin/apartments/:id/requests'])
  listAdminApartmentRequests(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.communityReadService.listAdminApartmentRequests(user, id);
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
