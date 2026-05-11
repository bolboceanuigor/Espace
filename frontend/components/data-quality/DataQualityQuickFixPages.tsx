'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw, Wand2 } from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrapper,
} from '@/components/ui';
import EmptyState from '@/components/common/EmptyState';
import { dataQualityApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';
type IssueStatus = 'OPEN' | 'RESOLVED' | 'IGNORED';

type FixOption = {
  type: string;
  key?: string;
  label: string;
  description?: string;
  requiresInput?: boolean;
  actionUrl?: string | null;
};

type FixIssue = {
  id: string;
  key: string;
  category: string;
  categoryLabel?: string;
  severity: Severity;
  status: IssueStatus;
  entityType: string;
  entityId?: string | null;
  title: string;
  description: string;
  recommendation: string;
  actionUrl?: string | null;
  billingImpact: 'BLOCKS_BILLING' | 'AFFECTS_BILLING' | 'NO_BILLING_IMPACT';
  metadata?: Record<string, unknown>;
  detectedAt: string;
  quickFixes?: FixOption[];
  availableFixes?: FixOption[];
};

type FixPreview = {
  issue: FixIssue;
  fix: { type: string; label: string; canApply: boolean; requiresConfirmation: boolean };
  entity: { type: string; id?: string | null; label?: string | null; actionUrl?: string | null };
  changes: Array<{ field: string; currentValue: unknown; newValue: unknown }>;
  warnings: string[];
  impact: { billingImpact: string; message: string };
  options?: FixContext;
};

type FixContext = {
  apartments?: Array<{ id: string; label: string; number?: string | null }>;
  residents?: Array<{ id: string; label: string; fullName?: string; status?: string }>;
  apartmentResidents?: Array<{ residentId: string; label: string; isPrimary: boolean; role: string }>;
  buildings?: Array<{ id: string; label: string; name?: string | null }>;
  staircases?: Array<{ id: string; label: string; name?: string | null; buildingId?: string | null }>;
};

const severityLabel: Record<Severity, string> = {
  CRITICAL: 'Critic',
  WARNING: 'Warning',
  INFO: 'Info',
};

const severityVariant: Record<Severity, 'error' | 'warning' | 'neutral'> = {
  CRITICAL: 'error',
  WARNING: 'warning',
  INFO: 'neutral',
};

const impactLabel = {
  BLOCKS_BILLING: 'Blochează facturarea',
  AFFECTS_BILLING: 'Afectează facturarea',
  NO_BILLING_IMPACT: 'Fără impact direct',
};

const fixLabels: Record<string, string> = {
  SET_APARTMENT_AREA: 'Completează suprafața',
  SET_APARTMENT_STATUS: 'Setează status apartament',
  SET_APARTMENT_STAIRCASE: 'Completează scara',
  SET_APARTMENT_FLOOR: 'Completează etajul',
  SET_PRIMARY_CONTACT: 'Alege contact principal',
  LINK_RESIDENT_TO_APARTMENT: 'Leagă locatar de apartament',
  RESOLVE_MULTIPLE_PRIMARY_CONTACTS: 'Rezolvă primary contacts duplicate',
  SET_RESIDENT_STATUS: 'Setează status locatar',
  SET_TARIFF_PRICE: 'Completează tarif',
  SET_METER_UNIT: 'Completează unitate contor',
  SET_METER_NUMBER: 'Completează număr contor',
  SET_METER_STATUS: 'Setează status contor',
  MARK_READING_NEEDS_REVIEW: 'Marchează needs review',
  REJECT_METER_READING: 'Respinge indice',
  START_BILLING_RUN: 'Pornește BillingRun',
  RUN_DATA_QUALITY: 'Rulează verificări',
  MARK_ISSUE_RESOLVED: 'Marchează rezolvat',
  MARK_ISSUE_IGNORED: 'Ignoră cu motiv',
  REOPEN_ISSUE: 'Redeschide',
};

function unwrap<T>(res: any): T {
  return res?.data || res;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function valueLabel(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function localizeAction(localizedPath: (path: string) => string, url?: string | null) {
  if (!url) return localizedPath('/admin/data-quality');
  if (url.startsWith('/ro/') || url.startsWith('/ru/') || url.startsWith('/en/')) return url;
  return localizedPath(url);
}

function isActionable(option: FixOption) {
  return !['MARK_ISSUE_RESOLVED', 'MARK_ISSUE_IGNORED', 'REOPEN_ISSUE', 'RUN_DATA_QUALITY'].includes(option.type);
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value || 'empty'} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function defaultPayload(type: string, issue?: FixIssue | null, context?: FixContext): Record<string, string | boolean> {
  const fromKey = issue?.key?.split(':')[1] || '';
  if (type === 'SET_APARTMENT_STATUS') return { status: 'OCCUPIED' };
  if (type === 'SET_APARTMENT_STAIRCASE') return { staircaseId: '', staircaseName: '', buildingName: '' };
  if (type === 'SET_METER_STATUS') return { status: 'INACTIVE' };
  if (type === 'SET_METER_UNIT') return { unit: String(issue?.metadata?.suggestedUnit || '') };
  if (type === 'MARK_READING_NEEDS_REVIEW') return { adminComment: 'Marcat needs review din Data Quality.' };
  if (type === 'START_BILLING_RUN') return { billingMonth: /^\d{4}-\d{2}$/.test(fromKey) ? fromKey : currentMonth() };
  if (type === 'RUN_DATA_QUALITY') return { billingMonth: currentMonth() };
  if (type === 'SET_PRIMARY_CONTACT' || type === 'RESOLVE_MULTIPLE_PRIMARY_CONTACTS') {
    return { residentId: context?.apartmentResidents?.[0]?.residentId || context?.residents?.[0]?.id || '', role: 'OWNER' };
  }
  if (type === 'LINK_RESIDENT_TO_APARTMENT') {
    return {
      apartmentId: issue?.entityType === 'APARTMENT' ? String(issue.entityId || '') : context?.apartments?.[0]?.id || '',
      residentId: issue?.entityType === 'RESIDENT' ? String(issue.entityId || '') : context?.residents?.[0]?.id || '',
      role: 'OWNER',
      isPrimaryContact: false,
    };
  }
  if (type === 'SET_RESIDENT_STATUS') return { status: 'ACTIVE' };
  if (type === 'MARK_ISSUE_RESOLVED') return { note: 'Rezolvat manual după verificare.' };
  return {};
}

function normalizedPayload(payload: Record<string, any>) {
  const next: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === '') return;
    if (['areaM2', 'floor', 'pricePerM2', 'fixedAmount', 'pricePerUnit', 'amount'].includes(key)) {
      next[key] = Number(value);
    } else {
      next[key] = value;
    }
  });
  return next;
}

export function AdminDataQualityFixesPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<FixIssue[]>([]);
  const [stats, setStats] = useState<any>({});
  const [filters, setFilters] = useState({ category: '', severity: '', fixType: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dataQualityApi.fixes({ ...filters, limit: 100 });
      const payload = unwrap<any>(res);
      setItems(payload.items || []);
      setStats(payload.stats || {});
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca remedierile rapide.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Remedieri rapide"
        description="Rezolvă problemele simple de date cu acțiuni controlate și sigure."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Actualizează</Button>
            <ButtonLink href={localizedPath('/admin/data-quality/issues')} variant="secondary">Vezi toate problemele</ButtonLink>
            <ButtonLink href={localizedPath('/admin/data-quality/fixes/bulk')} variant="secondary">Remedieri bulk</ButtonLink>
            <ButtonLink href={localizedPath('/admin/data-quality')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Calitatea datelor</ButtonLink>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Cu quick fix" value={String(stats.withQuickFix || 0)} tone={stats.withQuickFix ? 'success' : 'neutral'} icon={<Wand2 className="h-5 w-5" />} />
        <StatCard label="Fără quick fix" value={String(stats.withoutQuickFix || 0)} />
        <StatCard label="Critice remediabile" value={String(stats.criticalFixable || 0)} tone={stats.criticalFixable ? 'danger' : 'success'} />
        <StatCard label="Warnings remediabile" value={String(stats.warningFixable || 0)} tone={stats.warningFixable ? 'warning' : 'success'} />
        <StatCard label="Ignorate" value={String(stats.ignoredIssues || 0)} />
        <StatCard label="Aplicate azi" value={String(stats.fixesAppliedToday || 0)} tone="success" />
        <StatCard label="Ultima remediere" value={formatDateTime(stats.lastFixAt)} />
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-4">
        <SelectField label="Categorie" value={filters.category} onChange={(category) => setFilters((old) => ({ ...old, category }))} options={[
          { value: '', label: 'Toate' },
          { value: 'APARTMENTS', label: 'Apartamente' },
          { value: 'RESIDENTS', label: 'Locatari' },
          { value: 'TARIFFS', label: 'Tarife' },
          { value: 'METERS', label: 'Contoare' },
          { value: 'METER_READINGS', label: 'Indici' },
          { value: 'BILLING', label: 'Facturare' },
        ]} />
        <SelectField label="Severitate" value={filters.severity} onChange={(severity) => setFilters((old) => ({ ...old, severity }))} options={[
          { value: '', label: 'Toate' },
          { value: 'CRITICAL', label: 'Critic' },
          { value: 'WARNING', label: 'Warning' },
          { value: 'INFO', label: 'Info' },
        ]} />
        <SelectField label="Tip remediere" value={filters.fixType} onChange={(fixType) => setFilters((old) => ({ ...old, fixType }))} options={[
          { value: '', label: 'Toate' },
          { value: 'SET_APARTMENT_AREA', label: 'Suprafață apartament' },
          { value: 'SET_APARTMENT_STAIRCASE', label: 'Scară apartament' },
          { value: 'SET_PRIMARY_CONTACT', label: 'Contact principal' },
          { value: 'SET_TARIFF_PRICE', label: 'Preț tarif' },
          { value: 'SET_METER_UNIT', label: 'Unitate contor' },
          { value: 'START_BILLING_RUN', label: 'BillingRun' },
        ]} />
        <div className="flex items-end">
          <Button variant="secondary" onClick={load} className="w-full">Aplică filtre</Button>
        </div>
      </Card>

      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}

      {!loading && !items.length ? (
        <EmptyState
          title="Nu există remedieri rapide disponibile"
          description="Problemele rămase necesită verificare manuală sau editare în paginile dedicate."
          actionLabel="Rulează verificări"
          onAction={() => dataQualityApi.run({ billingMonth: currentMonth() }).then(load)}
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((issue) => {
          const fixes = issue.availableFixes || issue.quickFixes || [];
          const primary = fixes.find(isActionable) || fixes[0];
          return (
            <Card key={issue.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={severityVariant[issue.severity]}>{severityLabel[issue.severity]}</Badge>
                    <Badge variant="neutral">{issue.categoryLabel || issue.category}</Badge>
                    <Badge variant={issue.billingImpact === 'BLOCKS_BILLING' ? 'error' : issue.billingImpact === 'AFFECTS_BILLING' ? 'warning' : 'neutral'}>
                      {impactLabel[issue.billingImpact]}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-foreground">{issue.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{issue.recommendation}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fixes.map((fix) => <Badge key={fix.type} variant="neutral">{fix.label || fixLabels[fix.type] || fix.type}</Badge>)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}/fix${primary ? `?fixType=${primary.type}` : ''}`)}>
                    Aplică remediere
                  </ButtonLink>
                  <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}`)} variant="secondary">Detalii</ButtonLink>
                  {issue.actionUrl ? <ButtonLink href={localizeAction(localizedPath, issue.actionUrl)} variant="secondary">Entitate</ButtonLink> : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FixPayloadForm({
  fixType,
  payload,
  setPayload,
  context,
  issue,
}: {
  fixType: string;
  payload: Record<string, any>;
  setPayload: (payload: Record<string, any>) => void;
  context?: FixContext;
  issue?: FixIssue | null;
}) {
  const set = (key: string, value: string | boolean) => setPayload({ ...payload, [key]: value });
  const residentOptions = [
    { value: '', label: 'Alege locatar' },
    ...(context?.apartmentResidents?.length
      ? context.apartmentResidents.map((item) => ({ value: item.residentId, label: item.label }))
      : (context?.residents || []).map((item) => ({ value: item.id, label: item.label }))),
  ];
  const allResidentOptions = [{ value: '', label: 'Alege locatar' }, ...(context?.residents || []).map((item) => ({ value: item.id, label: item.label }))];
  const apartmentOptions = [{ value: '', label: 'Alege apartament' }, ...(context?.apartments || []).map((item) => ({ value: item.id, label: item.label }))];

  if (fixType === 'SET_APARTMENT_AREA') return <Input label="Suprafață, m²" type="number" value={payload.areaM2 || ''} onChange={(event) => set('areaM2', event.target.value)} />;
  if (fixType === 'SET_APARTMENT_STATUS') return <SelectField label="Status apartament" value={payload.status || 'OCCUPIED'} onChange={(value) => set('status', value)} options={[{ value: 'OCCUPIED', label: 'Ocupat' }, { value: 'VACANT', label: 'Vacant' }, { value: 'UNKNOWN', label: 'Necunoscut' }]} />;
  if (fixType === 'SET_APARTMENT_STAIRCASE') {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <SelectField
          label="Scară existentă"
          value={payload.staircaseId || ''}
          onChange={(value) => set('staircaseId', value)}
          options={[{ value: '', label: 'Creează sau completează manual' }, ...(context?.staircases || []).map((item) => ({ value: item.id, label: item.label }))]}
        />
        <Input label="Nume scară nouă" value={payload.staircaseName || ''} onChange={(event) => set('staircaseName', event.target.value)} placeholder="1, A, Scara 1" />
        <Input label="Bloc" value={payload.buildingName || ''} onChange={(event) => set('buildingName', event.target.value)} placeholder="Bloc A" />
      </div>
    );
  }
  if (fixType === 'SET_APARTMENT_FLOOR') return <Input label="Etaj" type="number" value={payload.floor || ''} onChange={(event) => set('floor', event.target.value)} />;
  if (fixType === 'SET_PRIMARY_CONTACT' || fixType === 'RESOLVE_MULTIPLE_PRIMARY_CONTACTS') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="Contact principal" value={payload.residentId || ''} onChange={(value) => set('residentId', value)} options={residentOptions} />
        <SelectField label="Rol" value={payload.role || 'OWNER'} onChange={(value) => set('role', value)} options={[{ value: 'OWNER', label: 'Proprietar' }, { value: 'TENANT', label: 'Chiriaș' }, { value: 'REPRESENTATIVE', label: 'Reprezentant' }]} />
      </div>
    );
  }
  if (fixType === 'LINK_RESIDENT_TO_APARTMENT') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="Apartament" value={payload.apartmentId || (issue?.entityType === 'APARTMENT' ? issue.entityId || '' : '')} onChange={(value) => set('apartmentId', value)} options={apartmentOptions} />
        <SelectField label="Locatar" value={payload.residentId || (issue?.entityType === 'RESIDENT' ? issue.entityId || '' : '')} onChange={(value) => set('residentId', value)} options={allResidentOptions} />
        <SelectField label="Rol" value={payload.role || 'OWNER'} onChange={(value) => set('role', value)} options={[{ value: 'OWNER', label: 'Proprietar' }, { value: 'TENANT', label: 'Chiriaș' }, { value: 'REPRESENTATIVE', label: 'Reprezentant' }]} />
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={Boolean(payload.isPrimaryContact)} onChange={(event) => set('isPrimaryContact', event.target.checked)} />
          Setează ca primary contact
        </label>
      </div>
    );
  }
  if (fixType === 'SET_RESIDENT_STATUS') return <SelectField label="Status locatar" value={payload.status || 'ACTIVE'} onChange={(value) => set('status', value)} options={[{ value: 'ACTIVE', label: 'Activ' }, { value: 'INVITED', label: 'Invitat' }, { value: 'NOT_INVITED', label: 'Neinvitat' }, { value: 'INACTIVE', label: 'Inactiv' }]} />;
  if (fixType === 'SET_TARIFF_PRICE') {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Preț / sumă" type="number" value={payload.amount || ''} onChange={(event) => set('amount', event.target.value)} />
        <SelectField label="Tip contor, dacă e tarif pe consum" value={payload.meterType || ''} onChange={(value) => set('meterType', value)} options={[{ value: '', label: 'Neschimbat' }, { value: 'COLD_WATER', label: 'Apă rece' }, { value: 'HOT_WATER', label: 'Apă caldă' }, { value: 'ELECTRICITY', label: 'Electricitate' }, { value: 'GAS', label: 'Gaz' }, { value: 'HEAT', label: 'Căldură' }, { value: 'OTHER', label: 'Altul' }]} />
        <Input label="Unitate, dacă e consum" value={payload.unit || ''} onChange={(event) => set('unit', event.target.value)} placeholder="m³, kWh, Gcal" />
      </div>
    );
  }
  if (fixType === 'SET_METER_UNIT') return <Input label="Unitate" value={payload.unit || ''} onChange={(event) => set('unit', event.target.value)} placeholder="m³, kWh, Gcal" />;
  if (fixType === 'SET_METER_NUMBER') return <Input label="Număr contor" value={payload.meterNumber || ''} onChange={(event) => set('meterNumber', event.target.value)} />;
  if (fixType === 'SET_METER_STATUS') return <SelectField label="Status contor" value={payload.status || 'INACTIVE'} onChange={(value) => set('status', value)} options={[{ value: 'ACTIVE', label: 'Activ' }, { value: 'INACTIVE', label: 'Inactiv' }, { value: 'REPLACED', label: 'Înlocuit' }, { value: 'ARCHIVED', label: 'Arhivat' }]} />;
  if (fixType === 'MARK_READING_NEEDS_REVIEW') return <Input label="Comentariu admin" value={payload.adminComment || ''} onChange={(event) => set('adminComment', event.target.value)} />;
  if (fixType === 'REJECT_METER_READING') return <Input label="Motiv respingere" value={payload.rejectionReason || ''} onChange={(event) => set('rejectionReason', event.target.value)} />;
  if (fixType === 'START_BILLING_RUN' || fixType === 'RUN_DATA_QUALITY') return <Input label="Luna" type="month" value={payload.billingMonth || currentMonth()} onChange={(event) => set('billingMonth', event.target.value)} />;
  if (fixType === 'MARK_ISSUE_IGNORED') return <Input label="Motiv ignorare" value={payload.reason || ''} onChange={(event) => set('reason', event.target.value)} />;
  if (fixType === 'MARK_ISSUE_RESOLVED') return <Input label="Notă rezolvare" value={payload.note || ''} onChange={(event) => set('note', event.target.value)} />;
  return <p className="text-sm text-muted-foreground">Această problemă necesită remediere manuală din pagina entității.</p>;
}

export function AdminDataQualityIssueFixPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const id = String(params?.id || '');
  const [issue, setIssue] = useState<FixIssue | null>(null);
  const [options, setOptions] = useState<FixOption[]>([]);
  const [context, setContext] = useState<FixContext>({});
  const [fixType, setFixType] = useState('');
  const [payload, setPayload] = useState<Record<string, any>>({});
  const [preview, setPreview] = useState<FixPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dataQualityApi.fixOptions(id);
      const data = unwrap<any>(res);
      const nextIssue = data.issue || null;
      const nextOptions = data.options || [];
      const nextContext = data.context || {};
      const selected = nextOptions.find(isActionable) || nextOptions[0];
      setIssue(nextIssue);
      setOptions(nextOptions);
      setContext(nextContext);
      setFixType(selected?.type || '');
      setPayload(defaultPayload(selected?.type || '', nextIssue, nextContext));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca remedierea.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function changeFixType(value: string) {
    setFixType(value);
    setPayload(defaultPayload(value, issue, context));
    setPreview(null);
    setResult(null);
    setConfirm(false);
  }

  async function buildPreview() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await dataQualityApi.previewFix(id, { fixType, payload: normalizedPayload(payload) });
      setPreview(unwrap<FixPreview>(res));
      setConfirm(false);
    } catch (err: any) {
      setPreview(null);
      setError(String(err?.message || 'Nu am putut genera preview-ul.'));
    } finally {
      setBusy(false);
    }
  }

  async function applyFix() {
    setBusy(true);
    setError('');
    try {
      const res = await dataQualityApi.applyFix(id, { fixType, payload: normalizedPayload(payload), confirm: true });
      setResult(unwrap<any>(res));
      setPreview(null);
      setConfirm(false);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut aplica remedierea.'));
    } finally {
      setBusy(false);
    }
  }

  const optionItems = useMemo(() => options.map((option) => ({ value: option.type, label: option.label || fixLabels[option.type] || option.type })), [options]);

  return (
    <div className="space-y-6 pb-8">
      <Link href={localizedPath('/admin/data-quality/fixes')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la remedieri
      </Link>
      <PageHeader
        title="Aplică remediere"
        description="Verifică exact ce se schimbă înainte de a aplica quick fix-ul."
        rightSlot={issue?.actionUrl ? <ButtonLink href={localizeAction(localizedPath, issue.actionUrl)} variant="secondary">Deschide entitatea</ButtonLink> : null}
      />
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {loading ? <Card className="h-32 animate-pulse bg-muted/30" /> : null}
      {issue ? (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant={severityVariant[issue.severity]}>{severityLabel[issue.severity]}</Badge>
              <Badge variant="neutral">{issue.categoryLabel || issue.category}</Badge>
              <Badge variant={issue.billingImpact === 'BLOCKS_BILLING' ? 'error' : issue.billingImpact === 'AFFECTS_BILLING' ? 'warning' : 'neutral'}>
                {impactLabel[issue.billingImpact]}
              </Badge>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-foreground">{issue.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
            <p className="mt-3 text-sm font-medium text-foreground">{issue.recommendation}</p>
          </Card>

          <Card className="space-y-4 p-5">
            <SelectField label="Remediere" value={fixType} onChange={changeFixType} options={optionItems} />
            <FixPayloadForm fixType={fixType} payload={payload} setPayload={setPayload} context={context} issue={issue} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={buildPreview} disabled={busy || !fixType}>Generează preview</Button>
              <ButtonLink href={localizedPath(`/admin/data-quality/issues/${issue.id}`)} variant="secondary">Detalii problemă</ButtonLink>
            </div>
          </Card>

          {preview ? (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Preview modificări</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{preview.impact.message}</p>
                </div>
                <Badge variant={preview.fix.canApply ? 'success' : 'error'}>{preview.fix.canApply ? 'Se poate aplica' : 'Blocat'}</Badge>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Câmp</TableHeaderCell>
                      <TableHeaderCell>Valoare actuală</TableHeaderCell>
                      <TableHeaderCell>Valoare nouă</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.changes.map((change) => (
                      <TableRow key={change.field}>
                        <TableCell>{change.field}</TableCell>
                        <TableCell>{valueLabel(change.currentValue)}</TableCell>
                        <TableCell>{valueLabel(change.newValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.warnings.length ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}
              <label className="mt-4 flex gap-2 text-sm text-foreground">
                <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
                Am verificat modificarea și confirm aplicarea remedierii.
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={applyFix} disabled={busy || !confirm || !preview.fix.canApply}>Aplică remedierea</Button>
                <Button variant="secondary" onClick={() => setPreview(null)}>Renunță</Button>
              </div>
            </Card>
          ) : null}

          {result ? (
            <Card className="border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div>
                  <h2 className="font-semibold text-emerald-950">Remedierea a fost aplicată</h2>
                  <p className="mt-1 text-sm text-emerald-800">{result.fix?.message || 'Datele au fost actualizate.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ButtonLink href={localizedPath('/admin/data-quality')} size="sm">Rulează verificările</ButtonLink>
                    <ButtonLink href={localizedPath('/admin/data-quality/fixes')} variant="secondary" size="sm">Înapoi la remedieri</ButtonLink>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function AdminDataQualityBulkFixesPage() {
  const localizedPath = useLocalizedPath();
  const [items, setItems] = useState<FixIssue[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [fixType, setFixType] = useState('SET_METER_UNIT');
  const [payload, setPayload] = useState<Record<string, any>>({});
  const [preview, setPreview] = useState<any>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dataQualityApi.fixes({ limit: 100 });
      setItems(unwrap<any>(res).items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((old) => old.includes(id) ? old.filter((item) => item !== id) : [...old, id]);
    setPreview(null);
    setResult(null);
  }

  async function buildPreview() {
    setBusy(true);
    setError('');
    try {
      const res = await dataQualityApi.previewBulkFix({ fixType, issueIds: selected, payload: normalizedPayload(payload) });
      setPreview(unwrap<any>(res));
      setConfirm(false);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera preview-ul bulk.'));
    } finally {
      setBusy(false);
    }
  }

  async function applyBulk() {
    setBusy(true);
    setError('');
    try {
      const res = await dataQualityApi.applyBulkFix({ fixType, issueIds: selected, payload: normalizedPayload(payload), confirm: true });
      setResult(unwrap<any>(res));
      setPreview(null);
      setConfirm(false);
      setSelected([]);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut aplica remedierea bulk.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Remedieri bulk"
        description="Aplică doar remedieri foarte sigure, cu preview și confirmare."
        rightSlot={<ButtonLink href={localizedPath('/admin/data-quality/fixes')} variant="secondary"><ArrowLeft className="h-4 w-4" /> Remedieri rapide</ButtonLink>}
      />
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <SelectField label="Acțiune bulk" value={fixType} onChange={(value) => { setFixType(value); setPayload({}); setPreview(null); }} options={[
          { value: 'SET_METER_UNIT', label: 'Completează unități contoare' },
          { value: 'MARK_ISSUE_RESOLVED', label: 'Marchează rezolvat manual' },
          { value: 'MARK_ISSUE_IGNORED', label: 'Ignoră cu motiv' },
          { value: 'RUN_DATA_QUALITY', label: 'Rulează verificări' },
        ]} />
        {fixType === 'MARK_ISSUE_IGNORED' ? <Input label="Motiv" value={payload.reason || ''} onChange={(event) => setPayload({ ...payload, reason: event.target.value })} /> : null}
        {fixType === 'MARK_ISSUE_RESOLVED' ? <Input label="Notă" value={payload.note || ''} onChange={(event) => setPayload({ ...payload, note: event.target.value })} /> : null}
        {fixType === 'RUN_DATA_QUALITY' ? <Input label="Luna" type="month" value={payload.billingMonth || currentMonth()} onChange={(event) => setPayload({ ...payload, billingMonth: event.target.value })} /> : null}
        <div className="flex items-end">
          <Button onClick={buildPreview} disabled={busy || !selected.length} className="w-full">Preview bulk</Button>
        </div>
      </Card>
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      <TableWrapper>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Selectează</TableHeaderCell>
              <TableHeaderCell>Problemă</TableHeaderCell>
              <TableHeaderCell>Severitate</TableHeaderCell>
              <TableHeaderCell>Quick fixes</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && !items.length ? <TableEmpty colSpan={4}>Nu există remedieri disponibile.</TableEmpty> : null}
            {items.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell><input type="checkbox" checked={selected.includes(issue.id)} onChange={() => toggle(issue.id)} /></TableCell>
                <TableCell>
                  <p className="font-semibold text-foreground">{issue.title}</p>
                  <p className="text-xs text-muted-foreground">{issue.description}</p>
                </TableCell>
                <TableCell><Badge variant={severityVariant[issue.severity]}>{severityLabel[issue.severity]}</Badge></TableCell>
                <TableCell>{(issue.availableFixes || []).map((fix) => fix.label).join(', ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
      {preview ? (
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Preview bulk</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Selectate: {preview.totalSelected}, pregătite: {preview.previewed}, erori: {preview.errorsCount}
          </p>
          {preview.errors?.length ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {preview.errors.map((item: any) => <p key={item.issueId}>{item.message}</p>)}
            </div>
          ) : null}
          <label className="mt-4 flex gap-2 text-sm text-foreground">
            <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
            Am verificat modificările și confirm aplicarea remedierii bulk.
          </label>
          <div className="mt-4 flex gap-2">
            <Button onClick={applyBulk} disabled={busy || !confirm || !preview.canApply}>Aplică bulk</Button>
            <Button variant="secondary" onClick={() => setPreview(null)}>Renunță</Button>
          </div>
        </Card>
      ) : null}
      {result ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Remedierea bulk a fost aplicată pentru {result.appliedCount || 0} probleme.
        </Card>
      ) : null}
      <Card className="p-4 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <CircleAlert className="mt-0.5 h-4 w-4" />
          Bulk fixes nu aprobă indici, nu modifică facturi/plăți și nu șterg date. Pentru probleme riscante, folosește pagina dedicată a entității.
        </div>
      </Card>
    </div>
  );
}
