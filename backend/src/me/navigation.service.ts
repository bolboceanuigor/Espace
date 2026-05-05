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
  { label: 'Dashboard', href: '/superadmin', icon: 'shield', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Organizations', href: '/superadmin/organizations', icon: 'building2', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Subscriptions', href: '/superadmin/subscriptions', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Trials', href: '/superadmin/trials', icon: 'chartColumnBig', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Billing', href: '/superadmin/billing', icon: 'creditCard', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Leads', href: '/superadmin/leads', icon: 'users', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Demo Requests', href: '/superadmin/demo-requests', icon: 'calendar', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Follow-ups', href: '/superadmin/follow-ups', icon: 'calendar', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Tasks', href: '/superadmin/tasks', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Demo', href: '/superadmin/demo', icon: 'sparkles', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Launch Checklist', href: '/superadmin/launch-checklist', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'QA Checklist', href: '/superadmin/qa-checklist', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Beta Readiness', href: '/superadmin/beta-readiness', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Feedback', href: '/superadmin/feedback', icon: 'messageCircle', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Jobs', href: '/superadmin/jobs', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Roadmap', href: '/superadmin/roadmap', icon: 'chartColumnBig', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Email Templates', href: '/superadmin/email-templates', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Release Notes', href: '/superadmin/release-notes', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Support Mode', href: '/superadmin/support-mode', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Help Articles', href: '/superadmin/help', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Demo Reset', href: '/superadmin/demo', icon: 'sparkles', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Storage', href: '/superadmin/storage', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Audit Logs', href: '/superadmin/audit-logs', icon: 'fileText', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'System Status', href: '/superadmin/system/status', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'System Errors', href: '/superadmin/system/errors', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Settings', href: '/superadmin/settings', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },

  { label: 'Chat', href: '/admin/chat', icon: 'messageCircle', allowedRoles: ['ADMIN'], requiredPermission: 'chat.view', mobileVisible: true, moreMenu: false },
  { label: 'Payments', href: '/admin/payments', icon: 'creditCard', allowedRoles: ['ADMIN'], requiredPermission: 'payments.view', requiredModule: 'payments', mobileVisible: true, moreMenu: false },
  { label: 'Dashboard', href: '/admin', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Issues', href: '/admin/issues', icon: 'circleAlert', allowedRoles: ['ADMIN'], requiredPermission: 'issues.view', requiredModule: 'issues', mobileVisible: true, moreMenu: false },
  { label: 'Buildings', href: '/admin/buildings', icon: 'building2', allowedRoles: ['ADMIN'], requiredPermission: 'buildings.view', moreMenu: true, mobileVisible: false },
  { label: 'Staircases', href: '/admin/staircases', icon: 'building2', allowedRoles: ['ADMIN'], requiredPermission: 'buildings.view', moreMenu: true, mobileVisible: false },
  { label: 'Apartments', href: '/admin/apartments', icon: 'home', allowedRoles: ['ADMIN'], requiredPermission: 'apartments.view', moreMenu: true, mobileVisible: false },
  { label: 'Residents', href: '/admin/residents', icon: 'users', allowedRoles: ['ADMIN'], requiredPermission: 'residents.view', moreMenu: true, mobileVisible: false },
  { label: 'Tariffs', href: '/admin/tariffs', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'invoices.view', requiredModule: 'reports', moreMenu: true, mobileVisible: false },
  { label: 'Charges', href: '/admin/charges', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'invoices.view', requiredModule: 'reports', moreMenu: true, mobileVisible: false },
  { label: 'Invoices', href: '/admin/invoices', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'invoices.view', requiredModule: 'invoices', moreMenu: true, mobileVisible: false },
  { label: 'Balances', href: '/admin/balances', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'reports.view', requiredModule: 'reports', moreMenu: true, mobileVisible: false },
  { label: 'Reports', href: '/admin/reports', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredPermission: 'reports.view', requiredModule: 'reports', moreMenu: true, mobileVisible: false },
  { label: 'Announcements', href: '/admin/announcements', icon: 'megaphone', allowedRoles: ['ADMIN'], requiredPermission: 'announcements.view', moreMenu: true, mobileVisible: false },
  { label: 'Documents', href: '/admin/documents', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'announcements.view', requiredModule: 'documents', moreMenu: true, mobileVisible: false },
  { label: 'Voting', href: '/admin/votes', icon: 'vote', allowedRoles: ['ADMIN'], requiredPermission: 'announcements.view', requiredModule: 'voting', moreMenu: true, mobileVisible: false },
  { label: 'Maintenance', href: '/admin/maintenance/calendar', icon: 'wrench', allowedRoles: ['ADMIN'], requiredPermission: 'maintenance.view', moreMenu: true, mobileVisible: false },
  { label: 'Suppliers', href: '/admin/suppliers', icon: 'users', allowedRoles: ['ADMIN'], requiredPermission: 'suppliers.view', moreMenu: true, mobileVisible: false },
  { label: 'Expenses', href: '/admin/expenses', icon: 'creditCard', allowedRoles: ['ADMIN'], requiredPermission: 'expenses.view', moreMenu: true, mobileVisible: false },
  { label: 'Imports', href: '/admin/imports', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'imports', moreMenu: true, mobileVisible: false },
  { label: 'Reconciliation', href: '/admin/reconciliation', icon: 'sparkles', allowedRoles: ['ADMIN'], requiredModule: 'reconciliation', moreMenu: true, mobileVisible: false },
  { label: 'Reminders', href: '/admin/reminders', icon: 'calendar', allowedRoles: ['ADMIN'], requiredPermission: 'reports.view', moreMenu: true, mobileVisible: false },
  { label: 'Team', href: '/admin/team', icon: 'users', allowedRoles: ['ADMIN'], requiredPermission: 'settings.view', moreMenu: true, mobileVisible: false },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: 'fileText', allowedRoles: ['ADMIN'], requiredPermission: 'settings.view', moreMenu: true, mobileVisible: false },
  { label: 'Subscription', href: '/admin/subscription', icon: 'creditCard', allowedRoles: ['ADMIN'], moreMenu: true, mobileVisible: false },
  { label: 'Onboarding', href: '/admin/onboarding', icon: 'sparkles', allowedRoles: ['ADMIN'], moreMenu: true, mobileVisible: false },
  { label: 'Release Notes', href: '/release-notes', icon: 'fileText', allowedRoles: ['ADMIN'], moreMenu: true, mobileVisible: false },
  { label: 'Settings', href: '/admin/settings/organization', icon: 'settings', allowedRoles: ['ADMIN'], requiredPermission: 'settings.view', moreMenu: true, mobileVisible: false },

  { label: 'Dashboard', href: '/resident', icon: 'home', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Chat', href: '/resident/chat', icon: 'messageCircle', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Payments', href: '/resident/payments', icon: 'creditCard', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Invoices', href: '/resident/invoices', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Issues', href: '/resident/issues', icon: 'circleAlert', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Announcements', href: '/resident/announcements', icon: 'megaphone', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Documents', href: '/resident/documents', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Voting', href: '/resident/votes', icon: 'vote', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Maintenance', href: '/resident/maintenance', icon: 'wrench', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Reports', href: '/resident/reports', icon: 'chartColumnBig', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Release Notes', href: '/release-notes', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Profile', href: '/resident/profile', icon: 'users', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Settings', href: '/resident/settings', icon: 'settings', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
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
