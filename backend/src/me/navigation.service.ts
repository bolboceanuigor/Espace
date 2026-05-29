import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { resolvePermissions } from '../team/team-permissions';
import { OrganizationMemberStatus } from '@prisma/client';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

type NavItemConfig = {
  label: string;
  href: string;
  icon: string;
  allowedRoles: Array<'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT'>;
  requiredPermission?: string;
  requiredModule?: string;
  mobileVisible: boolean;
  moreMenu: boolean;
};

const NAV_CONFIG: NavItemConfig[] = [
  { label: 'Platformă', href: '/superadmin', icon: 'shield', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Asociații', href: '/superadmin/organizations', icon: 'building2', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Administratori', href: '/superadmin/admins', icon: 'users', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Venituri', href: '/superadmin/revenue', icon: 'chartColumnBig', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Taskuri facturare', href: '/superadmin/billing-tasks', icon: 'listChecks', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Notificări', href: '/superadmin/notifications', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Activitate', href: '/superadmin/activity', icon: 'listChecks', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Follow-up', href: '/superadmin/tasks', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Abonamente', href: '/superadmin/subscriptions', icon: 'creditCard', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Cereri acces', href: '/superadmin/access-requests', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Retenție', href: '/superadmin/retention', icon: 'listChecks', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Noutăți produs', href: '/superadmin/release-notes', icon: 'sparkles', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Feature flags', href: '/superadmin/feature-flags', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Beta program', href: '/superadmin/beta', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Status sistem', href: '/superadmin/system/status', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },

  { label: 'Acasă', href: '/admin', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamente', href: '/admin/apartments', icon: 'home', allowedRoles: ['ADMIN'], requiredPermission: 'apartments.view', requiredModule: 'apartmentsCrm', mobileVisible: true, moreMenu: false },
  { label: 'Locatari', href: '/admin/residents', icon: 'users', allowedRoles: ['ADMIN'], requiredPermission: 'residents.view', requiredModule: 'residentsCrm', mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/admin/meters', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredModule: 'meterReadings', mobileVisible: false, moreMenu: true },
  { label: 'Facturare', href: '/admin/billing', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'invoices.view', requiredModule: 'billingRun', mobileVisible: false, moreMenu: true },
  { label: 'Facturi', href: '/admin/invoices', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'invoices.view', requiredModule: 'internalInvoices', mobileVisible: true, moreMenu: false },
  { label: 'Calcul facturi', href: '/admin/invoices/draft', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'invoices.view', requiredModule: 'billingRun', mobileVisible: false, moreMenu: true },
  { label: 'Plăți', href: '/admin/payments', icon: 'creditCard', allowedRoles: ['ADMIN'], requiredPermission: 'payments.view', requiredModule: 'manualPayments', mobileVisible: false, moreMenu: true },
  { label: 'Reconciliere', href: '/admin/payments/reconciliation', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredPermission: 'payments.view', requiredModule: 'manualPayments', mobileVisible: false, moreMenu: true },
  { label: 'Solicitări', href: '/admin/requests', icon: 'circleAlert', allowedRoles: ['ADMIN'], requiredPermission: 'issues.view', requiredModule: 'requests', mobileVisible: false, moreMenu: true },
  { label: 'Solicitări date', href: '/admin/resident-update-requests', icon: 'users', allowedRoles: ['ADMIN'], requiredPermission: 'residents.manage', requiredModule: 'requests', mobileVisible: false, moreMenu: true },
  { label: 'Avizier', href: '/admin/announcements', icon: 'megaphone', allowedRoles: ['ADMIN'], requiredPermission: 'announcements.view', requiredModule: 'announcements', mobileVisible: false, moreMenu: true },
  { label: 'Notificări', href: '/admin/notifications', icon: 'circleAlert', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Noutăți', href: '/admin/whats-new', icon: 'sparkles', allowedRoles: ['ADMIN'], requiredModule: 'productUpdates', mobileVisible: false, moreMenu: true },
  { label: 'Istoric activitate', href: '/admin/audit-log', icon: 'listChecks', allowedRoles: ['ADMIN'], requiredModule: 'auditLog', mobileVisible: false, moreMenu: true },
  { label: 'Documente', href: '/admin/documents', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'documents', mobileVisible: false, moreMenu: true },
  { label: 'Rapoarte', href: '/admin/reports', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredModule: 'basicReports', mobileVisible: false, moreMenu: true },
  { label: 'Setări', href: '/admin/settings/organization', icon: 'settings', allowedRoles: ['ADMIN'], requiredPermission: 'settings.view', moreMenu: true, mobileVisible: false },

  { label: 'Acasă', href: '/resident', icon: 'home', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamentele mele', href: '/resident/apartments', icon: 'building2', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Facturi', href: '/resident/invoices', icon: 'fileText', allowedRoles: ['RESIDENT'], requiredModule: 'internalInvoices', mobileVisible: true, moreMenu: false },
  { label: 'Sold', href: '/resident/balance', icon: 'creditCard', allowedRoles: ['RESIDENT'], requiredModule: 'internalInvoices', mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/resident/meters', icon: 'chartColumnBig', allowedRoles: ['RESIDENT'], requiredModule: 'meterReadings', mobileVisible: true, moreMenu: false },
  { label: 'Solicitări', href: '/resident/requests', icon: 'circleAlert', allowedRoles: ['RESIDENT'], requiredModule: 'requests', mobileVisible: true, moreMenu: false },
  { label: 'Avizier', href: '/resident/announcements', icon: 'megaphone', allowedRoles: ['RESIDENT'], requiredModule: 'announcements', mobileVisible: false, moreMenu: true },
  { label: 'Notificări', href: '/resident/notifications', icon: 'circleAlert', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Noutăți', href: '/resident/updates', icon: 'sparkles', allowedRoles: ['RESIDENT'], requiredModule: 'productUpdates', mobileVisible: false, moreMenu: true },
  { label: 'Documente', href: '/resident/documents', icon: 'fileText', allowedRoles: ['RESIDENT'], requiredModule: 'documents', mobileVisible: false, moreMenu: true },
  { label: 'Cont', href: '/resident/profile', icon: 'users', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
];

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  async getNavigationForUser(user: AuthUser) {
    const roleValue = String(user.role || '').toUpperCase();
    const normalizedRole: 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT' =
      roleValue === 'SUPERADMIN' || roleValue === 'SUPER_ADMIN'
        ? 'SUPER_ADMIN'
        : roleValue === 'RESIDENT' || roleValue === 'RESIDENT'
          ? 'RESIDENT'
          : 'ADMIN';

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context missing');
    }

    const [member, limits, organizationSubscription, featureEvaluation] = await Promise.all([
      this.prisma.organizationMember.findFirst({
        where: { organizationId: user.organizationId, userId: this.userId(user), status: OrganizationMemberStatus.ACTIVE },
        select: { role: true, permissionsJson: true },
      }),
      this.prisma.organizationLimits.findUnique({
        where: { organizationId: user.organizationId },
        select: { modulesJson: true },
      }),
      this.prisma.organizationSubscription.findUnique({
        where: { organizationId: user.organizationId },
        select: { status: true },
      }),
      this.featureFlags.evaluateForUser(user).catch(() => null),
    ]);

    const moduleMap = { ...((limits?.modulesJson || {}) as Record<string, boolean>), ...((featureEvaluation?.modules || {}) as Record<string, boolean>) };
    const subscriptionStatus = String(organizationSubscription?.status || '').toUpperCase();
    const hardBlocked = normalizedRole === 'ADMIN' && ['SUSPENDED', 'CANCELLED'].includes(subscriptionStatus);

    const resolvedPermissions = member ? resolvePermissions(member.role, member.permissionsJson) : null;
    const canUsePermission = (permission?: string) => {
      if (!permission) return true;
      if (normalizedRole !== 'ADMIN') return true;
      if (!resolvedPermissions) return true;
      return resolvedPermissions[permission as keyof typeof resolvedPermissions] === true;
    };

    const allowedWhileHardBlocked = new Set(['/admin', '/admin/settings/organization', '/admin/subscription']);

    return NAV_CONFIG.filter((item) => item.allowedRoles.includes(normalizedRole))
      .filter((item) => canUsePermission(item.requiredPermission))
      .map((item) => {
        const moduleDisabled = !!item.requiredModule && moduleMap[item.requiredModule] === false;
        const subscriptionLocked = hardBlocked && !allowedWhileHardBlocked.has(item.href);
        return {
          ...item,
          locked: moduleDisabled || subscriptionLocked,
          lockReason: moduleDisabled
            ? 'MODULE_DISABLED'
            : subscriptionLocked
              ? 'SUBSCRIPTION_LIMIT'
              : null,
          role: normalizedRole,
          subscriptionStatus: normalizedRole === 'ADMIN' ? subscriptionStatus || null : null,
        };
      })
      .filter((item) => !item.requiredModule || moduleMap[item.requiredModule] !== false || item.locked);
  }
}
