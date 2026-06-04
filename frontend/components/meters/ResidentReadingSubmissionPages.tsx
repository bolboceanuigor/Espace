'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock3, Droplets, Gauge, History, RefreshCw, Search, Send, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, EmptyState, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { filesApi, metersApi } from '@/lib/api';

type AnyRecord = Record<string, any>;

const statusLabel: Record<string, string> = {
  APPROVED: 'Aprobată',
  SUBMITTED: 'Trimisă',
  NEEDS_REVIEW: 'În verificare',
  REJECTED: 'Respinsă',
  MISSING: 'Lipsă',
  CANCELLED: 'Anulată',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'default'> = {
  APPROVED: 'success',
  SUBMITTED: 'warning',
  NEEDS_REVIEW: 'warning',
  REJECTED: 'error',
  MISSING: 'neutral',
  CANCELLED: 'neutral',
};

const issueVariant: Record<string, 'warning' | 'error' | 'neutral'> = {
  CRITICAL: 'error',
  WARNING: 'warning',
};

function formatNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(number);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'medium' }).format(date);
}

function BadgeForStatus({ status }: { status?: string | null }) {
  const normalized = String(status || 'MISSING').toUpperCase();
  return <Badge variant={statusVariant[normalized] || 'neutral'}>{statusLabel[normalized] || normalized}</Badge>;
}

function periodTitle(period?: AnyRecord | null) {
  if (!period) return '—';
  return period.label || `${String(period.month).padStart(2, '0')}/${period.year}`;
}

export function ResidentMeterSubmissionPage() {
  const [periods, setPeriods] = useState<AnyRecord[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [workspace, setWorkspace] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeRow, setActiveRow] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState({ value: '', readingDate: new Date().toISOString().slice(0, 10), residentNote: '', proofFileUrl: '' });

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await metersApi.getResidentMeterReadingPeriods();
      const items = response.data?.items || response.data || [];
      setPeriods(items);
      const nextPeriod = selectedPeriodId && items.some((item: AnyRecord) => item.id === selectedPeriodId)
        ? selectedPeriodId
        : items[0]?.id || '';
      setSelectedPeriodId(nextPeriod);
    } catch (err: any) {
      setError(err?.message || 'Nu am putut încărca perioadele de citire.');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  const loadWorkspace = useCallback(async () => {
    if (!selectedPeriodId) {
      setWorkspace(null);
      return;
    }
    setError('');
    try {
      const response = await metersApi.getResidentMeterReadingWorkspace(selectedPeriodId, { limit: 200 });
      setWorkspace(response.data);
    } catch (err: any) {
      setError(err?.message || 'Nu am putut încărca contoarele pentru perioada selectată.');
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const rows = workspace?.items || [];
  const summary = workspace?.summary || {};
  const currentPeriod = periods.find((period) => period.id === selectedPeriodId) || workspace?.period || null;

  const openSubmit = (row: AnyRecord) => {
    const current = row.currentSubmittedReading || row.currentReading || {};
    setActiveRow(row);
    setSuccess('');
    setError('');
    setForm({
      value: current.readingValue !== undefined ? String(current.readingValue) : '',
      readingDate: current.readingDate ? new Date(current.readingDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      residentNote: current.residentComment || '',
      proofFileUrl: current.proofFileUrl || current.photoUrl || '',
    });
  };

  const estimatedConsumption = useMemo(() => {
    const value = Number(form.value);
    const previous = Number(activeRow?.previousReading?.readingValue);
    if (!Number.isFinite(value) || !Number.isFinite(previous)) return null;
    return value - previous;
  }, [form.value, activeRow]);

  const submitReading = async () => {
    if (!activeRow || !selectedPeriodId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await metersApi.submitResidentMeterReading(selectedPeriodId, activeRow.meter.id, {
        value: Number(form.value),
        readingDate: form.readingDate,
        residentNote: form.residentNote,
        proofFileUrl: form.proofFileUrl || null,
      });
      setSuccess('Citirea a fost trimisă spre verificare.');
      setActiveRow(null);
      await loadWorkspace();
      await loadPeriods();
    } catch (err: any) {
      setError(err?.message || 'Citirea nu a putut fi transmisă.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contoarele mele"
        description="Vezi contoarele apartamentului și transmite citirile lunare."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { loadPeriods(); loadWorkspace(); }}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <ButtonLink href="/resident/meter-readings" variant="secondary"><History className="h-4 w-4" /> Istoric</ButtonLink>
          </div>
        }
      />

      {error ? <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card> : null}
      {success ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-700">{success}</Card> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Contoare active" value={summary.totalMeters ?? 0} icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Trimise" value={summary.submittedCount ?? 0} tone="warning" icon={<Send className="h-5 w-5" />} />
        <StatCard label="Aprobate" value={summary.approvedCount ?? 0} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Respinse" value={summary.rejectedCount ?? 0} tone="danger" icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Lipsă" value={summary.missingCount ?? 0} tone="warning" icon={<Clock3 className="h-5 w-5" />} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Perioadă citiri</p>
            <p className="text-sm text-muted-foreground">{currentPeriod ? 'Alege perioada deschisă de administrație.' : 'Nu există perioadă deschisă.'}</p>
          </div>
          {periods.length ? (
            <select
              className="h-10 rounded-2xl border border-border bg-white px-3 text-sm"
              value={selectedPeriodId}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
            >
              {periods.map((period) => <option key={period.id} value={period.id}>{periodTitle(period)} · {period.status}</option>)}
            </select>
          ) : null}
        </div>
      </Card>

      {loading ? <Card>Se încarcă...</Card> : null}
      {!loading && !periods.length ? (
        <EmptyState
          title="Nu există o perioadă deschisă pentru transmiterea citirilor."
          description="Când administrația deschide perioada lunară, vei putea transmite citirile aici."
          action={<ButtonLink href="/resident/meter-readings" variant="secondary">Vezi istoricul</ButtonLink>}
        />
      ) : null}
      {!loading && periods.length && !rows.length ? (
        <EmptyState
          title="Nu există contoare configurate pentru apartamentul tău."
          description="Contactează administrația dacă apartamentul are contoare care trebuie citite."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row: AnyRecord) => (
          <Card key={row.meter.id} hoverable className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{row.meter.typeLabel || row.meter.type}</p>
                <p className="text-xs text-muted-foreground">Ap. {row.apartment?.apartmentNumber || row.apartment?.number || '—'} · {row.meter.serialNumber || 'fără serie'}</p>
              </div>
              <BadgeForStatus status={row.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Ultima citire</p>
                <p className="font-semibold">{formatNumber(row.previousReading?.readingValue)} {row.meter.unit}</p>
                <p className="text-xs text-muted-foreground">{formatDate(row.previousReadingDate)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Curentă</p>
                <p className="font-semibold">{formatNumber(row.currentSubmittedReading?.readingValue)} {row.meter.unit}</p>
                <p className="text-xs text-muted-foreground">Consum {formatNumber(row.calculatedConsumption)} {row.meter.unit}</p>
              </div>
            </div>
            {row.rejectionReason ? <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{row.rejectionReason}</p> : null}
            {row.warnings?.length ? (
              <div className="space-y-1">
                {row.warnings.slice(0, 2).map((issue: AnyRecord) => <p key={issue.type} className="text-xs text-amber-700">{issue.title}: {issue.message}</p>)}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {row.canEdit ? (
                <Button size="sm" onClick={() => openSubmit(row)}>
                  {row.status === 'REJECTED' ? 'Corectează citirea' : 'Trimite citire'}
                </Button>
              ) : null}
              {row.status === 'APPROVED' ? <Badge variant="success">Citirea nu mai poate fi modificată</Badge> : null}
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={Boolean(activeRow)} onClose={() => setActiveRow(null)} maxWidth="xl">
        <ModalHeader title="Trimite citirea" onClose={() => setActiveRow(null)} />
        <ModalBody className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p className="font-semibold">{activeRow?.meter?.typeLabel || activeRow?.meter?.type} · {activeRow?.meter?.serialNumber || 'fără serie'}</p>
            <p className="text-muted-foreground">Citire precedentă: {formatNumber(activeRow?.previousReading?.readingValue)} {activeRow?.meter?.unit}</p>
            {estimatedConsumption !== null ? (
              <p className={estimatedConsumption < 0 ? 'mt-2 text-rose-700' : estimatedConsumption === 0 ? 'mt-2 text-amber-700' : 'mt-2 text-muted-foreground'}>
                Consum estimat: {formatNumber(estimatedConsumption)} {activeRow?.meter?.unit}
              </p>
            ) : null}
          </div>
          <Input label="Valoare citire" type="number" min="0" step="0.01" value={form.value} onChange={(event) => setForm((state) => ({ ...state, value: event.target.value }))} />
          <Input label="Data citirii" type="date" value={form.readingDate} onChange={(event) => setForm((state) => ({ ...state, readingDate: event.target.value }))} />
          <Input label="Link poză dovadă" value={form.proofFileUrl} onChange={(event) => setForm((state) => ({ ...state, proofFileUrl: event.target.value }))} hint="Se acceptă doar fișiere încărcate prin Espace; altfel lasă gol." />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Notă</span>
            <textarea className="min-h-24 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={form.residentNote} onChange={(event) => setForm((state) => ({ ...state, residentNote: event.target.value }))} />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setActiveRow(null)}>Anulează</Button>
          <Button onClick={submitReading} isLoading={saving} disabled={!form.value}>Trimite spre verificare</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

export function ResidentMeterReadingsHistoryPage() {
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await metersApi.getResidentMeterReadingHistory({ limit: 100 });
      setItems(response.data?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Nu am putut încărca istoricul citirilor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Istoric citiri"
        description="Vezi citirile trimise, aprobate sau respinse."
        rightSlot={<ButtonLink href="/resident/meters" variant="secondary">Înapoi la contoare</ButtonLink>}
      />
      {error ? <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card> : null}
      {loading ? <Card>Se încarcă...</Card> : null}
      {!loading && !items.length ? (
        <EmptyState title="Nu există activitate de citiri încă." description="Citirile transmise vor apărea aici." />
      ) : null}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Perioada</th>
                <th className="px-4 py-3">Contor</th>
                <th className="px-4 py-3">Apartament</th>
                <th className="px-4 py-3">Valoare</th>
                <th className="px-4 py-3">Consum</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trimis la</th>
                <th className="px-4 py-3">Motiv</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-3">{item.periodMonth || '—'}</td>
                  <td className="px-4 py-3">{item.meter?.typeLabel || item.meter?.type}<p className="text-xs text-muted-foreground">{item.meter?.serialNumber}</p></td>
                  <td className="px-4 py-3">{item.apartment?.apartmentNumber || item.apartment?.number || '—'}</td>
                  <td className="px-4 py-3">{formatNumber(item.readingValue)} {item.unit}</td>
                  <td className="px-4 py-3">{formatNumber(item.consumptionValue)} {item.unit}</td>
                  <td className="px-4 py-3"><BadgeForStatus status={item.status} /></td>
                  <td className="px-4 py-3">{formatDate(item.submittedAt || item.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.rejectionReason || item.adminComment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminResidentReadingsPage() {
  const searchParams = useSearchParams();
  const initialPeriodId = searchParams.get('periodId') || '';
  const initialStatus = searchParams.get('status') || 'SUBMITTED';
  const [overview, setOverview] = useState<AnyRecord | null>(null);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [issues, setIssues] = useState<AnyRecord[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [rejecting, setRejecting] = useState<AnyRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const params = useMemo(() => ({
    periodId: initialPeriodId || undefined,
    status: status || undefined,
    search: search || undefined,
    limit: 100,
  }), [initialPeriodId, status, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewResponse, listResponse, issuesResponse] = await Promise.all([
        metersApi.getAdminResidentReadingsOverview({ periodId: initialPeriodId || undefined, limit: 1000 }),
        metersApi.getAdminResidentReadings(params),
        metersApi.getAdminResidentReadingIssues({ periodId: initialPeriodId || undefined, limit: 100 }),
      ]);
      setOverview(overviewResponse.data);
      setItems(listResponse.data?.items || []);
      setIssues(issuesResponse.data?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Nu am putut încărca citirile locatarilor.');
    } finally {
      setLoading(false);
    }
  }, [initialPeriodId, params]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string, confirmWarnings = false) => {
    setActionLoading(true);
    setMessage('');
    setError('');
    try {
      await metersApi.approveAdminResidentReading(id, { confirmWarnings });
      setMessage('Citirea a fost aprobată.');
      setDetail(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Citirea nu a putut fi aprobată.');
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setActionLoading(true);
    setError('');
    try {
      await metersApi.rejectAdminResidentReading(rejecting.id, { rejectionReason: rejectReason });
      setMessage('Citirea a fost respinsă.');
      setRejecting(null);
      setRejectReason('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Citirea nu a putut fi respinsă.');
    } finally {
      setActionLoading(false);
    }
  };

  const bulkApprove = async () => {
    if (!selected.length) return;
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await metersApi.bulkApproveAdminResidentReadings({ readingIds: selected, confirmWarnings: true });
      setMessage(`Au fost aprobate ${response.data?.approvedCount || 0} citiri. ${response.data?.skippedCount || 0} au fost sărite.`);
      setSelected([]);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Aprobarea în bulk nu a reușit.');
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setActionLoading(true);
    try {
      const response = await metersApi.getAdminResidentReading(id);
      setDetail(response.data);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((state) => state.includes(id) ? state.filter((item) => item !== id) : [...state, id]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Citiri trimise de locatari"
        description="Verifică și aprobă citirile transmise din portal."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button onClick={bulkApprove} disabled={!selected.length || actionLoading}>Aprobă selectate</Button>
            <ButtonLink href="/admin/meter-readings" variant="secondary">Mergi la citiri lunare</ButtonLink>
          </div>
        }
      />
      {error ? <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card> : null}
      {message ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-700">{message}</Card> : null}

      <div className="grid gap-4 md:grid-cols-6">
        <StatCard label="Trimise" value={overview?.totalSubmitted ?? 0} icon={<Send className="h-5 w-5" />} />
        <StatCard label="În verificare" value={overview?.pendingReview ?? 0} tone="warning" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Aprobate" value={overview?.approved ?? 0} tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Respinse" value={overview?.rejected ?? 0} tone="danger" icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Critice" value={overview?.criticalIssuesCount ?? 0} tone="danger" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Apartamente lipsă" value={overview?.apartmentsMissingCount ?? 0} tone="warning" icon={<Droplets className="h-5 w-5" />} />
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input className="h-10 w-full rounded-2xl border border-border bg-white pl-9 pr-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută apartament, locatar, contor" />
          </label>
          <select className="h-10 rounded-2xl border border-border bg-white px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Toate statusurile</option>
            <option value="SUBMITTED">De verificat</option>
            <option value="APPROVED">Aprobate</option>
            <option value="REJECTED">Respinse</option>
          </select>
        </div>
      </Card>

      {loading ? <Card>Se încarcă...</Card> : null}
      {!loading && !items.length ? (
        <EmptyState title="Nu există citiri trimise de locatari." description="Când locatarii transmit citiri, acestea vor apărea aici pentru verificare." />
      ) : null}

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Select</th>
                <th className="px-4 py-3">Apartament</th>
                <th className="px-4 py-3">Locatar</th>
                <th className="px-4 py-3">Contor</th>
                <th className="px-4 py-3">Precedentă</th>
                <th className="px-4 py-3">Trimisă</th>
                <th className="px-4 py-3">Consum</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Probleme</th>
                <th className="px-4 py-3">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelected(item.id)} aria-label="Selectează citirea" />
                  </td>
                  <td className="px-4 py-3">Ap. {item.apartment?.apartmentNumber || item.apartment?.number || '—'}<p className="text-xs text-muted-foreground">{item.apartment?.building} / {item.apartment?.staircase}</p></td>
                  <td className="px-4 py-3">{item.resident?.fullName || '—'}<p className="text-xs text-muted-foreground">{item.resident?.phone || item.resident?.email || ''}</p></td>
                  <td className="px-4 py-3">{item.meter?.typeLabel || item.meter?.type}<p className="text-xs text-muted-foreground">{item.meter?.serialNumber}</p></td>
                  <td className="px-4 py-3">{formatNumber(item.previousReading?.readingValue)}</td>
                  <td className="px-4 py-3 font-semibold">{formatNumber(item.submittedValue)} {item.unit}</td>
                  <td className="px-4 py-3">{formatNumber(item.consumption)} {item.unit}</td>
                  <td className="px-4 py-3">{formatDate(item.readingDate)}</td>
                  <td className="px-4 py-3"><BadgeForStatus status={item.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(item.issues || []).slice(0, 2).map((issue: AnyRecord) => (
                        <Badge key={issue.type} variant={issueVariant[issue.severity] || 'neutral'}>{issue.title}</Badge>
                      ))}
                      {!item.issues?.length ? <Badge variant="success">OK</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openDetail(item.id)}>Deschide</Button>
                      {item.status === 'SUBMITTED' || item.status === 'NEEDS_REVIEW' ? <Button size="sm" onClick={() => approve(item.id, true)}>Aprobă</Button> : null}
                      {item.status === 'SUBMITTED' || item.status === 'NEEDS_REVIEW' ? <Button size="sm" variant="danger" onClick={() => setRejecting(item)}>Respinge</Button> : null}
                      <ButtonLink size="sm" variant="secondary" href={`/admin/meter-readings?meterId=${item.meterId}`}>Monthly</ButtonLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Probleme</h2>
          <ButtonLink href="/admin/resident-readings?tab=issues" variant="secondary" size="sm">Vezi probleme</ButtonLink>
        </div>
        {!issues.length ? <p className="text-sm text-muted-foreground">Nu există probleme detectate.</p> : null}
        <div className="grid gap-2 md:grid-cols-2">
          {issues.slice(0, 6).map((issue) => (
            <div key={`${issue.reading?.id}-${issue.type}`} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{issue.title}</p>
                <Badge variant={issueVariant[issue.severity] || 'neutral'}>{issue.severity}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{issue.recommendation}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="2xl">
        <ModalHeader title="Detalii citire" onClose={() => setDetail(null)} />
        <ModalBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <p className="text-sm font-semibold">Citire</p>
              <p className="mt-2 text-2xl font-semibold">{formatNumber(detail?.reading?.readingValue)} {detail?.reading?.unit}</p>
              <p className="text-sm text-muted-foreground">Consum: {formatNumber(detail?.reading?.consumptionValue || detail?.previousReading ? Number(detail?.reading?.readingValue || 0) - Number(detail?.previousReading?.readingValue || 0) : null)} {detail?.reading?.unit}</p>
              <div className="mt-3"><BadgeForStatus status={detail?.reading?.status} /></div>
            </Card>
            <Card>
              <p className="text-sm font-semibold">Dovadă</p>
              {detail?.reading?.proofFileUrl || detail?.reading?.photoUrl ? (
                <a
                  className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline"
                  href={detail?.reading?.proofFileAssetId ? filesApi.secureDownloadUrl(detail.reading.proofFileAssetId) : detail.reading.proofFileUrl || detail.reading.photoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Deschide dovada
                </a>
              ) : <p className="mt-2 text-sm text-muted-foreground">Nu există dovadă atașată.</p>}
            </Card>
          </div>
          <Card>
            <p className="text-sm font-semibold">Istoric contor</p>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {(detail?.history || []).slice(0, 8).map((reading: AnyRecord) => (
                <div key={reading.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-sm">
                  <span>{formatDate(reading.readingDate)} · {formatNumber(reading.readingValue)} {reading.unit}</span>
                  <BadgeForStatus status={reading.status} />
                </div>
              ))}
            </div>
          </Card>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDetail(null)}>Închide</Button>
          {detail?.reading?.status === 'SUBMITTED' || detail?.reading?.status === 'NEEDS_REVIEW' ? <Button variant="danger" onClick={() => setRejecting(detail.reading)}>Respinge</Button> : null}
          {detail?.reading?.status === 'SUBMITTED' || detail?.reading?.status === 'NEEDS_REVIEW' ? <Button onClick={() => approve(detail.reading.id, true)} isLoading={actionLoading}>Aprobă</Button> : null}
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} maxWidth="lg">
        <ModalHeader title="Respinge citirea" onClose={() => setRejecting(null)} />
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">Locatarul va vedea motivul respingerii și va putea retrimite citirea.</p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Motiv respingere</span>
            <textarea className="min-h-28 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setRejecting(null)}>Anulează</Button>
          <Button variant="danger" onClick={reject} disabled={!rejectReason.trim()} isLoading={actionLoading}>Respinge</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
