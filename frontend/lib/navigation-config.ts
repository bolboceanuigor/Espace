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
  | 'chartColumnBig';

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
  { label: 'Abonamente', href: '/superadmin/subscriptions', icon: 'creditCard', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Follow-up', href: '/superadmin/tasks', icon: 'circleAlert', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Status sistem', href: '/superadmin/system/status', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: true },

  { label: 'Acasă', href: '/admin', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamente', href: '/admin/apartments', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Locatari', href: '/admin/residents', icon: 'users', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/admin/meters', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Facturi', href: '/admin/invoices', icon: 'fileText', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Calcul facturi', href: '/admin/invoices/draft', icon: 'fileText', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Plăți', href: '/admin/payments', icon: 'creditCard', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Reconciliere', href: '/admin/payments/reconciliation', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Cereri', href: '/admin/issues', icon: 'circleAlert', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Solicitări date', href: '/admin/resident-update-requests', icon: 'users', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Avizier', href: '/admin/announcements', icon: 'megaphone', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Documente', href: '/admin/documents', icon: 'fileText', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Rapoarte', href: '/admin/reports', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Setări', href: '/admin/settings/organization', icon: 'settings', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },

  { label: 'Acasă', href: '/resident', icon: 'home', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamentele mele', href: '/resident/apartments', icon: 'building2', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Facturi', href: '/resident/invoices', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/resident/meters', icon: 'chartColumnBig', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Cereri', href: '/resident/issues', icon: 'circleAlert', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Avizier', href: '/resident/announcements', icon: 'megaphone', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Documente', href: '/resident/documents', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Cont', href: '/resident/profile', icon: 'users', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
];
