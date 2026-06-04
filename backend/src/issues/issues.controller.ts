import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, type MvpUser } from '../security/mvp-auth.guard';
import {
  AdminIssueFiltersDto,
  AdminUpdateIssueDto,
  CreateIssueAttachmentDto,
  CreateIssueCommentDto,
  CreateResidentIssueDto,
  ResidentIssueFiltersDto,
} from './dto/issues.dto';
import { IssuesService } from './issues.service';

@Controller('api')
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get('resident/issues')
  @Roles(Role.RESIDENT)
  residentList(@CurrentUser() user: MvpUser, @Query() query: ResidentIssueFiltersDto) {
    return this.issuesService.residentList(user, query);
  }

  @Post('resident/issues')
  @Roles(Role.RESIDENT)
  residentCreate(@CurrentUser() user: MvpUser, @Body() body: CreateResidentIssueDto) {
    return this.issuesService.residentCreate(user, body);
  }

  @Get('resident/issues/:id')
  @Roles(Role.RESIDENT)
  residentGetOne(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.issuesService.residentGetOne(user, id);
  }

  @Post('resident/issues/:id/comments')
  @Roles(Role.RESIDENT)
  residentAddComment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: CreateIssueCommentDto) {
    return this.issuesService.residentAddComment(user, id, body);
  }

  @Post('resident/issues/:id/attachments')
  @Roles(Role.RESIDENT)
  residentAddAttachment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: CreateIssueAttachmentDto) {
    return this.issuesService.residentAddAttachment(user, id, body);
  }

  @Get('admin/issues')
  @Roles(Role.ADMIN)
  @RequirePermission('REQUESTS', 'VIEW')
  adminList(@CurrentUser() user: MvpUser, @Query() query: AdminIssueFiltersDto) {
    return this.issuesService.adminList(user, query);
  }

  @Get('admin/issues/:id')
  @Roles(Role.ADMIN)
  @RequirePermission('REQUESTS', 'VIEW')
  adminGetOne(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.issuesService.adminGetOne(user, id);
  }

  @Patch('admin/issues/:id')
  @Roles(Role.ADMIN)
  @RequirePermission('REQUESTS', 'MANAGE')
  adminUpdate(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: AdminUpdateIssueDto) {
    return this.issuesService.adminUpdate(user, id, body);
  }

  @Post('admin/issues/:id/comments')
  @Roles(Role.ADMIN)
  @RequirePermission('REQUESTS', 'MANAGE')
  adminAddComment(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: CreateIssueCommentDto) {
    return this.issuesService.adminAddComment(user, id, body);
  }

  @Delete('admin/issues/:id')
  @Roles(Role.ADMIN)
  @RequirePermission('REQUESTS', 'DELETE')
  adminDelete(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.issuesService.adminDelete(user, id);
  }

  @Get('superadmin/issues/overview')
  @Roles(Role.SUPERADMIN)
  superadminOverview(@CurrentUser() user: MvpUser) {
    return this.issuesService.superadminOverview(user);
  }
}
