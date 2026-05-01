import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { CommunicationsService } from './communications.service';
import {
  CreateAnnouncementCommentDto,
  CreateAnnouncementDto,
  CreateDocumentDto,
  ListAdminAnnouncementsDto,
  UpdateAnnouncementCommentDto,
  UpdateAnnouncementDto,
  UpdateDocumentDto,
} from './dto/communications.dto';

@Controller('api')
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Get('admin/announcements')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  listAdminAnnouncements(@CurrentUser() user: any, @Query() query: ListAdminAnnouncementsDto) {
    return this.service.listAdminAnnouncements(user, query);
  }

  @Post('admin/announcements')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  createAdminAnnouncement(@CurrentUser() user: any, @Body() dto: CreateAnnouncementDto) {
    return this.service.createAdminAnnouncement(user, dto);
  }

  @Patch('admin/announcements/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  updateAdminAnnouncement(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.service.updateAdminAnnouncement(user, id, dto);
  }

  @Delete('admin/announcements/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  deleteAdminAnnouncement(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteAdminAnnouncement(user, id);
  }

  @Patch('admin/announcements/:id/pin')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  pinAdminAnnouncement(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { isPinned?: boolean }) {
    return this.service.pinAdminAnnouncement(user, id, body?.isPinned);
  }

  @Patch('admin/announcements/:id/toggle-comments')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  toggleAdminAnnouncementComments(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { commentsEnabled?: boolean }) {
    return this.service.toggleAdminAnnouncementComments(user, id, body?.commentsEnabled);
  }

  @Get('admin/announcements/:id/comments')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  listAdminAnnouncementComments(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.listAdminAnnouncementComments(user, id);
  }

  @Patch('admin/announcement-comments/:id/hide')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  hideAdminAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.hideAdminAnnouncementComment(user, id);
  }

  @Patch('admin/announcement-comments/:id/show')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  showAdminAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.showAdminAnnouncementComment(user, id);
  }

  @Delete('admin/announcement-comments/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  deleteAdminAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteAdminAnnouncementComment(user, id);
  }

  @Get('admin/documents')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  listAdminDocuments(@CurrentUser() user: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listAdminDocuments(user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('admin/documents')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  createAdminDocument(@CurrentUser() user: any, @Body() dto: CreateDocumentDto) {
    return this.service.createAdminDocument(user, dto);
  }

  @Patch('admin/documents/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  updateAdminDocument(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.service.updateAdminDocument(user, id, dto);
  }

  @Delete('admin/documents/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  deleteAdminDocument(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteAdminDocument(user, id);
  }

  @Get('resident/announcements')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  listResidentAnnouncements(@CurrentUser() user: any) {
    return this.service.listResidentAnnouncements(user);
  }

  @Get('resident/announcements/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  getResidentAnnouncement(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getResidentAnnouncement(user, id);
  }

  @Get('resident/announcements/:id/comments')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  listResidentAnnouncementComments(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.listResidentAnnouncementComments(user, id);
  }

  @Post('resident/announcements/:id/comments')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  createResidentAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateAnnouncementCommentDto) {
    return this.service.createResidentAnnouncementComment(user, id, dto);
  }

  @Patch('resident/announcement-comments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  updateResidentAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAnnouncementCommentDto) {
    return this.service.updateResidentAnnouncementComment(user, id, dto);
  }

  @Delete('resident/announcement-comments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  deleteResidentAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteResidentAnnouncementComment(user, id);
  }

  @Get('resident/documents')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  listResidentDocuments(@CurrentUser() user: any) {
    return this.service.listResidentDocuments(user);
  }

  @Get('superadmin/activity')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminActivity(@CurrentUser() user: any) {
    return this.service.superadminActivity(user);
  }
}
