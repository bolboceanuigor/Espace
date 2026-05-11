import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { DataQualityService } from './data-quality.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class DataQualityController {
  constructor(private readonly dataQualityService: DataQualityService) {}

  @Get(['admin/data-quality', 'api/admin/data-quality'])
  overview(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.overview(user, query, activeOrganizationId);
  }

  @Post(['admin/data-quality/run', 'api/admin/data-quality/run'])
  run(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.run(user, body, activeOrganizationId);
  }

  @Get(['admin/data-quality/stats', 'api/admin/data-quality/stats'])
  stats(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.dataQualityService.stats(user, activeOrganizationId);
  }

  @Get(['admin/data-quality/runs', 'api/admin/data-quality/runs'])
  listRuns(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.listRuns(user, query, activeOrganizationId);
  }

  @Get(['admin/data-quality/runs/:id', 'api/admin/data-quality/runs/:id'])
  getRun(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.getRun(user, id, activeOrganizationId);
  }

  @Get(['admin/data-quality/issues', 'api/admin/data-quality/issues'])
  listIssues(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.listIssues(user, query, activeOrganizationId);
  }

  @Get(['admin/data-quality/issues/:id', 'api/admin/data-quality/issues/:id'])
  getIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.getIssue(user, id, activeOrganizationId);
  }

  @Patch(['admin/data-quality/issues/:id/resolve', 'api/admin/data-quality/issues/:id/resolve'])
  resolveIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.resolveIssue(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/issues/:id/ignore', 'api/admin/data-quality/issues/:id/ignore'])
  ignoreIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.ignoreIssue(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/issues/:id/reopen', 'api/admin/data-quality/issues/:id/reopen'])
  reopenIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.reopenIssue(user, id, activeOrganizationId);
  }
}
