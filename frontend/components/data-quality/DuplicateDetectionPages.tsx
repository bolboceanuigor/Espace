'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  GitMerge,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
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
import { dataQualityDuplicatesApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type DuplicateEntityType = 'RESIDENT' | 'APARTMENT' | 'METER' | 'TARIFF';
type DuplicateGroupStatus = 'OPEN' | 'REVIEWED' | 'MERGED' | 'IGNORED' | 'NOT_DUPLICATE';
type DuplicateConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

type DuplicateCandidate = {
  id: string;
  entityId: string;
  entityType: DuplicateEntityType;
  displayName: string;
  matchReason?: string | null;
  matchScore: number;
  snapshot?: Record<string, unknown>;
  isCanonical?: boolean;
};

type DuplicateGroup = {
  id: string;
  entityType: DuplicateEntityType;
  status: DuplicateGroupStatus;
  confidence: DuplicateConfidence;
  reason: string;
  score: number;
  candidatesCount?: number;
  canonicalEntityId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  mergedAt?: string | null;
  ignoredAt?: string | null;
  candidates?: DuplicateCandidate[];
  availableActions?: {
    canMerge: boolean;
    canMarkNotDuplicate: boolean;
    canIgnore: boolean;
  };
  warnings?: string[];
};

type DuplicateOverview = {
  association: { id: string; shortName: string; associationCode?: string | null };
  summary: {
    openGroups: number;
    residentGroups: number;
    apartmentGroups: number;
    meterGroups: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    reviewedGroups: number;
    mergedGroups: number;
    ignoredGroups: number;
    lastScanAt?: string | null;
  };
  topGroups: DuplicateGroup[];
};

type GroupsResponse = {
  items: DuplicateGroup[];
  meta?: { page: number; limit: number; total: number };
  summary?: DuplicateOverview['summary'];
};

type MergePreview = {
  canApply: boolean;
  mergePlanId?: string;
  warnings?: string[];
  conflicts?: unknown[];
  changes?: Array<Record<string, unknown>>;
  affectedRecords?: Record<string, number>;
};

const entityLabel: Record<DuplicateEntityType, string> = {
  RESIDENT: 'Locatari',
  APARTMENT: 'Apartamente',
  METER: 'Contoare',
  TARIFF: 'Tarife',
};

const entityPath: Record<DuplicateEntityType, string> = {
  RESIDENT: '/admin/data-quality/duplicates/residents',
  APARTMENT: '/admin/data-quality/duplicates/apartments',
  METER: '/admin/data-quality/duplicates/meters',
  TARIFF: '/admin/data-quality/duplicates',
};

const confidenceLabel: Record<DuplicateConfidence, string> = {
  HIGH: 'Încredere mare',
  MEDIUM: 'Încredere medie',
  LOW: 'Încredere mică',
};

const confidenceVariant: Record<DuplicateConfidence, 'success' | 'warning' | 'neutral'> = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

const statusLabel: Record<DuplicateGroupStatus, string> = {
  OPEN: 'Deschis',
  REVIEWED: 'Revizuit',
  MERGED: 'Merge aplicat',
  IGNORED: 'Ignorat',
  NOT_DUPLICATE: 'Nu sunt duplicate',
};

const statusVariant: Record<DuplicateGroupStatus, 'success' | 'warning' | 'neutral'> = {
  OPEN: 'warning',
  REVIEWED: 'neutral',
  MERGED: 'success',
  IGNORED: 'neutral',
  NOT_DUPLICATE: 'success',
};

function unwrap<T>(res: any): T {
  return res?.data || res;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function compact(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function entityDetailPath(group: DuplicateGroup, entityId: string) {
  if (group.entityType === 'RESIDENT') return `/admin/residents/${entityId}`;
  if (group.entityType === 'APARTMENT') return `/admin/apartments/${entityId}`;
  if (group.entityType === 'METER') return `/admin/meters/${entityId}`;
  return '/admin/data-quality/duplicates';
}

function titleFor(entityType?: DuplicateEntityType) {
  if (entityType === 'RESIDENT') return 'Locatari duplicați';
  if (entityType === 'APARTMENT') return 'Apartamente duplicate';
  if (entityType === 'METER') return 'Contoare duplicate';
  return 'Duplicate detectate';
}

function descriptionFor(entityType?: DuplicateEntityType) {
  if (entityType === 'RESIDENT') return 'Verifică persoane cu email, telefon sau apartamente similare.';
  if (entityType === 'APARTMENT') return 'Verifică apartamente cu numere sau date cadastrale similare. Merge automat este blocat în MVP.';
  if (entityType === 'METER') return 'Verifică contoare cu număr, tip, apartament sau locație similară.';
  return 'Verifică posibile duplicate și aplică remedieri sigure, fără ștergere automată.';
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
    <label className="grid gap-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function AdminDuplicateGroupsPage({ entityType }: { entityType?: DuplicateEntityType }) {
  const localizedPath = useLocalizedPath();
  const [overview, setOverview] = useState<DuplicateOverview | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: 'OPEN', confidence: '', search: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        entityType,
        status: filters.status || undefined,
        confidence: filters.confidence || undefined,
        search: filters.search || undefined,
        limit: 100,
      };
      const [overviewRes, groupsRes] = await Promise.all([
        dataQualityDuplicatesApi.overview(entityType ? { entityType } : undefined),
        dataQualityDuplicatesApi.groups(params),
      ]);
      setOverview(unwrap<DuplicateOverview>(overviewRes));
      setGroups(unwrap<GroupsResponse>(groupsRes).items || []);
    } catch (err: any) {
      setOverview(null);
      setGroups([]);
      setError(String(err?.message || 'Nu am putut încărca duplicatele.'));
    } finally {
      setLoading(false);
    }
  }, [entityType, filters.confidence, filters.search, filters.status]);

  useEffect(() => {
    load();
  }, [load]);

  async function runScan() {
    setBusy(true);
    setError('');
    try {
      await dataQualityDuplicatesApi.scan(entityType ? { entityTypes: [entityType] } : undefined);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut rula detectarea de duplicate.'));
    } finally {
      setBusy(false);
    }
  }

  async function updateGroupStatus(group: DuplicateGroup, action: 'reviewed' | 'notDuplicate' | 'ignore' | 'reopen') {
    const reason =
      action === 'reopen'
        ? ''
        : window.prompt(action === 'ignore' ? 'Motiv ignorare' : action === 'reviewed' ? 'Notă revizuire' : 'De ce nu sunt duplicate?', '') || '';
    if (action !== 'reopen' && action !== 'reviewed' && !reason.trim()) return;
    setBusy(true);
    try {
      if (action === 'reviewed') await dataQualityDuplicatesApi.markReviewed(group.id, reason || 'Revizuit manual.');
      if (action === 'notDuplicate') await dataQualityDuplicatesApi.markNotDuplicate(group.id, reason);
      if (action === 'ignore') await dataQualityDuplicatesApi.ignore(group.id, reason);
      if (action === 'reopen') await dataQualityDuplicatesApi.reopen(group.id);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut actualiza grupul.'));
    } finally {
      setBusy(false);
    }
  }

  const summary = overview?.summary;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={titleFor(entityType)}
        description={descriptionFor(entityType)}
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button onClick={runScan} isLoading={busy}>
              <RefreshCw className="h-4 w-4" /> Rulează detectare duplicate
            </Button>
            <ButtonLink href="/admin/data-quality/duplicates/residents" variant="secondary">Locatari</ButtonLink>
            <ButtonLink href="/admin/data-quality/duplicates/apartments" variant="secondary">Apartamente</ButtonLink>
            <ButtonLink href="/admin/data-quality/duplicates/meters" variant="secondary">Contoare</ButtonLink>
            <ButtonLink href="/admin/data-quality" variant="secondary">Calitatea datelor</ButtonLink>
          </div>
        }
      />

      <Card className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{overview?.association?.shortName || 'APC'}</Badge>
          <Badge variant="neutral">{overview?.association?.associationCode || 'Cod APC'}</Badge>
          <Badge variant="neutral">Ultima scanare: {formatDateTime(summary?.lastScanAt)}</Badge>
          {entityType === 'APARTMENT' ? <Badge variant="warning">Merge automat apartamente indisponibil</Badge> : null}
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Actualizează
        </Button>
      </Card>

      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</Card> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Grupuri deschise" value={String(summary?.openGroups || 0)} tone={summary?.openGroups ? 'warning' : 'success'} icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="Locatari posibili" value={String(summary?.residentGroups || 0)} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Apartamente posibile" value={String(summary?.apartmentGroups || 0)} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label="Contoare posibile" value={String(summary?.meterGroups || 0)} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label="Încredere mare" value={String(summary?.highConfidence || 0)} tone={summary?.highConfidence ? 'warning' : 'success'} />
        <StatCard label="Revizuite" value={String(summary?.reviewedGroups || 0)} />
        <StatCard label="Ignorate" value={String(summary?.ignoredGroups || 0)} />
        <StatCard label="Merge-uri aplicate" value={String(summary?.mergedGroups || 0)} tone="success" icon={<GitMerge className="h-5 w-5" />} />
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
        <Input
          label="Caută"
          placeholder="Nume, număr, motiv"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
        <SelectField
          label="Status"
          value={filters.status}
          onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          options={[
            { value: '', label: 'Toate' },
            { value: 'OPEN', label: 'Deschise' },
            { value: 'REVIEWED', label: 'Revizuite' },
            { value: 'MERGED', label: 'Merge aplicat' },
            { value: 'IGNORED', label: 'Ignorate' },
            { value: 'NOT_DUPLICATE', label: 'Nu sunt duplicate' },
          ]}
        />
        <SelectField
          label="Încredere"
          value={filters.confidence}
          onChange={(value) => setFilters((current) => ({ ...current, confidence: value }))}
          options={[
            { value: '', label: 'Toate' },
            { value: 'HIGH', label: 'Mare' },
            { value: 'MEDIUM', label: 'Medie' },
            { value: 'LOW', label: 'Mică' },
          ]}
        />
        <Button variant="secondary" onClick={load}>Filtrează</Button>
      </Card>

      {loading ? <LoadingCards /> : null}

      {!loading && !groups.length ? (
        <EmptyState
          title={entityType ? `Nu există ${entityLabel[entityType].toLowerCase()} duplicați detectați` : 'Nu au fost detectate duplicate'}
          description="Datele par curate. Poți rula scanarea din nou după importuri sau modificări majore."
          actionLabel="Rulează detectare duplicate"
          onAction={runScan}
        />
      ) : null}

      {!loading && groups.length ? (
        <TableWrapper>
          <Table>
            <TableHead>
              <TableRow hover={false}>
                <TableHeaderCell>Tip entitate</TableHeaderCell>
                <TableHeaderCell>Motiv</TableHeaderCell>
                <TableHeaderCell>Încredere</TableHeaderCell>
                <TableHeaderCell>Candidați</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Creat la</TableHeaderCell>
                <TableHeaderCell>Acțiuni</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <Link href={localizedPath(entityPath[group.entityType])} className="font-semibold text-foreground hover:underline">
                      {entityLabel[group.entityType]}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{group.reason}</p>
                    <p className="text-xs text-muted-foreground">Scor {group.score}</p>
                  </TableCell>
                  <TableCell><Badge variant={confidenceVariant[group.confidence]}>{confidenceLabel[group.confidence]}</Badge></TableCell>
                  <TableCell>{group.candidatesCount || group.candidates?.length || 0}</TableCell>
                  <TableCell><Badge variant={statusVariant[group.status]}>{statusLabel[group.status]}</Badge></TableCell>
                  <TableCell>{formatDateTime(group.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink href={`/admin/data-quality/duplicates/groups/${group.id}`} size="sm">Deschide</ButtonLink>
                      {group.entityType !== 'APARTMENT' && group.status !== 'MERGED' ? (
                        <ButtonLink href={`/admin/data-quality/duplicates/groups/${group.id}/merge`} size="sm" variant="secondary">Merge asistat</ButtonLink>
                      ) : null}
                      {group.status === 'OPEN' || group.status === 'REVIEWED' ? (
                        <>
                          {group.status === 'OPEN' ? <Button size="sm" variant="secondary" onClick={() => updateGroupStatus(group, 'reviewed')} disabled={busy}>Revizuit</Button> : null}
                          <Button size="sm" variant="secondary" onClick={() => updateGroupStatus(group, 'notDuplicate')} disabled={busy}>Nu sunt duplicate</Button>
                          <Button size="sm" variant="ghost" onClick={() => updateGroupStatus(group, 'ignore')} disabled={busy}>Ignoră</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => updateGroupStatus(group, 'reopen')} disabled={busy}>Redeschide</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      ) : null}
    </div>
  );
}

export function AdminDuplicateGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const [detail, setDetail] = useState<{ group: DuplicateGroup; candidates: DuplicateCandidate[]; availableActions: DuplicateGroup['availableActions']; warnings: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setDetail(unwrap(await dataQualityDuplicatesApi.getGroup(id)));
    } catch (err: any) {
      setDetail(null);
      setError(String(err?.message || 'Nu am putut încărca grupul.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function statusAction(action: 'reviewed' | 'notDuplicate' | 'ignore' | 'reopen') {
    if (!id) return;
    const reason =
      action === 'reopen'
        ? ''
        : window.prompt(action === 'ignore' ? 'Motiv ignorare' : action === 'reviewed' ? 'Notă revizuire' : 'De ce nu sunt duplicate?', '') || '';
    if (action !== 'reopen' && action !== 'reviewed' && !reason.trim()) return;
    setBusy(true);
    try {
      if (action === 'reviewed') await dataQualityDuplicatesApi.markReviewed(id, reason || 'Revizuit manual.');
      if (action === 'notDuplicate') await dataQualityDuplicatesApi.markNotDuplicate(id, reason);
      if (action === 'ignore') await dataQualityDuplicatesApi.ignore(id, reason);
      if (action === 'reopen') await dataQualityDuplicatesApi.reopen(id);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut actualiza grupul.'));
    } finally {
      setBusy(false);
    }
  }

  const group = detail?.group;
  const candidates = detail?.candidates || [];
  const canMerge = Boolean(group && detail?.availableActions?.canMerge && group.entityType !== 'APARTMENT' && ['OPEN', 'REVIEWED'].includes(group.status));

  return (
    <div className="space-y-6 pb-8">
      <Link href={localizedPath('/admin/data-quality/duplicates')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la duplicate
      </Link>
      <PageHeader
        title={group ? `${entityLabel[group.entityType]} · ${group.reason}` : 'Detalii grup duplicate'}
        description="Compară candidații side-by-side înainte de a decide dacă aplici merge, ignori sau marchezi ca revizuit."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            {canMerge ? <ButtonLink href={`/admin/data-quality/duplicates/groups/${id}/merge`}>Merge asistat</ButtonLink> : null}
            {group?.status === 'OPEN' || group?.status === 'REVIEWED' ? (
              <>
                {group.status === 'OPEN' ? <Button variant="secondary" onClick={() => statusAction('reviewed')} disabled={busy}>Marchează revizuit</Button> : null}
                <Button variant="secondary" onClick={() => statusAction('notDuplicate')} disabled={busy}>Nu sunt duplicate</Button>
                <Button variant="ghost" onClick={() => statusAction('ignore')} disabled={busy}>Ignoră</Button>
              </>
            ) : group ? (
              <Button variant="secondary" onClick={() => statusAction('reopen')} disabled={busy}>Redeschide</Button>
            ) : null}
          </div>
        }
      />

      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</Card> : null}
      {loading ? <LoadingCards /> : null}

      {group ? (
        <>
          <Card className="flex flex-wrap items-center gap-2 p-4">
            <Badge variant={confidenceVariant[group.confidence]}>{confidenceLabel[group.confidence]}</Badge>
            <Badge variant={statusVariant[group.status]}>{statusLabel[group.status]}</Badge>
            <Badge variant="neutral">Scor {group.score}</Badge>
            <Badge variant="neutral">{candidates.length} candidați</Badge>
            {group.entityType === 'APARTMENT' ? <Badge variant="warning">Merge automat blocat</Badge> : null}
          </Card>

          {detail?.warnings?.length ? (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Avertizări</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {detail.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </Card>
          ) : null}

          {group.entityType === 'APARTMENT' ? (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Apartamentele nu sunt unite automat în MVP. Pot avea facturi, plăți, contoare și solduri, deci folosește comparația pentru verificare manuală.
            </Card>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-2">
            {candidates.map((candidate) => (
              <Card key={candidate.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{candidate.displayName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{candidate.matchReason || 'Potrivire detectată'} · scor {candidate.matchScore}</p>
                  </div>
                  <ButtonLink href={entityDetailPath(group, candidate.entityId)} variant="secondary" size="sm">Deschide</ButtonLink>
                </div>
                <SnapshotTable snapshot={candidate.snapshot || {}} />
              </Card>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}

export function AdminDuplicateMergePage() {
  const { id } = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const [detail, setDetail] = useState<{ group: DuplicateGroup; candidates: DuplicateCandidate[]; warnings: string[] } | null>(null);
  const [canonicalEntityId, setCanonicalEntityId] = useState('');
  const [residentSelections, setResidentSelections] = useState<Record<string, string>>({});
  const [meterFields, setMeterFields] = useState({ meterNumber: '', unit: '', status: 'ACTIVE' });
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const payload = unwrap<{ group: DuplicateGroup; candidates: DuplicateCandidate[]; warnings: string[] }>(await dataQualityDuplicatesApi.getGroup(id));
      setDetail(payload);
      const firstCandidate = payload.candidates[0];
      if (firstCandidate) {
        setCanonicalEntityId((current) => current || firstCandidate.entityId);
        setResidentSelections({
          fullName: firstCandidate.entityId,
          phone: firstCandidate.entityId,
          email: firstCandidate.entityId,
          status: firstCandidate.entityId,
        });
        setMeterFields({
          meterNumber: String(firstCandidate.snapshot?.meterNumber || ''),
          unit: String(firstCandidate.snapshot?.unit || ''),
          status: String(firstCandidate.snapshot?.status || 'ACTIVE'),
        });
      }
    } catch (err: any) {
      setDetail(null);
      setError(String(err?.message || 'Nu am putut încărca grupul.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const group = detail?.group;
  const candidates = useMemo(() => detail?.candidates || [], [detail]);
  const candidateOptions = useMemo(() => candidates.map((candidate) => ({ value: candidate.entityId, label: candidate.displayName })), [candidates]);

  async function buildPreview() {
    if (!id || !group || !canonicalEntityId) return;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const body: Record<string, unknown> = { canonicalEntityId };
      if (group.entityType === 'RESIDENT') body.fieldSelections = residentSelections;
      if (group.entityType === 'METER') body.fieldSelections = meterFields;
      setPreview(unwrap<MergePreview>(await dataQualityDuplicatesApi.mergePreview(id, body)));
      setConfirmed(false);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera preview-ul de merge.'));
    } finally {
      setBusy(false);
    }
  }

  async function applyMerge() {
    if (!id || !preview?.mergePlanId) return;
    setBusy(true);
    setError('');
    try {
      await dataQualityDuplicatesApi.mergeApply(id, { mergePlanId: preview.mergePlanId, confirm: true });
      window.location.href = localizedPath(`/admin/data-quality/duplicates/groups/${id}`);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut aplica merge-ul.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <Link href={localizedPath(`/admin/data-quality/duplicates/groups/${id}`)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la grup
      </Link>
      <PageHeader
        title="Merge asistat"
        description="Alege entitatea canonică, verifică preview-ul și confirmă doar modificările sigure."
        rightSlot={<ButtonLink href="/admin/data-quality/duplicates" variant="secondary">Duplicate</ButtonLink>}
      />

      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</Card> : null}
      {loading ? <LoadingCards /> : null}

      {group?.entityType === 'APARTMENT' ? (
        <div className="text-center">
          <EmptyState
            title="Merge automat indisponibil"
            description="Apartamentele pot avea facturi, plăți și solduri. Deschide entitățile și aplică modificările manual din paginile dedicate."
          />
          <div className="mt-4">
            <ButtonLink href={`/admin/data-quality/duplicates/groups/${id}`} variant="secondary">Deschide grupul</ButtonLink>
          </div>
        </div>
      ) : null}

      {group && group.entityType !== 'APARTMENT' ? (
        <>
          <Card className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <SelectField
                label="Entitatea canonică"
                value={canonicalEntityId}
                onChange={setCanonicalEntityId}
                options={candidateOptions}
              />
              <p className="text-sm text-muted-foreground">
                Entitatea canonică rămâne activă. Candidatele duplicate sunt păstrate, marcate sigur și nu sunt șterse fizic.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="text-sm font-semibold text-foreground">{entityLabel[group.entityType]}</p>
              <p className="mt-1 text-sm text-muted-foreground">{group.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={confidenceVariant[group.confidence]}>{confidenceLabel[group.confidence]}</Badge>
                <Badge variant={statusVariant[group.status]}>{statusLabel[group.status]}</Badge>
              </div>
            </div>
          </Card>

          {group.entityType === 'RESIDENT' ? (
            <Card className="grid gap-3 p-5 md:grid-cols-2">
              <SelectField label="Nume final" value={residentSelections.fullName || canonicalEntityId} onChange={(value) => setResidentSelections((current) => ({ ...current, fullName: value }))} options={candidateOptions} />
              <SelectField label="Telefon final" value={residentSelections.phone || canonicalEntityId} onChange={(value) => setResidentSelections((current) => ({ ...current, phone: value }))} options={candidateOptions} />
              <SelectField label="Email final" value={residentSelections.email || canonicalEntityId} onChange={(value) => setResidentSelections((current) => ({ ...current, email: value }))} options={candidateOptions} />
              <SelectField label="Status final" value={residentSelections.status || canonicalEntityId} onChange={(value) => setResidentSelections((current) => ({ ...current, status: value }))} options={candidateOptions} />
            </Card>
          ) : null}

          {group.entityType === 'METER' ? (
            <Card className="grid gap-3 p-5 md:grid-cols-3">
              <Input label="Număr contor final" value={meterFields.meterNumber} onChange={(event) => setMeterFields((current) => ({ ...current, meterNumber: event.target.value }))} />
              <Input label="Unitate finală" value={meterFields.unit} onChange={(event) => setMeterFields((current) => ({ ...current, unit: event.target.value }))} />
              <SelectField
                label="Status final"
                value={meterFields.status}
                onChange={(value) => setMeterFields((current) => ({ ...current, status: value }))}
                options={[
                  { value: 'ACTIVE', label: 'Activ' },
                  { value: 'INACTIVE', label: 'Inactiv' },
                  { value: 'REPLACED', label: 'Înlocuit' },
                  { value: 'ARCHIVED', label: 'Arhivat' },
                ]}
              />
            </Card>
          ) : null}

          <Card className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Preview obligatoriu</p>
              <p className="mt-1 text-sm text-muted-foreground">Merge-ul nu poate fi aplicat fără plan generat și confirmare explicită.</p>
            </div>
            <Button onClick={buildPreview} isLoading={busy}>Generează preview</Button>
          </Card>

          {preview ? (
            <MergePreviewCard preview={preview} confirmed={confirmed} onConfirmedChange={setConfirmed} onApply={applyMerge} busy={busy} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MergePreviewCard({
  preview,
  confirmed,
  onConfirmedChange,
  onApply,
  busy,
}: {
  preview: MergePreview;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  onApply: () => void;
  busy: boolean;
}) {
  const changes = preview.changes || [];
  const conflicts = preview.conflicts || [];
  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={preview.canApply ? 'success' : 'error'}>{preview.canApply ? 'Poate fi aplicat' : 'Blocat'}</Badge>
        <Badge variant="neutral">{changes.length} modificări</Badge>
        <Badge variant={conflicts.length ? 'error' : 'success'}>{conflicts.length} conflicte</Badge>
      </div>
      {preview.warnings?.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Avertizări</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
      {conflicts.length ? <JsonPanel title="Conflicte" value={conflicts} /> : null}
      <JsonPanel title="Înregistrări afectate" value={preview.affectedRecords || {}} />
      <TableWrapper>
        <Table>
          <TableHead>
            <TableRow hover={false}>
              <TableHeaderCell>Tip</TableHeaderCell>
              <TableHeaderCell>Câmp/Relație</TableHeaderCell>
              <TableHeaderCell>Valoare veche</TableHeaderCell>
              <TableHeaderCell>Valoare nouă</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {changes.length ? changes.slice(0, 80).map((change, index) => (
              <TableRow key={`${change.type}-${index}`}>
                <TableCell>{compact(change.type)}</TableCell>
                <TableCell>{compact(change.field || change.relation || change.readingId)}</TableCell>
                <TableCell>{compact(change.oldValue || change.fromEntityId)}</TableCell>
                <TableCell>{compact(change.newValue || change.toEntityId)}</TableCell>
              </TableRow>
            )) : <TableEmpty colSpan={4}>Nu există modificări în preview.</TableEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      <label className="flex items-start gap-2 rounded-2xl border border-border/70 p-4 text-sm text-foreground">
        <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} />
        <span>Am verificat modificările, conflictele și confirm aplicarea merge-ului fără ștergere fizică.</span>
      </label>
      <Button onClick={onApply} disabled={!preview.canApply || !confirmed || !preview.mergePlanId} isLoading={busy}>
        Aplică merge-ul
      </Button>
    </Card>
  );
}

function SnapshotTable({ snapshot }: { snapshot: Record<string, unknown> }) {
  const entries = Object.entries(snapshot).filter(([key]) => !['password', 'token', 'jwt', 'secret'].some((sensitive) => key.toLowerCase().includes(sensitive)));
  return (
    <dl className="mt-4 grid gap-2 text-sm">
      {entries.length ? entries.map(([key, value]) => (
        <div key={key} className="grid gap-1 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-[150px_1fr]">
          <dt className="font-medium text-muted-foreground">{key}</dt>
          <dd className="break-words text-foreground">{compact(value)}</dd>
        </div>
      )) : <p className="text-sm text-muted-foreground">Nu există snapshot disponibil.</p>}
    </dl>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      <pre className="max-h-72 overflow-auto rounded-2xl border border-border/70 bg-muted/25 p-4 text-xs text-muted-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => <Card key={item} className="h-28 animate-pulse bg-muted/30" />)}
    </div>
  );
}
