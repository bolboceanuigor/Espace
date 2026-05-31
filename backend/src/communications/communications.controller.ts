import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listAdminAnnouncements(@CurrentUser() user: any, @Query() query: ListAdminAnnouncementsDto) {
    return this.service.listAdminAnnouncements(user, query);
  }

  @Post('admin/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createAdminAnnouncement(@CurrentUser() user: any, @Body() dto: CreateAnnouncementDto) {
    return this.service.createAdminAnnouncement(user, dto);
  }

  @Patch('admin/announcements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateAdminAnnouncement(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.service.updateAdminAnnouncement(user, id, dto);
  }

  @Delete('admin/announcements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteAdminAnnouncement(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteAdminAnnouncement(user, id);
  }

  @Patch('admin/announcements/:id/pin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  pinAdminAnnouncement(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { isPinned?: boolean }) {
    return this.service.pinAdminAnnouncement(user, id, body?.isPinned);
  }

  @Patch('admin/announcements/:id/toggle-comments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  toggleAdminAnnouncementComments(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { commentsEnabled?: boolean }) {
    return this.service.toggleAdminAnnouncementComments(user, id, body?.commentsEnabled);
  }

  @Get('admin/announcements/:id/comments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listAdminAnnouncementComments(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.listAdminAnnouncementComments(user, id);
  }

  @Patch('admin/announcement-comments/:id/hide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  hideAdminAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.hideAdminAnnouncementComment(user, id);
  }

  @Patch('admin/announcement-comments/:id/show')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  showAdminAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.showAdminAnnouncementComment(user, id);
  }

  @Delete('admin/announcement-comments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteAdminAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteAdminAnnouncementComment(user, id);
  }

  @Get('admin/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listAdminDocuments(@CurrentUser() user: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listAdminDocuments(user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('admin/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createAdminDocument(@CurrentUser() user: any, @Body() dto: CreateDocumentDto) {
    return this.service.createAdminDocument(user, dto);
  }

  @Patch('admin/documents/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateAdminDocument(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.service.updateAdminDocument(user, id, dto);
  }

  @Delete('admin/documents/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteAdminDocument(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteAdminDocument(user, id);
  }

  @Get('resident/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  listResidentAnnouncements(@CurrentUser() user: any) {
    return this.service.listResidentAnnouncements(user);
  }

  @Get('resident/announcements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  getResidentAnnouncement(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getResidentAnnouncement(user, id);
  }

  @Get('resident/announcements/:id/comments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  listResidentAnnouncementComments(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.listResidentAnnouncementComments(user, id);
  }

  @Post('resident/announcements/:id/comments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  createResidentAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateAnnouncementCommentDto) {
    return this.service.createResidentAnnouncementComment(user, id, dto);
  }

  @Patch('resident/announcement-comments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  updateResidentAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAnnouncementCommentDto) {
    return this.service.updateResidentAnnouncementComment(user, id, dto);
  }

  @Delete('resident/announcement-comments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  deleteResidentAnnouncementComment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteResidentAnnouncementComment(user, id);
  }

  @Get('resident/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESIDENT)
  listResidentDocuments(@CurrentUser() user: any) {
    return this.service.listResidentDocuments(user);
  }

  @Get('superadmin/activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPERADMIN)
  superadminActivity(@CurrentUser() user: any) {
    return this.service.superadminActivity(user);
  }
}
