import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  { label: 'Platformă', href: '/superadmin', icon: 'shield', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Asociații', href: '/superadmin/organizations', icon: 'building2', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Administratori', href: '/superadmin/admins', icon: 'users', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Abonamente', href: '/superadmin/subscriptions', icon: 'creditCard', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },

  { label: 'Acasă', href: '/admin', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamente', href: '/admin/apartments', icon: 'home', allowedRoles: ['ADMIN'], requiredPermission: 'apartments.view', mobileVisible: true, moreMenu: false },
  { label: 'Locatari', href: '/admin/residents', icon: 'users', allowedRoles: ['ADMIN'], requiredPermission: 'residents.view', mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/admin/meters', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Facturi', href: '/admin/invoices', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'invoices.view', mobileVisible: true, moreMenu: false },
  { label: 'Plăți', href: '/admin/payments', icon: 'creditCard', allowedRoles: ['ADMIN'], requiredPermission: 'payments.view', mobileVisible: true, moreMenu: false },
  { label: 'Cereri', href: '/admin/issues', icon: 'circleAlert', allowedRoles: ['ADMIN'], requiredPermission: 'issues.view', mobileVisible: true, moreMenu: false },
  { label: 'Avizier', href: '/admin/announcements', icon: 'megaphone', allowedRoles: ['ADMIN'], requiredPermission: 'announcements.view', mobileVisible: true, moreMenu: false },
  { label: 'Setări', href: '/admin/settings/organization', icon: 'settings', allowedRoles: ['ADMIN'], requiredPermission: 'settings.view', moreMenu: true, mobileVisible: false },

  { label: 'Acasă', href: '/resident', icon: 'home', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Avizier', href: '/resident/announcements', icon: 'megaphone', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Facturi', href: '/resident/invoices', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/resident/meters', icon: 'chartColumnBig', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Cereri', href: '/resident/issues', icon: 'circleAlert', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Documente', href: '/resident/documents', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Cont', href: '/resident/account', icon: 'users', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
];

@Injectable()
export class NavigationService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [member, limits, organizationSubscription] = await Promise.all([
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
    ]);

    const moduleMap = (limits?.modulesJson || {}) as Record<string, boolean>;
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
