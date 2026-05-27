import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { SaasLimitEnforcementService } from '../saas-usage/saas-limit-enforcement.service';
import { UploadImportDto } from './dto/imports.dto';
import { ImportsService } from './imports.service';

const CSV_FILE_LIMIT_BYTES = 5 * 1024 * 1024;

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
@RequirePermission('IMPORTS', 'VIEW')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly saasLimits: SaasLimitEnforcementService,
  ) {}

  private sendCsv(res: Response, payload: { csv: string; fileName: string }) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    res.send(payload.csv);
  }

  @Get(['admin/imports/templates/apartments.csv', 'api/admin/imports/templates/apartments.csv'])
  templateApartmentsCsv(@Res() res: Response) {
    this.sendCsv(res, this.importsService.templateApartmentsCsv());
  }

  @Get(['admin/imports/templates/residents.csv', 'api/admin/imports/templates/residents.csv'])
  templateResidentsCsv(@Res() res: Response) {
    this.sendCsv(res, this.importsService.templateResidentsCsv());
  }

  @Get(['admin/imports/templates/meters.csv', 'api/admin/imports/templates/meters.csv'])
  templateMetersCsv(@Res() res: Response) {
    this.sendCsv(res, this.importsService.templateMetersCsv());
  }

  @Get(['admin/imports/templates/meter-readings.csv', 'api/admin/imports/templates/meter-readings.csv'])
  templateMeterReadingsCsv(@Res() res: Response) {
    this.sendCsv(res, this.importsService.templateMeterReadingsCsv());
  }

  @Get(['admin/imports', 'api/admin/imports'])
  listImports(
    @CurrentUser() user: MvpUser,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.importsService.listAdmin(user, query, activeOrganizationId);
  }

  @Get(['admin/imports/:id/rows', 'api/admin/imports/:id/rows'])
  getImportRows(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.importsService.getImportRows(user, id, query, activeOrganizationId);
  }

  @Get(['admin/imports/:id/preview', 'api/admin/imports/:id/preview'])
  getImportPreview(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.importsService.previewAdmin(user, id, activeOrganizationId);
  }

  @Get(['admin/imports/:id', 'api/admin/imports/:id'])
  getImportJob(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    return this.importsService.getImportJob(user, id, activeOrganizationId);
  }

  @Patch(['admin/imports/:id/cancel', 'api/admin/imports/:id/cancel'])
  @RequirePermission('IMPORTS', 'MANAGE')
  async cancelImport(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertSubscriptionAllowsWrite(activeOrganizationId || user.organizationId, user);
    return this.importsService.cancelImport(user, id, activeOrganizationId);
  }

  @Post(['admin/imports/apartments/preview', 'api/admin/imports/apartments/preview'])
  @RequirePermission('IMPORTS', 'IMPORT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_FILE_LIMIT_BYTES } }))
  async previewApartments(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'apartments', user);
    return this.importsService.previewApartmentsCsv(user, body, file, activeOrganizationId);
  }

  @Post(['admin/imports/apartments/:id/confirm', 'api/admin/imports/apartments/:id/confirm'])
  @RequirePermission('IMPORTS', 'IMPORT')
  async confirmApartments(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'apartments', user);
    return this.importsService.confirmApartmentsCsv(user, id, body, activeOrganizationId);
  }

  @Post(['admin/imports/residents/preview', 'api/admin/imports/residents/preview'])
  @RequirePermission('IMPORTS', 'IMPORT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_FILE_LIMIT_BYTES } }))
  async previewResidents(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'residents', user);
    return this.importsService.previewResidentsCsv(user, body, file, activeOrganizationId);
  }

  @Post(['admin/imports/residents/:id/confirm', 'api/admin/imports/residents/:id/confirm'])
  @RequirePermission('IMPORTS', 'IMPORT')
  async confirmResidents(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'residents', user);
    return this.importsService.confirmResidentsCsv(user, id, body, activeOrganizationId);
  }

  @Post(['admin/imports/meters/preview', 'api/admin/imports/meters/preview'])
  @RequirePermission('IMPORTS', 'IMPORT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_FILE_LIMIT_BYTES } }))
  async previewMeters(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'meters', user);
    return this.importsService.previewMetersCsv(user, body, file, activeOrganizationId);
  }

  @Post(['admin/imports/meters/:id/confirm', 'api/admin/imports/meters/:id/confirm'])
  @RequirePermission('IMPORTS', 'IMPORT')
  async confirmMeters(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'meters', user);
    return this.importsService.confirmMetersCsv(user, id, body, activeOrganizationId);
  }

  @Post(['admin/imports/meter-readings/preview', 'api/admin/imports/meter-readings/preview'])
  @RequirePermission('IMPORTS', 'IMPORT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_FILE_LIMIT_BYTES } }))
  async previewMeterReadings(
    @CurrentUser() user: MvpUser,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'meter-readings', user);
    return this.importsService.previewMeterReadingsCsv(user, body, file, activeOrganizationId);
  }

  @Post(['admin/imports/meter-readings/:id/confirm', 'api/admin/imports/meter-readings/:id/confirm'])
  @RequirePermission('IMPORTS', 'IMPORT')
  async confirmMeterReadings(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'meter-readings', user);
    return this.importsService.confirmMeterReadingsCsv(user, id, body, activeOrganizationId);
  }

  @Post(['admin/imports/:id/confirm', 'api/admin/imports/:id/confirm'])
  @RequirePermission('IMPORTS', 'IMPORT')
  async confirmImport(
    @CurrentUser() user: MvpUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, 'generic', user);
    return this.importsService.confirmAdmin(user, id, body, activeOrganizationId);
  }

  @Post(['admin/imports/upload', 'api/admin/imports/upload'])
  @RequirePermission('IMPORTS', 'IMPORT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_FILE_LIMIT_BYTES } }))
  async legacyUpload(
    @CurrentUser() user: MvpUser,
    @Body() body: UploadImportDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-org-id') activeOrganizationId?: string,
  ) {
    await this.saasLimits.assertCanImportCsv(activeOrganizationId || user.organizationId, String(body.type || 'generic'), user);
    return this.importsService.uploadAdmin(user, body.type, file?.originalname || 'import.csv', file?.buffer || Buffer.alloc(0), activeOrganizationId);
  }

  @Get(['admin/imports/templates/:type', 'api/admin/imports/templates/:type'])
  legacyTemplate(@Param('type') type: any, @Res() res: Response) {
    const buffer = this.importsService.templateXlsx(type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${String(type).toLowerCase()}-template.xlsx"`);
    res.send(buffer);
  }
}
