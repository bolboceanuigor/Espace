import { SavedViewModule } from '@prisma/client';

export type SmartListSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type SmartListDefinition = {
  key: string;
  module: SavedViewModule;
  name: string;
  description: string;
  filters: Record<string, unknown>;
  severity: SmartListSeverity;
  actionHint: string;
  requiredPermission: string;
};

export const SMART_LIST_DEFINITIONS: SmartListDefinition[] = [
  { key: 'APARTMENTS_WITHOUT_PRIMARY_CONTACT', module: SavedViewModule.APARTMENTS, name: 'Apartamente fără contact principal', description: 'Apartamente care nu au contact principal setat.', filters: { hasPrimaryContact: 'false' }, severity: 'WARNING', actionHint: 'Setează contact principal', requiredPermission: 'APARTMENTS.VIEW' },
  { key: 'APARTMENTS_WITHOUT_AREA', module: SavedViewModule.APARTMENTS, name: 'Apartamente fără suprafață', description: 'Apartamente fără m² completați.', filters: { hasArea: 'false' }, severity: 'WARNING', actionHint: 'Completează suprafața', requiredPermission: 'APARTMENTS.VIEW' },
  { key: 'APARTMENTS_UNKNOWN_STATUS', module: SavedViewModule.APARTMENTS, name: 'Apartamente cu status necunoscut', description: 'Apartamente care trebuie revizuite operațional.', filters: { status: 'UNKNOWN' }, severity: 'INFO', actionHint: 'Setează statusul corect', requiredPermission: 'APARTMENTS.VIEW' },
  { key: 'APARTMENTS_WITHOUT_RESIDENTS', module: SavedViewModule.APARTMENTS, name: 'Apartamente fără locatari', description: 'Apartamente fără relații active cu locatari.', filters: { hasResidents: 'false' }, severity: 'WARNING', actionHint: 'Leagă locatari', requiredPermission: 'APARTMENTS.VIEW' },

  { key: 'RESIDENTS_WITHOUT_CONTACT', module: SavedViewModule.RESIDENTS, name: 'Locatari fără contact', description: 'Locatari fără telefon și fără email.', filters: { withoutContact: true }, severity: 'WARNING', actionHint: 'Completează telefon sau email', requiredPermission: 'RESIDENTS.VIEW' },
  { key: 'RESIDENTS_WITHOUT_APARTMENT', module: SavedViewModule.RESIDENTS, name: 'Locatari fără apartament', description: 'Locatari care nu sunt legați de un apartament.', filters: { hasApartment: 'false' }, severity: 'WARNING', actionHint: 'Leagă apartament', requiredPermission: 'RESIDENTS.VIEW' },
  { key: 'RESIDENTS_WITHOUT_PORTAL_ACCESS', module: SavedViewModule.RESIDENTS, name: 'Locatari fără acces portal', description: 'Locatari fără acces activ în portal.', filters: { portalAccessStatus: 'NO_ACCESS' }, severity: 'INFO', actionHint: 'Trimite invitații portal', requiredPermission: 'RESIDENTS.VIEW' },
  { key: 'RESIDENTS_INVITED_NOT_ACTIVE', module: SavedViewModule.RESIDENTS, name: 'Invitați dar neactivați', description: 'Locatari invitați care încă nu au activat accesul.', filters: { portalAccessStatus: 'INVITED' }, severity: 'INFO', actionHint: 'Verifică invitațiile', requiredPermission: 'RESIDENTS.VIEW' },

  { key: 'INVOICES_OVERDUE', module: SavedViewModule.INVOICES, name: 'Facturi întârziate', description: 'Facturi emise cu scadență depășită și sold rămas.', filters: { overdueOnly: true }, severity: 'WARNING', actionHint: 'Verifică soldurile', requiredPermission: 'INVOICES.VIEW' },
  { key: 'INVOICES_UNPAID', module: SavedViewModule.INVOICES, name: 'Facturi neachitate', description: 'Facturi emise sau parțial achitate.', filters: { status: 'ISSUED' }, severity: 'WARNING', actionHint: 'Înregistrează plățile', requiredPermission: 'INVOICES.VIEW' },
  { key: 'INVOICES_PARTIALLY_PAID', module: SavedViewModule.INVOICES, name: 'Facturi parțial achitate', description: 'Facturi cu status parțial achitat.', filters: { status: 'PARTIAL' }, severity: 'INFO', actionHint: 'Urmărește diferențele', requiredPermission: 'INVOICES.VIEW' },
  { key: 'INVOICES_CANCELLED_VOID', module: SavedViewModule.INVOICES, name: 'Facturi anulate', description: 'Facturi anulate sau scoase din circuit.', filters: { status: 'CANCELLED' }, severity: 'INFO', actionHint: 'Verifică motivul anulării', requiredPermission: 'INVOICES.VIEW' },

  { key: 'PAYMENTS_THIS_MONTH', module: SavedViewModule.PAYMENTS, name: 'Plăți luna curentă', description: 'Plăți confirmate în luna curentă.', filters: { currentMonth: true, status: 'CONFIRMED' }, severity: 'INFO', actionHint: 'Reconciliere lunară', requiredPermission: 'PAYMENTS.VIEW' },
  { key: 'PAYMENTS_CANCELLED', module: SavedViewModule.PAYMENTS, name: 'Plăți anulate', description: 'Plăți anulate care pot necesita verificare.', filters: { status: 'CANCELLED' }, severity: 'WARNING', actionHint: 'Verifică istoricul', requiredPermission: 'PAYMENTS.VIEW' },
  { key: 'PAYMENTS_MANUAL_BANK_TRANSFER', module: SavedViewModule.PAYMENTS, name: 'Transferuri bancare manuale', description: 'Plăți bancare introduse manual.', filters: { method: 'BANK_TRANSFER' }, severity: 'INFO', actionHint: 'Reconciliere bancară', requiredPermission: 'PAYMENTS.VIEW' },

  { key: 'METERS_INACTIVE', module: SavedViewModule.METERS, name: 'Contoare inactive', description: 'Contoare marcate inactive.', filters: { status: 'INACTIVE' }, severity: 'INFO', actionHint: 'Verifică arhivarea', requiredPermission: 'METERS.VIEW' },
  { key: 'METERS_WITHOUT_READINGS', module: SavedViewModule.METERS, name: 'Contoare fără indici', description: 'Contoare care nu au niciun indice înregistrat.', filters: { withoutReadings: true }, severity: 'WARNING', actionHint: 'Adaugă indici', requiredPermission: 'METERS.VIEW' },

  { key: 'REQUESTS_OPEN', module: SavedViewModule.REQUESTS, name: 'Solicitări deschise', description: 'Solicitări noi sau în lucru.', filters: { openOnly: true }, severity: 'WARNING', actionHint: 'Preia solicitările', requiredPermission: 'REQUESTS.VIEW' },
  { key: 'REQUESTS_URGENT', module: SavedViewModule.REQUESTS, name: 'Solicitări urgente', description: 'Solicitări cu prioritate urgentă sau înaltă.', filters: { priority: 'URGENT' }, severity: 'CRITICAL', actionHint: 'Răspunde rapid', requiredPermission: 'REQUESTS.VIEW' },
  { key: 'REQUESTS_WAITING_RESIDENT', module: SavedViewModule.REQUESTS, name: 'Așteaptă locatar', description: 'Solicitări care așteaptă informații de la locatar.', filters: { status: 'WAITING_FOR_RESIDENT' }, severity: 'INFO', actionHint: 'Trimite follow-up', requiredPermission: 'REQUESTS.VIEW' },

  { key: 'ANNOUNCEMENTS_PINNED', module: SavedViewModule.ANNOUNCEMENTS, name: 'Anunțuri fixate', description: 'Anunțuri importante afișate sus.', filters: { isPinned: true }, severity: 'INFO', actionHint: 'Revizuiește relevanța', requiredPermission: 'ANNOUNCEMENTS.VIEW' },
  { key: 'ANNOUNCEMENTS_ARCHIVED', module: SavedViewModule.ANNOUNCEMENTS, name: 'Anunțuri arhivate', description: 'Anunțuri scoase din listele active.', filters: { status: 'ARCHIVED' }, severity: 'INFO', actionHint: 'Verifică arhiva', requiredPermission: 'ANNOUNCEMENTS.VIEW' },

  { key: 'DQ_CRITICAL_OPEN', module: SavedViewModule.DATA_QUALITY, name: 'Probleme critice deschise', description: 'Probleme critice care trebuie rezolvate înainte de facturare.', filters: { severity: 'CRITICAL', status: 'OPEN' }, severity: 'CRITICAL', actionHint: 'Rezolvă înainte de billing', requiredPermission: 'DATA_QUALITY.VIEW' },
  { key: 'DQ_WARNINGS_OPEN', module: SavedViewModule.DATA_QUALITY, name: 'Warnings deschise', description: 'Avertizări de calitate date încă deschise.', filters: { severity: 'WARNING', status: 'OPEN' }, severity: 'WARNING', actionHint: 'Planifică remedierea', requiredPermission: 'DATA_QUALITY.VIEW' },
  { key: 'DQ_BLOCKS_BILLING', module: SavedViewModule.DATA_QUALITY, name: 'Blochează facturarea', description: 'Probleme cu impact direct asupra billingului.', filters: { billingImpact: 'BLOCKS_BILLING', status: 'OPEN' }, severity: 'CRITICAL', actionHint: 'Remediază urgent', requiredPermission: 'DATA_QUALITY.VIEW' },

  { key: 'IMPORTS_FAILED', module: SavedViewModule.IMPORTS, name: 'Importuri eșuate', description: 'Importuri care au eșuat și trebuie revizuite.', filters: { status: 'FAILED' }, severity: 'WARNING', actionHint: 'Verifică fișierul', requiredPermission: 'IMPORTS.VIEW' },
  { key: 'EXPORTS_FAILED', module: SavedViewModule.EXPORTS, name: 'Exporturi eșuate', description: 'Exporturi care nu au putut fi generate.', filters: { status: 'FAILED' }, severity: 'WARNING', actionHint: 'Reîncearcă exportul', requiredPermission: 'EXPORTS.VIEW' },
];

export function findSmartList(key: string) {
  return SMART_LIST_DEFINITIONS.find((item) => item.key === key);
}
