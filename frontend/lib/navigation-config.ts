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
  { label: 'Platformă', href: '/superadmin', icon: 'shield', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Asociații', href: '/superadmin/organizations', icon: 'building2', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Administratori', href: '/superadmin/admins', icon: 'users', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },
  { label: 'Abonamente', href: '/superadmin/subscriptions', icon: 'creditCard', allowedRoles: ['SUPER_ADMIN'], mobileVisible: false, moreMenu: false },

  { label: 'Acasă', href: '/admin', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Apartamente', href: '/admin/apartments', icon: 'home', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Locatari', href: '/admin/residents', icon: 'users', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/admin/meters', icon: 'chartColumnBig', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Facturi', href: '/admin/invoices', icon: 'fileText', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Plăți', href: '/admin/payments', icon: 'creditCard', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Cereri', href: '/admin/issues', icon: 'circleAlert', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Avizier', href: '/admin/announcements', icon: 'megaphone', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: false },
  { label: 'Documente', href: '/admin/documents', icon: 'fileText', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Import date', href: '/admin/imports', icon: 'fileText', allowedRoles: ['ADMIN'], mobileVisible: false, moreMenu: true },
  { label: 'Setări', href: '/admin/settings/organization', icon: 'settings', allowedRoles: ['ADMIN'], mobileVisible: true, moreMenu: true },

  { label: 'Acasă', href: '/resident', icon: 'home', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Avizier', href: '/resident/announcements', icon: 'megaphone', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Facturi', href: '/resident/invoices', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Contoare', href: '/resident/meters', icon: 'chartColumnBig', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Cereri', href: '/resident/issues', icon: 'circleAlert', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
  { label: 'Documente', href: '/resident/documents', icon: 'fileText', allowedRoles: ['RESIDENT'], mobileVisible: false, moreMenu: true },
  { label: 'Cont', href: '/resident/account', icon: 'users', allowedRoles: ['RESIDENT'], mobileVisible: true, moreMenu: false },
];
