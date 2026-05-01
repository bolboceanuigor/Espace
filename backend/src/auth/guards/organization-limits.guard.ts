import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationLimitsGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  private readonly moduleByPrefix: Array<{ prefix: string; moduleKey: string }> = [
    { prefix: '/api/admin/payments', moduleKey: 'payments' },
    { prefix: '/api/admin/invoices', moduleKey: 'invoices' },
    { prefix: '/api/admin/reports', moduleKey: 'reports' },
    { prefix: '/api/admin/issues', moduleKey: 'issues' },
    { prefix: '/api/admin/votes', moduleKey: 'voting' },
    { prefix: '/api/admin/documents', moduleKey: 'documents' },
    { prefix: '/api/admin/files', moduleKey: 'documents' },
    { prefix: '/api/admin/imports', moduleKey: 'imports' },
    { prefix: '/api/admin/reconciliation', moduleKey: 'reconciliation' },
    { prefix: '/api/admin/integrations', moduleKey: 'integrations' },
  ];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      path?: string;
      url?: string;
      user?: { role?: string; organizationId?: string | null };
    }>();
    const path = request.path || request.url || '';
    const role = String(request.user?.role || '').toUpperCase();
    if (role === 'SUPERADMIN' || role === 'SUPER_ADMIN') return true;
    if (role !== 'ADMIN' || !request.user?.organizationId) return true;

    const matched = this.moduleByPrefix.find((entry) => path.startsWith(entry.prefix));
    if (!matched) return true;

    const limits = await this.prisma.organizationLimits.findUnique({
      where: { organizationId: request.user.organizationId },
      select: { modulesJson: true },
    });
    if (!limits?.modulesJson) return true;

    const modules = limits.modulesJson as Record<string, boolean>;
    if (modules[matched.moduleKey] === false) {
      throw new ForbiddenException('Acest modul nu este activ în abonamentul dvs.');
    }
    return true;
  }
}

