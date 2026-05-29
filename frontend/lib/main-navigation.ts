import { normalizeRole } from './role-routing';

export type MainNavigationKey =
  | 'platform'
  | 'organizations'
  | 'administrators'
  | 'revenue'
  | 'billingTasks'
  | 'activity'
  | 'tasks'
  | 'subscriptions'
  | 'globalSettings'
  | 'adminHome'
  | 'apartments'
  | 'invoices'
  | 'invoiceDraft'
  | 'announcements'
  | 'residents'
  | 'meters'
  | 'meterReadings'
  | 'billing'
  | 'payments'
  | 'paymentReconciliation'
  | 'reports'
  | 'issues'
  | 'residentUpdateRequests'
  | 'notifications'
  | 'auditLog'
  | 'documents'
  | 'chat'
  | 'imports'
  | 'exports'
  | 'meterReports'
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
  { key: 'organizations', label: 'Asociații', href: '/superadmin/organizations' },
  { key: 'administrators', label: 'Administratori', href: '/superadmin/admins' },
  { key: 'revenue', label: 'Venituri', href: '/superadmin/revenue' },
  { key: 'billingTasks', label: 'Taskuri facturare', href: '/superadmin/billing-tasks' },
  { key: 'notifications', label: 'Notificări', href: '/superadmin/notifications' },
  { key: 'activity', label: 'Activitate', href: '/superadmin/activity' },
  { key: 'subscriptions', label: 'Abonamente', href: '/superadmin/subscriptions' },
  { key: 'tasks', label: 'Follow-up', href: '/superadmin/tasks' },
  { key: 'globalSettings', label: 'Status sistem', href: '/superadmin/system/status' },
];

export const ADMIN_NAVIGATION_ITEMS: MainNavigationItem[] = [
  { key: 'adminHome', label: 'Acasă', href: '/admin' },
  { key: 'apartments', label: 'Apartamente', href: '/admin/apartments' },
  { key: 'residents', label: 'Locatari', href: '/admin/residents' },
  { key: 'meters', label: 'Contoare', href: '/admin/meters' },
  { key: 'meterReadings', label: 'Citiri contoare', href: '/admin/meter-readings' },
  { key: 'meterReports', label: 'Rapoarte consum', href: '/admin/meter-readings/reports' },
  { key: 'billing', label: 'Facturare', href: '/admin/billing' },
  { key: 'invoices', label: 'Facturi', href: '/admin/invoices' },
  { key: 'invoiceDraft', label: 'Calcul facturi', href: '/admin/invoices/draft' },
  { key: 'payments', label: 'Plăți', href: '/admin/payments' },
  { key: 'paymentReconciliation', label: 'Reconciliere', href: '/admin/payments/reconciliation' },
  { key: 'issues', label: 'Solicitări', href: '/admin/requests' },
  { key: 'residentUpdateRequests', label: 'Solicitări date', href: '/admin/resident-update-requests' },
  { key: 'announcements', label: 'Avizier', href: '/admin/announcements' },
  { key: 'notifications', label: 'Notificări', href: '/admin/notifications' },
  { key: 'auditLog', label: 'Istoric activitate', href: '/admin/audit-log' },
  { key: 'documents', label: 'Documente', href: '/admin/documents' },
  { key: 'imports', label: 'Importuri', href: '/admin/imports' },
  { key: 'reports', label: 'Rapoarte', href: '/admin/reports' },
  { key: 'exports', label: 'Exporturi', href: '/admin/exports' },
  { key: 'buildingSettings', label: 'Setări', href: '/admin/settings/organization' },
];

export const RESIDENT_NAVIGATION_ITEMS: MainNavigationItem[] = [
  { key: 'home', label: 'Acasă', href: '/resident' },
  { key: 'apartments', label: 'Apartamentele mele', href: '/resident/apartments' },
  { key: 'payments', label: 'Facturi', href: '/resident/invoices' },
  { key: 'meters', label: 'Contoare', href: '/resident/meters' },
  { key: 'issues', label: 'Solicitări', href: '/resident/requests' },
  { key: 'announcements', label: 'Avizier', href: '/resident/announcements' },
  { key: 'notifications', label: 'Notificări', href: '/resident/notifications' },
  { key: 'documents', label: 'Documente', href: '/resident/documents' },
  { key: 'account', label: 'Cont', href: '/resident/profile' },
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
