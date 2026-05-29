export type NavigationRole = 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT';

export type NavigationIconKey =
  | 'shield'
  | 'home'
  | 'building2'
  | 'fileText'
  | 'creditCard'
  | 'users'
  | 'messageCircle'
  | 'circleAlert'
  | 'megaphone'
  | 'vote'
  | 'wrench'
  | 'settings'
  | 'sparkles'
  | 'chartColumnBig'
  | 'listChecks';

export type NavigationItem = {
  label: string;
  href: string;
  icon: NavigationIconKey;
  allowedRoles: NavigationRole[];
  requiredPermission?: string;
  requiredModule?: string;
  mobileVisible: boolean;
  moreMenu: boolean;
  locked?: boolean;
  lockReason?: string | null;
  role?: NavigationRole;
  subscriptionStatus?: string | null;
};

export const NAVIGATION_CONFIG: NavigationItem[] = [
  { label: 'Platformă', href: '/superadmin', icon: 'shield', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Asociații', href: '/superadmin/organizations', icon: 'building2', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Administratori', href: '/superadmin/admins', icon: 'users', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Venituri', href: '/superadmin/revenue', icon: 'chartColumnBig', allowedRoles: ['SUPER_ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Taskuri facturare', href: '/superadmin/billing-tasks', icon: 'listChecks', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Notificări', href: '/superadmin/notifications', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Activitate', href: '/superadmin/activity', icon: 'listChecks', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Abonamente', href: '/superadmin/subscriptions', icon: 'creditCard', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Follow-up', href: '/superadmin/tasks', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Cereri acces', href: '/superadmin/access-requests', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Retenție', href: '/superadmin/retention', icon: 'listChecks', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Noutăți produs', href: '/superadmin/release-notes', icon: 'sparkles', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Feature flags', href: '/superadmin/feature-flags', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Beta program', href: '/superadmin/beta', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Status sistem', href: '/superadmin/system/status', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },

  { label: 'Acasă', href: '/admin', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamente', href: '/admin/apartments', icon: 'home', allowedRoles: ['ADMIN'], requiredModule: 'apartmentsCrm', mobileVisible: true, moreMenu: false },
  { label: 'Locatari', href: '/admin/residents', icon: 'users', allowedRoles: ['ADMIN'], requiredModule: 'residentsCrm', mobileVisible: true, moreMenu: false },
  { label: 'Acces portal', href: '/admin/resident-access', icon: 'users', allowedRoles: ['ADMIN'], requiredModule: 'residentAccess', mobileVisible: false, moreMenu: true },
  { label: 'Contoare', href: '/admin/meters', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredModule: 'meterReadings', mobileVisible: false, moreMenu: true },
  { label: 'Citiri contoare', href: '/admin/meter-readings', icon: 'listChecks', allowedRoles: ['ADMIN'], requiredModule: 'meterReadings', mobileVisible: false, moreMenu: true },
  { label: 'Rapoarte consum', href: '/admin/meter-readings/reports', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredModule: 'consumptionReports', mobileVisible: false, moreMenu: true },
  { label: 'Facturare', href: '/admin/billing', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'billingRun', mobileVisible: false, moreMenu: true },
  { label: 'Drafturi facturi', href: '/admin/billing-drafts', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'billingRun', mobileVisible: false, moreMenu: true },
  { label: 'Calitatea datelor', href: '/admin/data-quality', icon: 'listChecks', allowedRoles: ['ADMIN'], requiredModule: 'dataQuality', mobileVisible: false, moreMenu: true },
  { label: 'Facturi', href: '/admin/invoices', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'internalInvoices', mobileVisible: true, moreMenu: false },
  { label: 'Calcul facturi', href: '/admin/invoices/draft', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'billingRun', mobileVisible: false, moreMenu: true },
  { label: 'Plăți', href: '/admin/payments', icon: 'creditCard', allowedRoles: ['ADMIN'], requiredModule: 'manualPayments', mobileVisible: false, moreMenu: true },
  { label: 'Reconciliere', href: '/admin/payments/reconciliation', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredModule: 'manualPayments', mobileVisible: false, moreMenu: true },
  { label: 'Solicitări', href: '/admin/requests', icon: 'circleAlert', allowedRoles: ['ADMIN'], requiredModule: 'requests', mobileVisible: false, moreMenu: true },
  { label: 'Solicitări date', href: '/admin/resident-update-requests', icon: 'users', allowedRoles: ['ADMIN'], requiredModule: 'requests', mobileVisible: false, moreMenu: true },
  { label: 'Avizier', href: '/admin/announcements', icon: 'megaphone', allowedRoles: ['ADMIN'], requiredModule: 'announcements', mobileVisible: false, moreMenu: true },
  { label: 'Notificări', href: '/admin/notifications', icon: 'circleAlert', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Noutăți', href: '/admin/whats-new', icon: 'sparkles', allowedRoles: ['ADMIN'], requiredModule: 'productUpdates', mobileVisible: false, moreMenu: true },
  { label: 'Istoric activitate', href: '/admin/audit-log', icon: 'listChecks', allowedRoles: ['ADMIN'], requiredModule: 'auditLog', mobileVisible: false, moreMenu: true },
  { label: 'Documente', href: '/admin/documents', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'documents', mobileVisible: false, moreMenu: true },
  { label: 'Importuri', href: '/admin/imports', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'csvImport', mobileVisible: false, moreMenu: true },
  { label: 'Rapoarte', href: '/admin/reports', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], requiredModule: 'basicReports', mobileVisible: false, moreMenu: true },
  { label: 'Exporturi', href: '/admin/exports', icon: 'fileText', allowedRoles: ['ADMIN'], requiredModule: 'csvExport', mobileVisible: false, moreMenu: true },
  { label: 'Setări', href: '/admin/settings/organization', icon: 'settings', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },

  { label: 'Acasă', href: '/resident', icon: 'home', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamentele mele', href: '/resident/apartments', icon: 'building2', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Facturi', href: '/resident/invoices', icon: 'fileText', allowedRoles: ['RESIDENT'], requiredModule: 'internalInvoices', mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/resident/meters', icon: 'chartColumnBig', allowedRoles: ['RESIDENT'], requiredModule: 'meterReadings', mobileVisible: true, moreMenu: false },
  { label: 'Solicitări', href: '/resident/requests', icon: 'circleAlert', allowedRoles: ['RESIDENT'], requiredModule: 'requests', mobileVisible: true, moreMenu: false },
  { label: 'Avizier', href: '/resident/announcements', icon: 'megaphone', allowedRoles: ['RESIDENT'], requiredModule: 'announcements', mobileVisible: false, moreMenu: true },
  { label: 'Notificări', href: '/resident/notifications', icon: 'circleAlert', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Noutăți', href: '/resident/updates', icon: 'sparkles', allowedRoles: ['RESIDENT'], requiredModule: 'productUpdates', mobileVisible: false, moreMenu: true },
  { label: 'Documente', href: '/resident/documents', icon: 'fileText', allowedRoles: ['RESIDENT'], requiredModule: 'documents', mobileVisible: false, moreMenu: true },
  { label: 'Cont', href: '/resident/profile', icon: 'users', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
];
