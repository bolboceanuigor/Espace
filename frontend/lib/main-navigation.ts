import { normalizeRole } from './role-routing';

export type MainNavigationKey =
  | 'platform'
  | 'organizations'
  | 'administrators'
  | 'subscriptions'
  | 'support'
  | 'globalSettings'
  | 'adminHome'
  | 'apartments'
  | 'announcements'
  | 'residents'
  | 'payments'
  | 'issues'
  | 'chat'
  | 'buildingSettings'
  | 'home'
  | 'account';

export type MainNavigationRole =
  | 'ADMIN'
  | 'RESIDENT'
  | 'TENANT'
  | 'LOCATAR'
  | 'MANAGER'
  | 'SUPER_ADMIN'
  | 'SUPERADMIN'
  | string
  | undefined;

export type MainNavigationItem = {
  key: MainNavigationKey;
  label: string;
  href: string;
  center?: boolean;
};

export const SUPERADMIN_NAVIGATION_ITEMS: MainNavigationItem[] = [
  { key: 'platform', label: 'Platformă', href: '/superadmin' },
  { key: 'organizations', label: 'Organizații', href: '/superadmin/organizations' },
  { key: 'administrators', label: 'Administratori', href: '/superadmin/admins' },
  { key: 'subscriptions', label: 'Abonamente', href: '/superadmin/subscriptions' },
  { key: 'support', label: 'Suport', href: '/superadmin/support-mode' },
  { key: 'globalSettings', label: 'Setări globale', href: '/superadmin/settings' },
];

export const ADMIN_NAVIGATION_ITEMS: MainNavigationItem[] = [
  { key: 'adminHome', label: 'Acasă', href: '/admin' },
  { key: 'apartments', label: 'Apartamente', href: '/admin/apartments' },
  { key: 'announcements', label: 'Avizier', href: '/admin/announcements' },
  { key: 'residents', label: 'Locatari', href: '/admin/residents' },
  { key: 'payments', label: 'Plăți', href: '/admin/payments' },
  { key: 'issues', label: 'Cereri', href: '/admin/issues' },
  { key: 'chat', label: 'Mesaje', href: '/admin/chat' },
  { key: 'buildingSettings', label: 'Setări bloc', href: '/admin/settings/organization' },
];

export const RESIDENT_NAVIGATION_ITEMS: MainNavigationItem[] = [
  { key: 'announcements', label: 'Avizier', href: '/resident/announcements' },
  { key: 'payments', label: 'Plăți', href: '/resident/payments' },
  { key: 'home', label: 'Acasă', href: '/resident', center: true },
  { key: 'chat', label: 'Mesaje', href: '/resident/chat' },
  { key: 'account', label: 'Cont', href: '/resident/account' },
];

export const MAIN_NAVIGATION_ITEMS = RESIDENT_NAVIGATION_ITEMS;

export function getMainNavigationItems(role: MainNavigationRole): MainNavigationItem[] {
  const normalized = normalizeRole(role);
  if (normalized === 'SUPER_ADMIN') return SUPERADMIN_NAVIGATION_ITEMS;
  if (normalized === 'RESIDENT') return RESIDENT_NAVIGATION_ITEMS;
  return ADMIN_NAVIGATION_ITEMS;
}

export function getMainNavigationRoutes(role: MainNavigationRole): Partial<Record<MainNavigationKey, string>> {
  return getMainNavigationItems(role).reduce(
    (acc, item) => ({ ...acc, [item.key]: item.href }),
    {} as Partial<Record<MainNavigationKey, string>>,
  );
}
