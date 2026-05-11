import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { DataQualityService } from './data-quality.service';
import { DuplicateDetectionService } from './duplicates.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@RequirePermission('DATA_QUALITY', 'VIEW')
export class DataQualityController {
  constructor(
    private readonly dataQualityService: DataQualityService,
    private readonly duplicateDetectionService: DuplicateDetectionService,
  ) {}

  @Get(['admin/data-quality', 'api/admin/data-quality'])
  overview(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.overview(user, query, activeOrganizationId);
  }

  @Post(['admin/data-quality/run', 'api/admin/data-quality/run'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
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

  @Get(['admin/data-quality/duplicates', 'api/admin/data-quality/duplicates'])
  duplicateOverview(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.overview(user, query, activeOrganizationId);
  }

  @Get(['admin/data-quality/duplicates/groups', 'api/admin/data-quality/duplicates/groups'])
  duplicateGroups(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.listGroups(user, query, activeOrganizationId);
  }

  @Post(['admin/data-quality/duplicates/scan', 'api/admin/data-quality/duplicates/scan'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  scanDuplicates(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.scan(user, body, activeOrganizationId);
  }

  @Get(['admin/data-quality/duplicates/stats', 'api/admin/data-quality/duplicates/stats'])
  duplicateStats(@CurrentUser() user: MvpUser, @Headers('x-org-id') activeOrganizationId?: string) {
    return this.duplicateDetectionService.stats(user, activeOrganizationId);
  }

  @Get(['admin/data-quality/duplicates/groups/:id', 'api/admin/data-quality/duplicates/groups/:id'])
  duplicateGroup(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.getGroup(user, id, activeOrganizationId);
  }

  @Post(['admin/data-quality/duplicates/groups/:id/merge/preview', 'api/admin/data-quality/duplicates/groups/:id/merge/preview'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  previewDuplicateMerge(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.mergePreview(user, id, body, activeOrganizationId);
  }

  @Post(['admin/data-quality/duplicates/groups/:id/merge/apply', 'api/admin/data-quality/duplicates/groups/:id/merge/apply'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  applyDuplicateMerge(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.mergeApply(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/duplicates/groups/:id/not-duplicate', 'api/admin/data-quality/duplicates/groups/:id/not-duplicate'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  markDuplicateGroupNotDuplicate(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.markNotDuplicate(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/duplicates/groups/:id/reviewed', 'api/admin/data-quality/duplicates/groups/:id/reviewed'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  markDuplicateGroupReviewed(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.markReviewed(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/duplicates/groups/:id/ignore', 'api/admin/data-quality/duplicates/groups/:id/ignore'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  ignoreDuplicateGroup(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.ignoreGroup(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/duplicates/groups/:id/reopen', 'api/admin/data-quality/duplicates/groups/:id/reopen'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  reopenDuplicateGroup(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.duplicateDetectionService.reopenGroup(user, id, activeOrganizationId);
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

  @Get(['admin/data-quality/fixes', 'api/admin/data-quality/fixes'])
  listFixes(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.listFixes(user, query, activeOrganizationId);
  }

  @Get(['admin/data-quality/issues/:id', 'api/admin/data-quality/issues/:id'])
  getIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.getIssue(user, id, activeOrganizationId);
  }

  @Get(['admin/data-quality/issues/:id/fix-options', 'api/admin/data-quality/issues/:id/fix-options'])
  fixOptions(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.fixOptions(user, id, activeOrganizationId);
  }

  @Post(['admin/data-quality/issues/:id/fix/preview', 'api/admin/data-quality/issues/:id/fix/preview'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  previewFix(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.previewFix(user, id, body, activeOrganizationId);
  }

  @Post(['admin/data-quality/issues/:id/fix/apply', 'api/admin/data-quality/issues/:id/fix/apply'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  applyFix(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.applyFix(user, id, body, activeOrganizationId);
  }

  @Post(['admin/data-quality/fixes/bulk/preview', 'api/admin/data-quality/fixes/bulk/preview'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  previewBulkFix(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.previewBulkFix(user, body, activeOrganizationId);
  }

  @Post(['admin/data-quality/fixes/bulk/apply', 'api/admin/data-quality/fixes/bulk/apply'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  applyBulkFix(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.applyBulkFix(user, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/issues/:id/resolve', 'api/admin/data-quality/issues/:id/resolve'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  resolveIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.resolveIssue(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/issues/:id/ignore', 'api/admin/data-quality/issues/:id/ignore'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  ignoreIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.ignoreIssue(user, id, body, activeOrganizationId);
  }

  @Patch(['admin/data-quality/issues/:id/reopen', 'api/admin/data-quality/issues/:id/reopen'])
  @RequirePermission('DATA_QUALITY', 'MANAGE')
  reopenIssue(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.dataQualityService.reopenIssue(user, id, activeOrganizationId);
  }
}
