'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileText,
  Gauge,
  History,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
import { billingDraftsApi, metersApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type TabKey = 'overview' | 'tariffs' | 'invoices' | 'issues' | 'history';

type TariffRow = {
  type: string;
  name: string;
  unit: string;
  price: string;
  currency: string;
  isActive: boolean;
  note: string;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Sumar' },
  { key: 'tariffs', label: 'Tarife' },
  { key: 'invoices', label: 'Drafturi facturi' },
  { key: 'issues', label: 'Probleme' },
  { key: 'history', label: 'Istoric perioade' },
];

const tariffSuggestions: TariffRow[] = [
  { type: 'COLD_WATER', name: 'Apă rece', unit: 'M3', price: '', currency: 'MDL', isActive: true, note: '' },
  { type: 'HOT_WATER', name: 'Apă caldă', unit: 'M3', price: '', currency: 'MDL', isActive: true, note: '' },
  { type: 'ELECTRICITY', name: 'Electricitate', unit: 'KWH', price: '', currency: 'MDL', isActive: true, note: '' },
  { type: 'GAS', name: 'Gaz', unit: 'M3', price: '', currency: 'MDL', isActive: true, note: '' },
  { type: 'HEATING', name: 'Încălzire', unit: 'GJ', price: '', currency: 'MDL', isActive: true, note: '' },
  { type: 'MAINTENANCE', name: 'Întreținere', unit: 'M2', price: '', currency: 'MDL', isActive: false, note: '' },
  { type: 'REPAIR_FUND', name: 'Fond reparații', unit: 'M2', price: '', currency: 'MDL', isActive: false, note: '' },
  { type: 'ELEVATOR', name: 'Lift', unit: 'APARTMENT', price: '', currency: 'MDL', isActive: false, note: '' },
  { type: 'OTHER', name: 'Altceva', unit: 'OTHER', price: '', currency: 'MDL', isActive: false, note: '' },
];

const statusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  CALCULATED: 'Calculat',
  IN_REVIEW: 'În revizuire',
  APPROVED: 'Aprobat',
  PUBLISHED: 'Publicat',
  CANCELLED: 'Anulat',
  PAID: 'Achitat',
  PARTIALLY_PAID: 'Parțial achitat',
  LOCKED: 'Blocat',
  OPEN: 'Deschis',
};

const typeLabel: Record<string, string> = {
  COLD_WATER: 'Apă rece',
  HOT_WATER: 'Apă caldă',
  ELECTRICITY: 'Electricitate',
  GAS: 'Gaz',
  HEATING: 'Încălzire',
  MAINTENANCE: 'Întreținere',
  ELEVATOR: 'Lift',
  REPAIR_FUND: 'Fond reparații',
  INVESTMENT_FUND: 'Fond investiții',
  OTHER: 'Altceva',
};

function statusVariant(status?: string): 'neutral' | 'warning' | 'success' | 'error' | 'default' {
  if (!status) return 'neutral';
  if (['APPROVED', 'PUBLISHED', 'PAID', 'LOCKED'].includes(status)) return 'success';
  if (['IN_REVIEW', 'CALCULATED', 'PARTIALLY_PAID', 'OPEN'].includes(status)) return 'warning';
  if (['CANCELLED'].includes(status)) return 'error';
  return 'neutral';
}

function severityVariant(severity?: string): 'neutral' | 'warning' | 'success' | 'error' | 'default' {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'WARNING') return 'warning';
  return 'neutral';
}

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MDL`;
}

function monthLabel(period?: { month?: number; year?: number; title?: string | null }) {
  if (!period) return 'Alege perioada';
  return period.title || `${String(period.month).padStart(2, '0')}/${period.year}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Operațiunea nu a reușit. Încearcă din nou.';
}

function selectClassName() {
  return 'h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm text-foreground outline-none transition focus:border-foreground/20 focus:ring-2 focus:ring-foreground/10';
}

function mergeTariffs(existing: any[]): TariffRow[] {
  const byType = new Map(existing.map((tariff) => [tariff.type, tariff]));
  return tariffSuggestions.map((suggestion) => {
    const existingTariff = byType.get(suggestion.type);
    if (!existingTariff) return { ...suggestion };
    return {
      type: suggestion.type,
      name: existingTariff.name || suggestion.name,
      unit: existingTariff.unit || suggestion.unit,
      price: existingTariff.price === undefined || existingTariff.price === null ? '' : String(existingTariff.price),
      currency: existingTariff.currency || 'MDL',
      isActive: existingTariff.isActive !== false,
      note: existingTariff.note || '',
    };
  });
}

export function BillingDraftsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const localizedPath = useLocalizedPath();
  const [periods, setPeriods] = useState<any[]>([]);
  const [readingPeriods, setReadingPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState(searchParams.get('periodId') || '');
  const [activeTab, setActiveTab] = useState<TabKey>((searchParams.get('tab') as TabKey) || 'overview');
  const [overview, setOverview] = useState<any>(null);
  const [tariffs, setTariffs] = useState<TariffRow[]>(mergeTariffs([]));
  const [invoices, setInvoices] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [invoiceDetail, setInvoiceDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState({ search: '', onlyIssues: false });
  const [issueFilter, setIssueFilter] = useState({ type: '', severity: '' });
  const [createForm, setCreateForm] = useState({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    meterReadingPeriodId: searchParams.get('meterReadingPeriodId') || '',
    title: '',
    note: '',
  });
  const [generateForm, setGenerateForm] = useState({
    includeMeterUtilities: true,
    includeMaintenanceFee: true,
    overwriteExistingDrafts: false,
    confirmWarnings: false,
  });
  const [approveConfirmWarnings, setApproveConfirmWarnings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const selectedPeriod = useMemo(() => periods.find((period) => period.id === selectedPeriodId), [periods, selectedPeriodId]);
  const blockingIssues = overview?.blockingIssues || [];
  const warnings = overview?.warnings || [];

  const updateUrl = useCallback(
    (periodId: string, tab: TabKey = activeTab) => {
      const params = new URLSearchParams();
      if (periodId) params.set('periodId', periodId);
      if (tab !== 'overview') params.set('tab', tab);
      router.replace(localizedPath(`/admin/billing-drafts${params.toString() ? `?${params.toString()}` : ''}`), { scroll: false });
    },
    [activeTab, localizedPath, router],
  );

  const loadPeriods = useCallback(async () => {
    const [periodsResponse, readingPeriodsResponse] = await Promise.all([
      billingDraftsApi.getAdminBillingPeriods(),
      metersApi.getAdminMeterReadingPeriods().catch(() => ({ data: { items: [] } })),
    ]);
    const nextPeriods = periodsResponse.data?.periods || periodsResponse.data?.items || [];
    setPeriods(nextPeriods);
    setReadingPeriods(readingPeriodsResponse.data?.items || readingPeriodsResponse.data?.periods || []);
    const urlPeriodId = searchParams.get('periodId');
    const nextSelected = urlPeriodId || selectedPeriodId || nextPeriods[0]?.id || '';
    setSelectedPeriodId(nextSelected);
    return nextSelected;
  }, [searchParams, selectedPeriodId]);

  const loadSelectedData = useCallback(
    async (periodId: string) => {
      if (!periodId) {
        setOverview(null);
        setInvoices([]);
        setIssues([]);
        setTariffs(mergeTariffs([]));
        return;
      }
      const [overviewResponse, tariffsResponse, invoicesResponse, issuesResponse] = await Promise.all([
        billingDraftsApi.getAdminBillingPeriodOverview(periodId),
        billingDraftsApi.getAdminBillingPeriodTariffs(periodId),
        billingDraftsApi.getAdminBillingDraftInvoices(periodId, {
          search: invoiceFilter.search || undefined,
          onlyIssues: invoiceFilter.onlyIssues || undefined,
          limit: 50,
        }),
        billingDraftsApi.getAdminBillingDraftIssues(periodId, {
          type: issueFilter.type || undefined,
          severity: issueFilter.severity || undefined,
          limit: 100,
        }),
      ]);
      setOverview(overviewResponse.data);
      setTariffs(mergeTariffs(tariffsResponse.data?.tariffs || []));
      setInvoices(invoicesResponse.data?.invoices || []);
      setIssues(issuesResponse.data?.issues || []);
    },
    [invoiceFilter, issueFilter],
  );

  const refresh = useCallback(async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const nextSelected = await loadPeriods();
      await loadSelectedData(nextSelected);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loadPeriods, loadSelectedData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async (label: string, action: () => Promise<void>, successMessage: string) => {
    setActionLoading(label);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      const nextSelected = await loadPeriods();
      await loadSelectedData(selectedPeriodId || nextSelected);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const createPeriod = () =>
    runAction(
      'create',
      async () => {
        const response = await billingDraftsApi.createAdminBillingPeriod({
          year: Number(createForm.year),
          month: Number(createForm.month),
          meterReadingPeriodId: createForm.meterReadingPeriodId || undefined,
          title: createForm.title || undefined,
          note: createForm.note || undefined,
        });
        const period = response.data?.period;
        setSelectedPeriodId(period.id);
        updateUrl(period.id, 'overview');
        setShowCreateModal(false);
      },
      'Perioada de facturare este pregătită.',
    );

  const saveTariffs = () =>
    runAction(
      'tariffs',
      async () => {
        const rows = tariffs
          .filter((tariff) => tariff.isActive || tariff.price || tariff.note)
          .map((tariff) => ({
            ...tariff,
            price: Number(tariff.price || 0),
          }));
        await billingDraftsApi.updateAdminBillingPeriodTariffs(selectedPeriodId, { tariffs: rows });
      },
      'Tarifele perioadei au fost salvate.',
    );

  const generateDrafts = () =>
    runAction(
      'generate',
      async () => {
        await billingDraftsApi.generateAdminBillingDrafts(selectedPeriodId, generateForm);
        setShowGenerateModal(false);
      },
      'Drafturile de facturi au fost generate.',
    );

  const recalculateDrafts = () =>
    runAction(
      'recalculate',
      async () => {
        await billingDraftsApi.recalculateAdminBillingDrafts(selectedPeriodId, {
          overwriteExistingDrafts: true,
          confirmWarnings: true,
        });
      },
      'Drafturile nepublicate au fost recalculate.',
    );

  const approvePeriod = () =>
    runAction(
      'approve',
      async () => {
        await billingDraftsApi.approveAdminBillingPeriod(selectedPeriodId, { confirmWarnings: approveConfirmWarnings });
        setShowApproveModal(false);
      },
      'Perioada a fost aprobată ca draft intern.',
    );

  const deleteDrafts = () =>
    runAction(
      'delete',
      async () => {
        await billingDraftsApi.deleteAdminBillingDrafts(selectedPeriodId, { confirm: deleteConfirm });
        setShowDeleteModal(false);
        setDeleteConfirm(false);
      },
      'Drafturile nepublicate au fost șterse.',
    );

  const openInvoice = async (invoiceId: string) => {
    setActionLoading(`invoice:${invoiceId}`);
    setError('');
    try {
      const response = await billingDraftsApi.getAdminBillingDraftInvoice(invoiceId);
      setInvoiceDetail(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const markInvoiceReview = async (invoiceId: string) => {
    await runAction(
      `review:${invoiceId}`,
      async () => {
        await billingDraftsApi.updateAdminBillingDraftInvoice(invoiceId, { status: 'IN_REVIEW' });
      },
      'Factura a fost marcată pentru review.',
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drafturi facturi"
        description="Generează și verifică facturile înainte de publicare."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" /> Perioadă nouă
            </Button>
            <Button variant="secondary" onClick={refresh} isLoading={actionLoading === 'refresh'}>
              <RefreshCw className="h-4 w-4" /> Actualizează
            </Button>
            <ButtonLink href={localizedPath('/admin/meter-readings')} variant="outline">
              <Gauge className="h-4 w-4" /> Citiri contoare
            </ButtonLink>
          </div>
        }
      />

      {error ? <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card> : null}
      {success ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-700">{success}</Card> : null}

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Perioadă de facturare</span>
            <select
              value={selectedPeriodId}
              onChange={(event) => {
                setSelectedPeriodId(event.target.value);
                updateUrl(event.target.value);
              }}
              className={selectClassName()}
            >
              <option value="">Alege perioada</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {monthLabel(period)} · {statusLabel[period.status] || period.status}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {selectedPeriod ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(selectedPeriod.status)}>{statusLabel[selectedPeriod.status] || selectedPeriod.status}</Badge>
                {selectedPeriod.meterReadingPeriod ? <span>Citiri: {statusLabel[selectedPeriod.meterReadingPeriod.status] || selectedPeriod.meterReadingPeriod.status}</span> : <span>Fără perioadă de citiri legată</span>}
              </div>
            ) : (
              'Nu există perioadă de facturare creată.'
            )}
          </div>
          {!selectedPeriod ? (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" /> Creează perioadă
            </Button>
          ) : null}
        </div>
      </Card>

      {selectedPeriod ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Apartamente" value={overview?.apartmentsCount || 0} icon={<ReceiptText className="h-5 w-5" />} />
            <StatCard label="Facturi draft" value={overview?.invoicesDraftCount || 0} icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Total estimat" value={formatMoney(overview?.totalDraftAmount || 0)} icon={<Calculator className="h-5 w-5" />} />
            <StatCard label="Tarife lipsă" value={overview?.missingTariffsCount || 0} tone={overview?.missingTariffsCount ? 'danger' : 'neutral'} icon={<Settings2 className="h-5 w-5" />} />
            <StatCard label="Probleme critice" value={blockingIssues.length} tone={blockingIssues.length ? 'danger' : 'success'} icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard label="Fără linii" value={issues.filter((issue) => issue.type === 'INVOICE_WITHOUT_LINES').length} tone={issues.some((issue) => issue.type === 'INVOICE_WITHOUT_LINES') ? 'warning' : 'neutral'} icon={<History className="h-5 w-5" />} />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  updateUrl(selectedPeriodId, tab.key);
                }}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Sumar perioadă</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {monthLabel(selectedPeriod)} · {overview?.linkedMeterReadingPeriod ? 'legată de perioada de citiri' : 'fără perioadă de citiri'}
                    </p>
                  </div>
                  <Badge variant={statusVariant(overview?.period?.status)}>{statusLabel[overview?.period?.status] || overview?.period?.status}</Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoLine label="Drafturi în review" value={overview?.invoicesInReviewCount || 0} />
                  <InfoLine label="Facturi aprobate/publicate" value={`${overview?.invoicesPublishedCount || 0} publicate`} />
                  <InfoLine label="Apartamente fără factură" value={overview?.apartmentsWithoutInvoice || 0} />
                  <InfoLine label="Citiri lipsă" value={overview?.readingsMissingCount || 0} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => setShowGenerateModal(true)} disabled={!overview?.canGenerate}>
                    <Calculator className="h-4 w-4" /> Generează drafturi
                  </Button>
                  <Button variant="secondary" onClick={recalculateDrafts} disabled={!overview?.canRecalculate} isLoading={actionLoading === 'recalculate'}>
                    <RefreshCw className="h-4 w-4" /> Recalculează
                  </Button>
                  <Button variant="secondary" onClick={() => setShowApproveModal(true)} disabled={!overview?.canApprove}>
                    <CheckCircle2 className="h-4 w-4" /> Aprobă perioada
                  </Button>
                  <ButtonLink href={`/admin/invoices?billingPeriodId=${selectedPeriodId}&status=APPROVED`} variant="secondary">
                    <FileText className="h-4 w-4" /> Publică facturile către locatari
                  </ButtonLink>
                  <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                    <Trash2 className="h-4 w-4" /> Șterge drafturi
                  </Button>
                </div>
              </Card>
              <Card>
                <h2 className="text-lg font-semibold text-foreground">Atenție</h2>
                {blockingIssues.length || warnings.length ? (
                  <div className="mt-4 space-y-3">
                    {[...blockingIssues, ...warnings].slice(0, 6).map((issue: any) => (
                      <IssueRow key={issue.id} issue={issue} />
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('issues')}>
                      Vezi toate problemele
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Nu există probleme critice detectate pentru această perioadă.</p>
                )}
              </Card>
            </div>
          ) : null}

          {activeTab === 'tariffs' ? (
            <Card noPadding>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Tarife perioadă</h2>
                  <p className="text-sm text-muted-foreground">Rândurile sunt sugestii de formular; devin date reale doar după salvare.</p>
                </div>
                <Button onClick={saveTariffs} isLoading={actionLoading === 'tariffs'}>
                  Salvează tarife
                </Button>
              </div>
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Tip</TableHeaderCell>
                      <TableHeaderCell>Denumire</TableHeaderCell>
                      <TableHeaderCell>Unitate</TableHeaderCell>
                      <TableHeaderCell>Preț</TableHeaderCell>
                      <TableHeaderCell>Activ</TableHeaderCell>
                      <TableHeaderCell>Notă</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tariffs.map((tariff, index) => (
                      <TableRow key={tariff.type}>
                        <TableCell>{typeLabel[tariff.type] || tariff.type}</TableCell>
                        <TableCell>
                          <Input value={tariff.name} onChange={(event) => updateTariff(index, { name: event.target.value })} />
                        </TableCell>
                        <TableCell>
                          <select value={tariff.unit} onChange={(event) => updateTariff(index, { unit: event.target.value })} className={selectClassName()}>
                            {['M3', 'KWH', 'GJ', 'M2', 'APARTMENT', 'PERSON', 'FIXED', 'OTHER'].map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" value={tariff.price} onChange={(event) => updateTariff(index, { price: event.target.value })} />
                        </TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={tariff.isActive}
                            onChange={(event) => updateTariff(index, { isActive: event.target.checked })}
                            className="h-4 w-4 rounded border-border"
                            aria-label={`Activează ${tariff.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={tariff.note} onChange={(event) => updateTariff(index, { note: event.target.value })} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </Card>
          ) : null}

          {activeTab === 'invoices' ? (
            <Card noPadding>
              <div className="grid gap-3 border-b border-border p-5 md:grid-cols-[1fr_auto_auto] md:items-end">
                <Input label="Căutare" value={invoiceFilter.search} onChange={(event) => setInvoiceFilter((current) => ({ ...current, search: event.target.value }))} placeholder="Apartament, bloc, locatar" />
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={invoiceFilter.onlyIssues} onChange={(event) => setInvoiceFilter((current) => ({ ...current, onlyIssues: event.target.checked }))} />
                  Doar cu probleme
                </label>
                <Button variant="secondary" onClick={() => loadSelectedData(selectedPeriodId)}>
                  Filtrează
                </Button>
              </div>
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Apartament</TableHeaderCell>
                      <TableHeaderCell>Proprietar/locatar</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Linii</TableHeaderCell>
                      <TableHeaderCell>Total</TableHeaderCell>
                      <TableHeaderCell>Probleme</TableHeaderCell>
                      <TableHeaderCell>Acțiuni</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.length ? (
                      invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">Ap. {invoice.apartment?.number}</div>
                            <div className="text-xs text-muted-foreground">{[invoice.apartment?.building?.name, invoice.apartment?.staircase?.name].filter(Boolean).join(' / ') || 'Fără bloc/scară'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{invoice.owner?.name || invoice.resident?.name || 'Contact lipsă'}</div>
                            <div className="text-xs text-muted-foreground">{invoice.owner?.phone || invoice.resident?.phone || ''}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(invoice.status)}>{statusLabel[invoice.status] || invoice.status}</Badge>
                          </TableCell>
                          <TableCell>{invoice.linesCount || 0}</TableCell>
                          <TableCell>{formatMoney(invoice.total || 0)}</TableCell>
                          <TableCell>
                            {invoice.issues?.length ? <Badge variant="error">{invoice.issues.length}</Badge> : <Badge variant="neutral">0</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openInvoice(invoice.id)} isLoading={actionLoading === `invoice:${invoice.id}`}>
                                Deschide
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => markInvoiceReview(invoice.id)} isLoading={actionLoading === `review:${invoice.id}`}>
                                Marchează verificată
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmpty colSpan={7}>Nu există facturi draft pentru această perioadă.</TableEmpty>
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>
            </Card>
          ) : null}

          {activeTab === 'issues' ? (
            <Card noPadding>
              <div className="grid gap-3 border-b border-border p-5 md:grid-cols-3">
                <Input label="Căutare" placeholder="Problemă, contor, apartament" onChange={(event) => setIssueFilter((current) => ({ ...current, search: event.target.value } as any))} />
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Tip</span>
                  <select value={issueFilter.type} onChange={(event) => setIssueFilter((current) => ({ ...current, type: event.target.value }))} className={selectClassName()}>
                    <option value="">Toate</option>
                    {['MISSING_TARIFF', 'MISSING_READING', 'NEGATIVE_CONSUMPTION', 'ZERO_CONSUMPTION', 'HIGH_CONSUMPTION', 'APARTMENT_WITHOUT_SURFACE', 'INVOICE_WITHOUT_LINES'].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Severitate</span>
                  <select value={issueFilter.severity} onChange={(event) => setIssueFilter((current) => ({ ...current, severity: event.target.value }))} className={selectClassName()}>
                    <option value="">Toate</option>
                    <option value="CRITICAL">Critice</option>
                    <option value="WARNING">Avertizări</option>
                  </select>
                </label>
                <Button variant="secondary" onClick={() => loadSelectedData(selectedPeriodId)}>
                  Aplică filtre
                </Button>
              </div>
              <div className="divide-y divide-border">
                {issues.length ? (
                  issues.map((issue) => <IssueRow key={issue.id} issue={issue} expanded />)
                ) : (
                  <div className="p-8 text-sm text-muted-foreground">Nu există probleme critice detectate.</div>
                )}
              </div>
            </Card>
          ) : null}

          {activeTab === 'history' ? (
            <Card noPadding>
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Luna/an</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Facturi</TableHeaderCell>
                      <TableHeaderCell>Total</TableHeaderCell>
                      <TableHeaderCell>Probleme</TableHeaderCell>
                      <TableHeaderCell>Actualizat</TableHeaderCell>
                      <TableHeaderCell>Acțiuni</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {periods.length ? (
                      periods.map((period) => (
                        <TableRow key={period.id}>
                          <TableCell>{monthLabel(period)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(period.status)}>{statusLabel[period.status] || period.status}</Badge>
                          </TableCell>
                          <TableCell>{period.invoicesCount || 0}</TableCell>
                          <TableCell>{formatMoney(period.totalAmount || 0)}</TableCell>
                          <TableCell>{period.issuesCount || 0}</TableCell>
                          <TableCell>{period.updatedAt ? new Date(period.updatedAt).toLocaleDateString('ro-MD') : '-'}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="secondary" onClick={() => {
                              setSelectedPeriodId(period.id);
                              updateUrl(period.id, 'overview');
                              setActiveTab('overview');
                            }}>
                              Deschide
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmpty colSpan={7}>Nu există perioade de facturare create.</TableEmpty>
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <h2 className="text-lg font-semibold text-foreground">Nu există perioadă de facturare creată.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Creează o perioadă după ce ai blocat citirile lunare, apoi setează tarifele și generează drafturi.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateModal(true)}>Creează perioadă</Button>
            <ButtonLink href="/admin/meter-readings" variant="secondary">Mergi la citiri</ButtonLink>
          </div>
        </Card>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="xl">
        <ModalHeader title="Perioadă nouă de facturare" onClose={() => setShowCreateModal(false)} />
        <ModalBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="An" type="number" value={createForm.year} onChange={(event) => setCreateForm((current) => ({ ...current, year: event.target.value }))} />
            <Input label="Luna" type="number" min="1" max="12" value={createForm.month} onChange={(event) => setCreateForm((current) => ({ ...current, month: event.target.value }))} />
          </div>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Perioadă de citiri legată</span>
            <select value={createForm.meterReadingPeriodId} onChange={(event) => setCreateForm((current) => ({ ...current, meterReadingPeriodId: event.target.value }))} className={selectClassName()}>
              <option value="">Fără legătură</option>
              {readingPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {String(period.month).padStart(2, '0')}/{period.year} · {statusLabel[period.status] || period.status}
                </option>
              ))}
            </select>
          </label>
          <Input label="Titlu" value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Facturare luna curentă" />
          <Input label="Notă" value={createForm.note} onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))} />
          {createForm.meterReadingPeriodId && readingPeriods.find((period) => period.id === createForm.meterReadingPeriodId)?.status !== 'LOCKED' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Pentru calcule corecte, blochează mai întâi perioada de citiri.
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Anulează</Button>
          <Button onClick={createPeriod} isLoading={actionLoading === 'create'}>Creează perioada</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} maxWidth="xl">
        <ModalHeader title="Generează drafturi" onClose={() => setShowGenerateModal(false)} />
        <ModalBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoLine label="Apartamente" value={overview?.apartmentsCount || 0} />
            <InfoLine label="Tarife configurate" value={overview?.tariffsCount || 0} />
            <InfoLine label="Tarife lipsă" value={overview?.missingTariffsCount || 0} />
            <InfoLine label="Citiri lipsă" value={overview?.readingsMissingCount || 0} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={generateForm.includeMeterUtilities} onChange={(event) => setGenerateForm((current) => ({ ...current, includeMeterUtilities: event.target.checked }))} />
            Include utilități pe contoare
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={generateForm.includeMaintenanceFee} onChange={(event) => setGenerateForm((current) => ({ ...current, includeMaintenanceFee: event.target.checked }))} />
            Include întreținere/fonduri
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={generateForm.overwriteExistingDrafts} onChange={(event) => setGenerateForm((current) => ({ ...current, overwriteExistingDrafts: event.target.checked }))} />
            Suprascrie drafturile existente nepublicate
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={generateForm.confirmWarnings} onChange={(event) => setGenerateForm((current) => ({ ...current, confirmWarnings: event.target.checked }))} />
            Confirm că am verificat tarifele, citirile și warning-urile
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>Anulează</Button>
          <Button onClick={generateDrafts} isLoading={actionLoading === 'generate'}>Generează drafturi</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} maxWidth="lg">
        <ModalHeader title="Aprobă perioada" onClose={() => setShowApproveModal(false)} />
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">Aprobarea marchează drafturile valide ca APPROVED. Facturile nu sunt publicate către locatari.</p>
          <InfoLine label="Total estimat" value={formatMoney(overview?.totalDraftAmount || 0)} />
          <InfoLine label="Probleme critice" value={blockingIssues.length} />
          <InfoLine label="Warning-uri" value={warnings.length} />
          {blockingIssues.length ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Perioada are probleme critice și nu poate fi aprobată.</div> : null}
          {warnings.length ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={approveConfirmWarnings} onChange={(event) => setApproveConfirmWarnings(event.target.checked)} />
              Confirm că am verificat warning-urile.
            </label>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowApproveModal(false)}>Anulează</Button>
          <Button onClick={approvePeriod} disabled={blockingIssues.length > 0} isLoading={actionLoading === 'approve'}>Aprobă</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} maxWidth="lg">
        <ModalHeader title="Șterge drafturi" onClose={() => setShowDeleteModal(false)} />
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">Vor fi șterse doar drafturile nepublicate. Facturile publicate sau achitate nu sunt atinse.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.checked)} />
            Confirm ștergerea drafturilor nepublicate.
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Anulează</Button>
          <Button variant="danger" onClick={deleteDrafts} disabled={!deleteConfirm} isLoading={actionLoading === 'delete'}>Șterge drafturi</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(invoiceDetail)} onClose={() => setInvoiceDetail(null)} maxWidth="2xl">
        <ModalHeader title="Detaliu factură draft" onClose={() => setInvoiceDetail(null)} />
        <ModalBody className="space-y-5">
          {invoiceDetail?.invoice ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoLine label="Apartament" value={`Ap. ${invoiceDetail.invoice.apartment?.number}`} />
                <InfoLine label="Status" value={statusLabel[invoiceDetail.invoice.status] || invoiceDetail.invoice.status} />
                <InfoLine label="Total" value={formatMoney(invoiceDetail.invoice.total || 0)} />
              </div>
              <TableWrapper>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Descriere</TableHeaderCell>
                      <TableHeaderCell>Cantitate</TableHeaderCell>
                      <TableHeaderCell>Unitate</TableHeaderCell>
                      <TableHeaderCell>Preț</TableHeaderCell>
                      <TableHeaderCell>Sumă</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoiceDetail.invoice.lines?.length ? (
                      invoiceDetail.invoice.lines.map((line: any) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.description}</TableCell>
                          <TableCell>{line.quantity}</TableCell>
                          <TableCell>{line.unit}</TableCell>
                          <TableCell>{formatMoney(line.unitPrice)}</TableCell>
                          <TableCell>{formatMoney(line.amount)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmpty colSpan={5}>Factura nu are linii calculate.</TableEmpty>
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>
              {invoiceDetail.issues?.length ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Probleme</h3>
                  {invoiceDetail.issues.map((issue: any) => <IssueRow key={issue.id} issue={issue} />)}
                </div>
              ) : null}
            </>
          ) : null}
        </ModalBody>
      </Modal>
    </div>
  );

  function updateTariff(index: number, patch: Partial<TariffRow>) {
    setTariffs((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
}

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function IssueRow({ issue, expanded = false }: { issue: any; expanded?: boolean }) {
  return (
    <div className={`${expanded ? 'p-5' : 'rounded-xl border border-border/70 p-3'} bg-white`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severityVariant(issue.severity)}>{issue.severity === 'CRITICAL' ? 'Critic' : issue.severity === 'WARNING' ? 'Warning' : 'Info'}</Badge>
            <span className="text-xs text-muted-foreground">{issue.type}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">{issue.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{issue.recommendation}</p>
          {issue.apartment ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {[issue.apartment.building, issue.apartment.entrance, `ap. ${issue.apartment.number}`].filter(Boolean).join(' / ')}
            </p>
          ) : null}
        </div>
        {issue.blocking ? <Badge variant="error">Blochează aprobare</Badge> : <Badge variant="neutral">Nu blochează</Badge>}
      </div>
    </div>
  );
}
