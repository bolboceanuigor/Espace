import {
  BackupCheckStatus,
  BackupScope,
  ProductionIncidentSeverity,
  RecoveryRunbookStatus,
  RecoveryScenario,
} from '@prisma/client';

export const BACKUP_CHECKLIST_SEEDS = [
  ['db_strategy_documented', 'Database backup', 'Supabase/PostgreSQL backup strategy documented', 'Strategia de backup production este documentata clar.', 'CRITICAL', true, '/ro/superadmin/backup/recovery-plan'],
  ['db_url_env_only', 'Database backup', 'Production DATABASE_URL stored only in ENV', 'DATABASE_URL nu este salvat in cod, DB sau UI.', 'CRITICAL', true, '/ro/superadmin/backup/checklist'],
  ['db_daily_backup_available', 'Database backup', 'Daily backup available from provider or manual process', 'Exista backup zilnic prin provider sau proces manual verificat.', 'CRITICAL', true, '/ro/superadmin/backup/backup-checks/new'],
  ['db_restore_documented', 'Database backup', 'Restore process documented', 'Procesul de restore este documentat si fara reset destructiv.', 'CRITICAL', true, '/ro/superadmin/backup/recovery-plan'],
  ['db_restore_tested', 'Database backup', 'Restore tested at least once', 'Restore-ul a fost testat pe environment separat.', 'WARNING', true, '/ro/superadmin/backup/recovery-drills/new'],
  ['db_migrations_history', 'Database backup', 'Prisma migrations history available', 'Istoricul migrations exista in repository.', 'CRITICAL', true, null],
  ['db_no_destructive_reset', 'Database backup', 'No destructive reset commands used in production', 'migrate reset/db reset sunt interzise in production.', 'CRITICAL', true, null],
  ['source_main_documented', 'Source code', 'GitHub main branch protected or documented', 'Branch-ul main este documentat/protejat operational.', 'WARNING', true, null],
  ['source_latest_main', 'Source code', 'Latest code pushed to main', 'Codul curent este disponibil pe main.', 'CRITICAL', true, null],
  ['source_package_lock', 'Source code', 'package-lock.json present', 'npm este managerul folosit si package-lock exista.', 'CRITICAL', true, null],
  ['source_no_pnpm_lock', 'Source code', 'no pnpm-lock.yaml if npm is chosen', 'pnpm-lock.yaml nu este folosit pentru productie.', 'WARNING', true, null],
  ['source_deploy_script', 'Source code', 'deploy script documented', 'Comenzile de build/deploy sunt documentate.', 'WARNING', true, '/ro/superadmin/launch/deployments'],
  ['deploy_vercel_main', 'Deployments', 'Vercel frontend connected to main', 'Frontend production este legat de main.', 'CRITICAL', true, '/ro/superadmin/launch/deployments'],
  ['deploy_render_main', 'Deployments', 'Render backend connected to main', 'Backend production este legat de main.', 'CRITICAL', true, '/ro/superadmin/launch/deployments'],
  ['deploy_last_build_passes', 'Deployments', 'last build passes', 'Ultimul npm run build trece.', 'CRITICAL', true, '/ro/superadmin/launch/deployments'],
  ['deploy_rollback_strategy', 'Deployments', 'rollback strategy documented', 'Rollback-ul este documentat pentru Vercel/Render.', 'WARNING', true, '/ro/superadmin/backup/recovery-plan'],
  ['env_render_database_url', 'Environment variables', 'DATABASE_URL present in Render', 'DATABASE_URL este prezent in env backend.', 'CRITICAL', true, '/ro/superadmin/launch/env'],
  ['env_jwt_secret', 'Environment variables', 'JWT_SECRET present', 'JWT_SECRET este prezent.', 'CRITICAL', true, '/ro/superadmin/launch/env'],
  ['env_cors_origin', 'Environment variables', 'CORS_ORIGIN present', 'CORS_ORIGIN este prezent.', 'CRITICAL', true, '/ro/superadmin/launch/env'],
  ['env_next_public_api_url', 'Environment variables', 'NEXT_PUBLIC_API_URL present in Vercel', 'URL-ul public API este setat in frontend.', 'CRITICAL', true, '/ro/superadmin/launch/env'],
  ['env_optional_providers_documented', 'Environment variables', 'notification/payment vars documented', 'Variabilele pentru notificari si plati sunt documentate, fara valori secrete.', 'WARNING', true, '/ro/superadmin/launch/env'],
  ['storage_strategy', 'Files/storage', 'if file storage exists, backup strategy documented', 'Storage-ul are strategie de backup sau este marcat not applicable.', 'WARNING', false, null],
  ['legal_pages_versioned', 'Legal/system docs', 'legal pages exported/versioned', 'Documentele legale sunt versionate/publicate.', 'WARNING', true, '/ro/superadmin/legal'],
  ['help_center_available', 'Legal/system docs', 'help center available', 'Help Center este disponibil.', 'WARNING', true, '/ro/help'],
  ['launch_services_filled', 'Legal/system docs', 'launch services console filled', 'Serviciile platformei sunt completate.', 'CRITICAL', true, '/ro/superadmin/launch/services'],
  ['drill_db_restore', 'Recovery drills', 'database restore drill performed', 'A fost documentat un drill de restore DB.', 'WARNING', true, '/ro/superadmin/backup/recovery-drills/new'],
  ['drill_failed_deploy', 'Recovery drills', 'failed deploy drill performed', 'A fost documentat un drill de deploy esuat.', 'WARNING', true, '/ro/superadmin/backup/recovery-drills/new'],
  ['drill_backend_down', 'Recovery drills', 'backend down drill performed', 'A fost documentat un drill pentru backend down.', 'WARNING', true, '/ro/superadmin/backup/recovery-drills/new'],
] as const;

export const RECOVERY_RUNBOOK_SEEDS = [
  {
    key: 'database_down',
    title: 'Database down',
    description: 'Plan operational pentru indisponibilitatea bazei de date production.',
    scenario: RecoveryScenario.DATABASE_DOWN,
    severity: ProductionIncidentSeverity.CRITICAL,
    steps: [
      'Verifica status Supabase/DB provider.',
      'Verifica Render logs pentru DATABASE_URL fara a afisa valoarea.',
      'Verifica /api/health/readiness.',
      'Nu rula reset.',
      'Comunica incidentul intern.',
      'Pregateste backup recent daca este nevoie de restore.',
      'Fa restore pe environment separat intai, nu direct pe production.',
      'Verifica datele si abia apoi planifica restore production controlat.',
    ],
  },
  {
    key: 'failed_deployment',
    title: 'Failed deployment',
    description: 'Plan pentru deploy esuat pe Vercel sau Render.',
    scenario: RecoveryScenario.FAILED_DEPLOY,
    severity: ProductionIncidentSeverity.HIGH,
    steps: ['Verifica Vercel/Render build logs.', 'Verifica commitul.', 'Ruleaza build local.', 'Revino la ultimul deploy stabil daca este posibil.', 'Nu face force push fara backup branch.'],
  },
  {
    key: 'failed_migration',
    title: 'Failed migration',
    description: 'Plan pentru migration Prisma esuata sau riscanta.',
    scenario: RecoveryScenario.FAILED_MIGRATION,
    severity: ProductionIncidentSeverity.CRITICAL,
    steps: ['Opreste rollout daca este posibil.', 'Verifica migration SQL.', 'Nu rula migrate reset.', 'Verifica backup DB.', 'Aplica fix migration controlat.', 'Testeaza pe staging/local.'],
  },
  {
    key: 'accidental_data_change',
    title: 'Accidental data change',
    description: 'Plan pentru corectii dupa modificari accidentale de date.',
    scenario: RecoveryScenario.ACCIDENTAL_DATA_CHANGE,
    severity: ProductionIncidentSeverity.HIGH,
    steps: ['Identifica actorul si timestamp din AuditLog.', 'Identifica resursele afectate.', 'Nu rula restore complet daca poti face corectie punctuala.', 'Exporta datele curente.', 'Compara cu backup.', 'Aplica corectie cu audit.'],
  },
  {
    key: 'frontend_down',
    title: 'Frontend down',
    description: 'Plan pentru indisponibilitate frontend.',
    scenario: RecoveryScenario.FRONTEND_DOWN,
    severity: ProductionIncidentSeverity.HIGH,
    steps: ['Verifica Vercel deployment.', 'Verifica DNS/domain.', 'Verifica NEXT_PUBLIC_API_URL.', 'Redeploy last stable.'],
  },
  {
    key: 'backend_down',
    title: 'Backend down',
    description: 'Plan pentru indisponibilitate API backend.',
    scenario: RecoveryScenario.BACKEND_DOWN,
    severity: ProductionIncidentSeverity.CRITICAL,
    steps: ['Verifica Render service.', 'Verifica env vars.', 'Verifica logs.', 'Verifica DB.', 'Restart service din provider daca este necesar.'],
  },
  {
    key: 'domain_dns_issue',
    title: 'Domain/DNS issue',
    description: 'Plan pentru domeniu, DNS sau certificate.',
    scenario: RecoveryScenario.DOMAIN_DNS_ISSUE,
    severity: ProductionIncidentSeverity.HIGH,
    steps: ['Verifica domain registrar payment.', 'Verifica DNS provider.', 'Verifica Vercel domain config.', 'Verifica certificates.'],
  },
  {
    key: 'security_incident',
    title: 'Security incident',
    description: 'Plan initial pentru incident de securitate.',
    scenario: RecoveryScenario.SECURITY_INCIDENT,
    severity: ProductionIncidentSeverity.CRITICAL,
    steps: ['Restrictioneaza accesul afectat.', 'Verifica AuditLog si Support Access.', 'Identifica tenantii/resursele afectate.', 'Roteaza secretele doar in providerii de env, nu in DB.', 'Documenteaza incidentul si actiunile.'],
  },
  {
    key: 'notification_provider_issue',
    title: 'Notification provider issue',
    description: 'Plan pentru email/SMS down.',
    scenario: RecoveryScenario.NOTIFICATION_PROVIDER_ISSUE,
    severity: ProductionIncidentSeverity.MEDIUM,
    steps: ['Verifica provider health.', 'Confirma fallback in-app/console.', 'Nu retrimite masiv fara dedupe.', 'Documenteaza impactul.'],
  },
  {
    key: 'payment_provider_issue',
    title: 'Payment provider issue',
    description: 'Plan pentru provider plati online viitor.',
    scenario: RecoveryScenario.PAYMENT_PROVIDER_ISSUE,
    severity: ProductionIncidentSeverity.MEDIUM,
    steps: ['Confirma ca platile online sunt placeholder/MVP.', 'Nu marca facturi ca platite din webhook nevalidat.', 'Foloseste plati manuale ca metoda principala.', 'Documenteaza incidentul.'],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  title: string;
  description: string;
  scenario: RecoveryScenario;
  severity: ProductionIncidentSeverity;
  steps: string[];
}>;

export const EXPORT_CENTER_ITEMS = [
  ['associations.csv', 'Asociatii/APC', 'Export administrativ al asociatiilor.'],
  ['users.csv', 'Utilizatori', 'Utilizatori fara parole, tokenuri sau secrete.'],
  ['apartments.csv', 'Apartamente', 'Apartamente si metadate operationale.'],
  ['residents.csv', 'Locatari', 'Locatari si contacte permise.'],
  ['invoices.csv', 'Facturi', 'Facturi interne si statusuri.'],
  ['payments.csv', 'Plati', 'Plati manuale confirmate.'],
  ['meters.csv', 'Contoare', 'Contoare configurate.'],
  ['meter-readings.csv', 'Indici', 'Istoric indici contoare.'],
  ['audit-log.csv', 'Audit log', 'Istoric actiuni sensibile.'],
  ['saas-subscriptions.csv', 'SaaS subscriptions', 'Abonamente SaaS APC.'],
  ['platform-services.csv', 'Platform services', 'Servicii platforma si costuri, fara secrete.'],
] as const;

export const DANGEROUS_COMMANDS = [
  'prisma migrate reset',
  'prisma db push --force-reset',
  'DROP DATABASE',
  'TRUNCATE fara backup',
  'rm -rf pe directoare de date',
  'stergere manuala tabele production',
  'restore peste production fara backup curent',
  'force push pe main fara motiv controlat',
];

export const DEFAULT_BACKUP_CHECK_STATUS = BackupCheckStatus.NOT_CHECKED;
export const DEFAULT_BACKUP_SCOPE = BackupScope.DATABASE;
export const DEFAULT_RUNBOOK_STATUS = RecoveryRunbookStatus.ACTIVE;
