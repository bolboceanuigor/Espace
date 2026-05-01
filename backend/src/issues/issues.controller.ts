import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowsPastDue, RequiresActiveSubscription } from '../subscription/subscription-access.decorator';
import { SubscriptionAccessGuard } from '../subscription/subscription-access.guard';
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
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get('resident/issues')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  @AllowsPastDue()
  residentList(@CurrentUser() user: any, @Query() query: ResidentIssueFiltersDto) {
    return this.issuesService.residentList(user, query);
  }

  @Post('resident/issues')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  @AllowsPastDue()
  residentCreate(@CurrentUser() user: any, @Body() body: CreateResidentIssueDto) {
    return this.issuesService.residentCreate(user, body);
  }

  @Get('resident/issues/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  @AllowsPastDue()
  residentGetOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.issuesService.residentGetOne(user, id);
  }

  @Post('resident/issues/:id/comments')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  @AllowsPastDue()
  residentAddComment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CreateIssueCommentDto) {
    return this.issuesService.residentAddComment(user, id, body);
  }

  @Post('resident/issues/:id/attachments')
  @UseGuards(RolesGuard)
  @Roles(Role.RESIDENT, Role.TENANT)
  @AllowsPastDue()
  residentAddAttachment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CreateIssueAttachmentDto) {
    return this.issuesService.residentAddAttachment(user, id, body);
  }

  @Get('admin/issues')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminList(@CurrentUser() user: any, @Query() query: AdminIssueFiltersDto) {
    return this.issuesService.adminList(user, query);
  }

  @Get('admin/issues/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminGetOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.issuesService.adminGetOne(user, id);
  }

  @Patch('admin/issues/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminUpdate(@CurrentUser() user: any, @Param('id') id: string, @Body() body: AdminUpdateIssueDto) {
    return this.issuesService.adminUpdate(user, id, body);
  }

  @Post('admin/issues/:id/comments')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @AllowsPastDue()
  adminAddComment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CreateIssueCommentDto) {
    return this.issuesService.adminAddComment(user, id, body);
  }

  @Delete('admin/issues/:id')
  @UseGuards(RolesGuard, SubscriptionAccessGuard)
  @Roles(Role.ADMIN)
  @RequiresActiveSubscription()
  adminDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.issuesService.adminDelete(user, id);
  }

  @Get('superadmin/issues/overview')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  superadminOverview(@CurrentUser() user: any) {
    return this.issuesService.superadminOverview(user);
  }
}
