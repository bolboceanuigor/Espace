import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminAuditQueryDto, SuperadminAuditQueryDto } from './dto/audit-query.dto';
import { AuditService } from './audit.service';

@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(['api/admin/audit-logs', 'admin/audit-logs'])
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminList(@CurrentUser() user: any, @Query() query: AdminAuditQueryDto) {
    return this.auditService.listForAdmin(user.organizationId, query);
  }

  @Get(['api/superadmin/audit-logs', 'superadmin/audit-logs'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPERADMIN)
  superadminList(@Query() query: SuperadminAuditQueryDto) {
    return this.auditService.listForSuperadmin(query);
  }

  @Get(['api/superadmin/activity/:id', 'superadmin/activity/:id'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminActivityDetail(@Param('id') id: string) {
    return this.auditService.getSuperadminActivityDetail(id);
  }

  @Get(['api/superadmin/users/:id/activity', 'superadmin/users/:id/activity'])
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminUserActivity(@Param('id') id: string, @Query() query: Record<string, string | undefined>) {
    return this.auditService.listUserActivity(id, query);
  }
}
