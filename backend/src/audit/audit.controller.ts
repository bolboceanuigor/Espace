import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminAuditQueryDto, SuperadminAuditQueryDto } from './dto/audit-query.dto';
import { AuditService } from './audit.service';

@Controller('api')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('admin/audit-logs')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminList(@CurrentUser() user: any, @Query() query: AdminAuditQueryDto) {
    return this.auditService.listForAdmin(user.organizationId, query);
  }

  @Get('superadmin/audit-logs')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN, Role.SUPERADMIN)
  superadminList(@Query() query: SuperadminAuditQueryDto) {
    return this.auditService.listForSuperadmin(query);
  }
}
