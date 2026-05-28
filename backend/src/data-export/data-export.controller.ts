import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { DataExportService } from './data-export.service';
import { CancelDataExportDto, CreateDataExportDto, CreateDataRequestDto, UpdateDataRequestStatusDto } from './dto/data-export.dto';

@Controller('api/superadmin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperadminDataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get('data-requests')
  requests(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.listRequests('SUPERADMIN', user, query);
  }

  @Get('data-requests/stats')
  stats() {
    return this.service.requestStats();
  }

  @Get('data-requests/:id')
  request(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getRequest(id, 'SUPERADMIN', user);
  }

  @Patch('data-requests/:id/status')
  updateRequestStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateDataRequestStatusDto) {
    return this.service.updateRequestStatus(id, dto, user);
  }

  @Post('data-requests/:id/notes')
  note(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateRequestStatus(id, { status: body?.status || 'IN_REVIEW', decisionNote: String(body?.note || '') } as any, user);
  }

  @Post('data-requests/:id/create-export')
  createExportForRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.createExportForRequest(id, user);
  }

  @Get('data-exports')
  exports(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.listExports('SUPERADMIN', user, query);
  }

  @Post('data-exports')
  createExport(@CurrentUser() user: any, @Body() dto: CreateDataExportDto) {
    return this.service.createExport('SUPERADMIN', user, dto);
  }

  @Get('data-exports/:id')
  export(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getExport(id, 'SUPERADMIN', user);
  }

  @Get('data-exports/:id/download')
  async download(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const payload = await this.service.downloadExport(id, 'SUPERADMIN', user);
    this.sendDownload(res, payload);
  }

  @Patch('data-exports/:id/cancel')
  cancelExport(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CancelDataExportDto) {
    return this.service.cancelExport(id, dto, 'SUPERADMIN', user);
  }

  private sendDownload(res: Response, payload: { content: string; contentType: string; fileName: string }) {
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    res.send(payload.content);
  }
}

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get('data-requests')
  requests(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.listRequests('ADMIN', user, query);
  }

  @Post('data-requests')
  createRequest(@CurrentUser() user: any, @Body() dto: CreateDataRequestDto) {
    return this.service.createRequest('ADMIN', user, dto);
  }

  @Get('data-requests/:id')
  request(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getRequest(id, 'ADMIN', user);
  }

  @Patch('data-requests/:id/status')
  updateRequestStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateDataRequestStatusDto) {
    return this.service.updateRequestStatus(id, dto, user, true);
  }

  @Patch('data-requests/:id/cancel')
  cancelRequest(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.service.cancelRequest(id, user, String(body?.reason || 'Anulată de Admin.'));
  }

  @Get('data-exports')
  exports(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.listExports('ADMIN', user, query);
  }

  @Post('data-exports')
  createExport(@CurrentUser() user: any, @Body() dto: CreateDataExportDto) {
    return this.service.createExport('ADMIN', user, dto);
  }

  @Get('data-exports/:id')
  export(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getExport(id, 'ADMIN', user);
  }

  @Get('data-exports/:id/download')
  async download(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const payload = await this.service.downloadExport(id, 'ADMIN', user);
    this.sendDownload(res, payload);
  }

  @Patch('data-exports/:id/cancel')
  cancelExport(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CancelDataExportDto) {
    return this.service.cancelExport(id, dto, 'ADMIN', user);
  }

  private sendDownload(res: Response, payload: { content: string; contentType: string; fileName: string }) {
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    res.send(payload.content);
  }
}

@Controller('api/resident')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESIDENT)
export class ResidentDataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get('data-requests')
  requests(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.listRequests('RESIDENT', user, query);
  }

  @Post('data-requests')
  createRequest(@CurrentUser() user: any, @Body() dto: CreateDataRequestDto) {
    return this.service.createRequest('RESIDENT', user, dto);
  }

  @Get('data-requests/:id')
  request(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getRequest(id, 'RESIDENT', user);
  }

  @Patch('data-requests/:id/cancel')
  cancelRequest(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.service.cancelRequest(id, user, String(body?.reason || 'Anulată de locatar.'));
  }

  @Post('data-requests/:id/create-personal-export')
  createPersonalExport(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.createExport('RESIDENT', user, { exportType: 'RESIDENT_PERSONAL_EXPORT', format: 'JSON', dataRequestId: id } as any);
  }

  @Get('data-exports')
  exports(@CurrentUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.service.listExports('RESIDENT', user, query);
  }

  @Get('data-exports/:id')
  export(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getExport(id, 'RESIDENT', user);
  }

  @Get('data-exports/:id/download')
  async download(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const payload = await this.service.downloadExport(id, 'RESIDENT', user);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    res.send(payload.content);
  }
}
