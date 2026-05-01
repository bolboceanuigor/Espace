import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExportsService } from './exports.service';
import { RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { getOrgScope, getRequestedOrgId } from '../common/org-scope';

@Controller(['exports', 'api/exports'])
@UseGuards(RolesGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  private asCsv(res: Response, filename: string, content: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('properties')
  @Roles(Role.ADMIN)
  async exportProperties(@CurrentUser() user: any, @Req() req: Request, @Res() res: Response) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    const csv = await this.exportsService.exportProperties(organizationId, user.sub ?? user.id, user.role);
    this.asCsv(res, 'properties.csv', csv);
  }

  @Get('reservations')
  @Roles(Role.ADMIN, Role.MANAGER)
  async exportReservations(
    @CurrentUser() user: any,
    @Query('start') start: string,
    @Query('end') end: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    const csv = await this.exportsService.exportReservations(
      organizationId,
      user.sub ?? user.id,
      user.role,
      start,
      end,
    );
    this.asCsv(res, 'reservations.csv', csv);
  }

  @Get('cleanings')
  @Roles(Role.ADMIN)
  async exportCleanings(
    @CurrentUser() user: any,
    @Query('start') start: string,
    @Query('end') end: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    const csv = await this.exportsService.exportCleanings(
      organizationId,
      user.sub ?? user.id,
      user.role,
      start,
      end,
    );
    this.asCsv(res, 'cleanings.csv', csv);
  }

  @Get('clients')
  @Roles(Role.ADMIN)
  async exportClients(@CurrentUser() user: any, @Req() req: Request, @Res() res: Response) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    const csv = await this.exportsService.exportClients(
      organizationId,
      user.sub ?? user.id,
      user.role,
    );
    this.asCsv(res, 'clients.csv', csv);
  }

  @Get('admin/backup/export')
  @Roles(Role.ADMIN)
  async exportAdminBackup(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Query('includeAuditLogs') includeAuditLogs: string,
    @Res() res: Response,
  ) {
    const organizationId = getOrgScope(user, getRequestedOrgId(req));
    const payload = await this.exportsService.exportOrganizationBackup(
      organizationId,
      user.sub ?? user.id,
      user.role,
      includeAuditLogs !== 'false',
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="organization-backup-${organizationId}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  }

  @Get('superadmin/organizations/:id/backup/export')
  @Roles(Role.SUPERADMIN, Role.SUPER_ADMIN)
  async exportSuperadminBackup(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('includeAuditLogs') includeAuditLogs: string,
    @Res() res: Response,
  ) {
    const payload = await this.exportsService.exportOrganizationBackup(
      id,
      user.sub ?? user.id,
      user.role,
      includeAuditLogs !== 'false',
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="organization-backup-${id}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  }
}
