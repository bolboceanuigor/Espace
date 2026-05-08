import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { DocumentsMvpService } from './documents-mvp.service';

@Controller()
@UseGuards(MvpAuthGuard, MvpRolesGuard)
export class DocumentsMvpController {
  constructor(private readonly documentsService: DocumentsMvpService) {}

  @Get(['documents', 'api/documents', 'api/admin/documents'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listAdminDocuments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.documentsService.listAdminDocuments(user, query);
  }

  @Post(['documents', 'api/documents', 'api/admin/documents'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  createAdminDocument(@CurrentUser() user: MvpUser, @Body() body: unknown) {
    return this.documentsService.createAdminDocument(user, body);
  }

  @Get(['documents/:id', 'api/documents/:id', 'api/admin/documents/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  getAdminDocument(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.documentsService.getAdminDocument(user, id);
  }

  @Patch(['documents/:id', 'api/documents/:id', 'api/admin/documents/:id'])
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  updateAdminDocument(@CurrentUser() user: MvpUser, @Param('id') id: string, @Body() body: unknown) {
    return this.documentsService.updateAdminDocument(user, id, body);
  }

  @Get(['resident/documents', 'api/resident/documents'])
  @Roles(Role.RESIDENT)
  listResidentDocuments(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.documentsService.listResidentDocuments(user, query);
  }

  @Get(['resident/documents/:id', 'api/resident/documents/:id'])
  @Roles(Role.RESIDENT)
  getResidentDocument(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.documentsService.getResidentDocument(user, id);
  }
}
