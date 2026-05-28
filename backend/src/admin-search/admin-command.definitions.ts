import type { PermissionActionKey, PermissionModuleKey } from '../team/team-permissions';

export type AdminCommandKey =
  | 'GO_DASHBOARD'
  | 'GO_APARTMENTS'
  | 'GO_RESIDENTS'
  | 'GO_INVOICES'
  | 'GO_PAYMENTS'
  | 'GO_BILLING'
  | 'GO_REPORTS'
  | 'GO_DATA_QUALITY'
  | 'GO_IMPORTS'
  | 'GO_EXPORTS'
  | 'GO_TEAM'
  | 'GO_BULK_OPERATIONS'
  | 'CREATE_APARTMENT'
  | 'CREATE_RESIDENT'
  | 'CREATE_ANNOUNCEMENT'
  | 'CREATE_REQUEST'
  | 'RECORD_PAYMENT'
  | 'START_BILLING_RUN'
  | 'RUN_DATA_QUALITY'
  | 'IMPORT_APARTMENTS'
  | 'IMPORT_RESIDENTS'
  | 'IMPORT_METERS'
  | 'EXPORT_INVOICES'
  | 'OPEN_SUBSCRIPTION'
  | 'OPEN_HELP_CENTER';

export type AdminCommandDefinition = {
  key: AdminCommandKey;
  title: string;
  subtitle: string;
  category: 'Navigare' | 'Actiuni rapide' | 'Import/Export' | 'Suport';
  icon: string;
  url: string;
  requiredPermission?: { module: PermissionModuleKey; action: PermissionActionKey };
  extraPermission?: { module: PermissionModuleKey; action: PermissionActionKey };
  danger?: boolean;
};

export const ADMIN_COMMANDS: AdminCommandDefinition[] = [
  { key: 'GO_DASHBOARD', title: 'Deschide dashboard', subtitle: 'Revino la overview-ul asociatiei', category: 'Navigare', icon: 'layout-dashboard', url: '/admin' },
  { key: 'GO_APARTMENTS', title: 'Apartamente', subtitle: 'Lista apartamentelor', category: 'Navigare', icon: 'home', url: '/admin/apartments', requiredPermission: { module: 'APARTMENTS', action: 'VIEW' } },
  { key: 'GO_RESIDENTS', title: 'Locatari', subtitle: 'Lista locatarilor', category: 'Navigare', icon: 'users', url: '/admin/residents', requiredPermission: { module: 'RESIDENTS', action: 'VIEW' } },
  { key: 'GO_INVOICES', title: 'Facturi', subtitle: 'Facturi interne si solduri', category: 'Navigare', icon: 'file-text', url: '/admin/invoices', requiredPermission: { module: 'INVOICES', action: 'VIEW' } },
  { key: 'GO_PAYMENTS', title: 'Plati', subtitle: 'Plati manuale si reconciliere', category: 'Navigare', icon: 'receipt', url: '/admin/payments', requiredPermission: { module: 'PAYMENTS', action: 'VIEW' } },
  { key: 'GO_BILLING', title: 'Facturare', subtitle: 'Billing runs si drafturi lunare', category: 'Navigare', icon: 'calculator', url: '/admin/billing', requiredPermission: { module: 'BILLING', action: 'VIEW' } },
  { key: 'GO_REPORTS', title: 'Rapoarte', subtitle: 'Rapoarte financiare si operationale', category: 'Navigare', icon: 'bar-chart', url: '/admin/reports', requiredPermission: { module: 'REPORTS', action: 'VIEW' } },
  { key: 'GO_DATA_QUALITY', title: 'Data Quality', subtitle: 'Probleme de date si verificari', category: 'Navigare', icon: 'shield-check', url: '/admin/data-quality/issues', requiredPermission: { module: 'DATA_QUALITY', action: 'VIEW' } },
  { key: 'GO_IMPORTS', title: 'Importuri', subtitle: 'Import CSV pentru date', category: 'Navigare', icon: 'upload', url: '/admin/imports', requiredPermission: { module: 'IMPORTS', action: 'VIEW' } },
  { key: 'GO_EXPORTS', title: 'Exporturi', subtitle: 'Exporturi si pachete date', category: 'Navigare', icon: 'download', url: '/admin/data-exports', requiredPermission: { module: 'EXPORTS', action: 'VIEW' } },
  { key: 'GO_TEAM', title: 'Echipa', subtitle: 'Staff, roluri si permisiuni', category: 'Navigare', icon: 'users-round', url: '/admin/team', requiredPermission: { module: 'TEAM', action: 'VIEW' } },
  { key: 'GO_BULK_OPERATIONS', title: 'Operatiuni bulk', subtitle: 'Istoricul actiunilor in masa', category: 'Navigare', icon: 'list-checks', url: '/admin/bulk-operations', requiredPermission: { module: 'EXPORTS', action: 'VIEW' } },
  { key: 'CREATE_APARTMENT', title: 'Adauga apartament', subtitle: 'Creeaza un apartament nou', category: 'Actiuni rapide', icon: 'home', url: '/admin/apartments/bulk-create', requiredPermission: { module: 'APARTMENTS', action: 'CREATE' } },
  { key: 'CREATE_RESIDENT', title: 'Adauga locatar', subtitle: 'Creeaza un profil de locatar', category: 'Actiuni rapide', icon: 'user-plus', url: '/admin/residents', requiredPermission: { module: 'RESIDENTS', action: 'CREATE' } },
  { key: 'CREATE_ANNOUNCEMENT', title: 'Creeaza anunt', subtitle: 'Publica un anunt in avizier', category: 'Actiuni rapide', icon: 'megaphone', url: '/admin/announcements/new', requiredPermission: { module: 'ANNOUNCEMENTS', action: 'CREATE' } },
  { key: 'CREATE_REQUEST', title: 'Creeaza solicitare', subtitle: 'Inregistreaza o solicitare interna', category: 'Actiuni rapide', icon: 'message-square-plus', url: '/admin/requests', requiredPermission: { module: 'REQUESTS', action: 'CREATE' } },
  { key: 'RECORD_PAYMENT', title: 'Inregistreaza plata', subtitle: 'Adauga o plata manuala', category: 'Actiuni rapide', icon: 'receipt', url: '/admin/payments', requiredPermission: { module: 'PAYMENTS', action: 'CREATE' } },
  { key: 'START_BILLING_RUN', title: 'Porneste billing run', subtitle: 'Deschide formularul pentru facturare lunara', category: 'Actiuni rapide', icon: 'calculator', url: '/admin/billing/runs/new', requiredPermission: { module: 'BILLING', action: 'MANAGE' } },
  { key: 'RUN_DATA_QUALITY', title: 'Ruleaza Data Quality', subtitle: 'Deschide centrul de verificari', category: 'Actiuni rapide', icon: 'shield-check', url: '/admin/data-quality', requiredPermission: { module: 'DATA_QUALITY', action: 'MANAGE' } },
  { key: 'IMPORT_APARTMENTS', title: 'Importa apartamente', subtitle: 'CSV pentru apartamente', category: 'Import/Export', icon: 'upload', url: '/admin/imports/apartments', requiredPermission: { module: 'IMPORTS', action: 'IMPORT' } },
  { key: 'IMPORT_RESIDENTS', title: 'Importa locatari', subtitle: 'CSV pentru locatari', category: 'Import/Export', icon: 'upload', url: '/admin/imports/residents', requiredPermission: { module: 'IMPORTS', action: 'IMPORT' } },
  { key: 'IMPORT_METERS', title: 'Importa contoare', subtitle: 'CSV pentru contoare', category: 'Import/Export', icon: 'upload', url: '/admin/imports/meters', requiredPermission: { module: 'IMPORTS', action: 'IMPORT' } },
  { key: 'EXPORT_INVOICES', title: 'Exporta facturi', subtitle: 'Deschide exportul pentru facturi', category: 'Import/Export', icon: 'download', url: '/admin/data-exports/new?exportType=ASSOCIATION_FINANCIAL_EXPORT', requiredPermission: { module: 'EXPORTS', action: 'EXPORT' }, extraPermission: { module: 'INVOICES', action: 'VIEW' } },
  { key: 'OPEN_SUBSCRIPTION', title: 'Abonament', subtitle: 'Vezi statusul abonamentului', category: 'Suport', icon: 'credit-card', url: '/admin/subscription' },
  { key: 'OPEN_HELP_CENTER', title: 'Help Center', subtitle: 'Ghiduri pentru administratori', category: 'Suport', icon: 'help-circle', url: '/admin/help' },
];
