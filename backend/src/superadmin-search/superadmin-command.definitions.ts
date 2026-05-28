export type SuperadminCommandKey =
  | 'GO_SUPERADMIN_DASHBOARD'
  | 'GO_ASSOCIATIONS'
  | 'GO_CUSTOMER_REQUESTS'
  | 'GO_BILLING'
  | 'GO_SAAS_PLANS'
  | 'GO_SAAS_SUBSCRIPTIONS'
  | 'GO_SAAS_INVOICES'
  | 'GO_SECURITY_CENTER'
  | 'GO_MONITORING'
  | 'GO_SUPPORT_ACCESS'
  | 'GO_PLATFORM_SERVICES'
  | 'GO_LAUNCH_CENTER'
  | 'GO_BACKUP_CENTER'
  | 'GO_DATA_RETENTION'
  | 'GO_DATA_REQUESTS'
  | 'GO_HELP_MANAGEMENT'
  | 'GO_LEGAL_MANAGEMENT'
  | 'CREATE_ASSOCIATION'
  | 'CREATE_SAAS_PLAN'
  | 'CREATE_PLATFORM_SERVICE'
  | 'CREATE_HELP_ARTICLE'
  | 'CREATE_LEGAL_DOCUMENT'
  | 'OPEN_HEALTH_STATUS'
  | 'OPEN_COSTS_CONSOLE';

export type SuperadminCommandDefinition = {
  key: SuperadminCommandKey;
  title: string;
  subtitle: string;
  category: 'Navigare' | 'Actiuni rapide' | 'Platforma' | 'Governance';
  icon: string;
  url: string;
  danger?: boolean;
};

export const SUPERADMIN_COMMANDS: SuperadminCommandDefinition[] = [
  { key: 'GO_SUPERADMIN_DASHBOARD', title: 'Superadmin dashboard', subtitle: 'Overview platforma Espace', category: 'Navigare', icon: 'layout-dashboard', url: '/superadmin' },
  { key: 'GO_ASSOCIATIONS', title: 'Asociatii', subtitle: 'Lista APC-uri/clienti', category: 'Navigare', icon: 'building', url: '/superadmin/associations' },
  { key: 'GO_CUSTOMER_REQUESTS', title: 'Cereri clienti', subtitle: 'Cererile venite din website', category: 'Navigare', icon: 'inbox', url: '/superadmin/customer-requests' },
  { key: 'GO_BILLING', title: 'SaaS billing', subtitle: 'Planuri, abonamente si facturi', category: 'Navigare', icon: 'credit-card', url: '/superadmin/billing' },
  { key: 'GO_SAAS_PLANS', title: 'Planuri SaaS', subtitle: 'Configureaza planurile comerciale', category: 'Navigare', icon: 'layers', url: '/superadmin/billing/plans' },
  { key: 'GO_SAAS_SUBSCRIPTIONS', title: 'Abonamente SaaS', subtitle: 'Abonamentele asociatiilor', category: 'Navigare', icon: 'repeat', url: '/superadmin/billing/subscriptions' },
  { key: 'GO_SAAS_INVOICES', title: 'Facturi SaaS', subtitle: 'Facturarea Espace catre clienti', category: 'Navigare', icon: 'file-text', url: '/superadmin/billing/saas-invoices' },
  { key: 'GO_SECURITY_CENTER', title: 'Security Center', subtitle: 'Audit, access si riscuri', category: 'Platforma', icon: 'shield', url: '/superadmin/team/security' },
  { key: 'GO_MONITORING', title: 'Monitoring', subtitle: 'Health, erori si servicii', category: 'Platforma', icon: 'activity', url: '/superadmin/monitoring' },
  { key: 'GO_SUPPORT_ACCESS', title: 'Support access', subtitle: 'Sesiuni de suport controlate', category: 'Platforma', icon: 'life-buoy', url: '/superadmin/support-mode' },
  { key: 'GO_PLATFORM_SERVICES', title: 'Servicii platforma', subtitle: 'Vercel, Render, Supabase, DNS si costuri', category: 'Platforma', icon: 'server', url: '/superadmin/launch/services' },
  { key: 'GO_LAUNCH_CENTER', title: 'Go-Live Control Center', subtitle: 'Checklist lansare si readiness', category: 'Platforma', icon: 'rocket', url: '/superadmin/launch' },
  { key: 'GO_BACKUP_CENTER', title: 'Backup & Recovery', subtitle: 'Plan backup, runbooks si incidente', category: 'Platforma', icon: 'database-backup', url: '/superadmin/backup' },
  { key: 'GO_DATA_RETENTION', title: 'Data Retention', subtitle: 'Politici de pastrare si archive', category: 'Governance', icon: 'archive', url: '/superadmin/data-retention' },
  { key: 'GO_DATA_REQUESTS', title: 'Cereri de date', subtitle: 'Portabilitate, export si corectare', category: 'Governance', icon: 'file-search', url: '/superadmin/data-requests' },
  { key: 'GO_HELP_MANAGEMENT', title: 'Help management', subtitle: 'Articole si ghiduri', category: 'Governance', icon: 'help-circle', url: '/superadmin/help/articles' },
  { key: 'GO_LEGAL_MANAGEMENT', title: 'Legal & Trust', subtitle: 'Documente legale si trust pages', category: 'Governance', icon: 'scale', url: '/superadmin/legal' },
  { key: 'CREATE_ASSOCIATION', title: 'Creeaza asociatie', subtitle: 'Deschide formularul pentru APC nou', category: 'Actiuni rapide', icon: 'building-plus', url: '/superadmin/associations/new' },
  { key: 'CREATE_SAAS_PLAN', title: 'Creeaza plan SaaS', subtitle: 'Adauga un plan comercial', category: 'Actiuni rapide', icon: 'layers', url: '/superadmin/billing/plans/new' },
  { key: 'CREATE_PLATFORM_SERVICE', title: 'Adauga serviciu platforma', subtitle: 'Inregistreaza un serviciu/cost nou', category: 'Actiuni rapide', icon: 'server', url: '/superadmin/launch/services/new' },
  { key: 'CREATE_HELP_ARTICLE', title: 'Creeaza articol help', subtitle: 'Deschide editorul Help Center', category: 'Actiuni rapide', icon: 'help-circle', url: '/superadmin/help/articles/new' },
  { key: 'CREATE_LEGAL_DOCUMENT', title: 'Creeaza document legal', subtitle: 'Deschide editorul Legal & Trust', category: 'Actiuni rapide', icon: 'scale', url: '/superadmin/legal/documents/new' },
  { key: 'OPEN_HEALTH_STATUS', title: 'Health status', subtitle: 'Verifica /api/health si servicii', category: 'Platforma', icon: 'heart-pulse', url: '/superadmin/monitoring/health' },
  { key: 'OPEN_COSTS_CONSOLE', title: 'Costuri lunare platforma', subtitle: 'Console pentru servicii de achitat', category: 'Platforma', icon: 'wallet', url: '/superadmin/launch/costs' },
];
