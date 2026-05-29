'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Home,
  RefreshCw,
  Search,
  Send,
  Undo2,
  WalletCards,
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
import { billingDraftsApi, invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type InvoiceStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

type InvoiceIssue = {
  id: string;
  type: string;
  severity: IssueSeverity;
  blocking: boolean;
  title: string;
  recommendation: string;
  invoice?: { id: string; invoiceNumber?: string | null; status: string; total: number } | null;
  apartment?: { id: string; number: string; building?: string | null; entrance?: string | null } | null;
};

type InvoiceRow = {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string | null;
  status: InvoiceStatus;
  total: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  currency: string;
  dueDate?: string | null;
  publishedAt?: string | null;
  viewedAt?: string | null;
  publicNote?: string | null;
  internalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  billingPeriod?: { id: string; year: number; month: number; status: string; title?: string | null } | null;
  billingMonth?: string;
  apartment?: {
    id: string;
    number?: string;
    apartmentNumber?: string;
    building?: { id: string; name: string } | null;
    staircase?: { id: string; name: string } | null;
    entrance?: { id: string; name: string } | null;
  } | null;
  owner?: { id: string; name?: string | null; phone?: string | null; email?: string | null; hasUserAccount?: boolean } | null;
  resident?: { id: string; name?: string | null; phone?: string | null; email?: string | null; hasUserAccount?: boolean } | null;
  linesCount: number;
  issues: InvoiceIssue[];
};

type InvoiceDetail = InvoiceRow & {
  publishedBy?: { id: string; name?: string | null } | null;
  lines?: Array<{
    id: string;
    description: string;
    name?: string;
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    amount: number;
    currency: string;
    meter?: { serialNumber?: string | null; type?: string | null } | null;
  }>;
};

type Overview = {
  totalInvoices: number;
  draftInvoices: number;
  approvedInvoices: number;
  publishedInvoices: number;
  paidInvoices: number;
  partiallyPaidInvoices: number;
  cancelledInvoices: number;
  unpublishedApprovedInvoices: number;
  totalPublishedAmount: number;
  totalDraftAmount: number;
  totalApprovedAmount: number;
  invoicesWithIssues: number;
  residentsWithoutUserAccount: number;
  invoicesWithoutResident: number;
  invoicesWithoutLines: number;
  warningsCount: number;
  criticalIssuesCount: number;
};

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'În review',
  APPROVED: 'Aprobată',
  PUBLISHED: 'Publicată',
  PAID: 'Achitată',
  PARTIALLY_PAID: 'Parțial achitată',
  CANCELLED: 'Anulată',
};

const statusVariant: Record<InvoiceStatus, 'neutral' | 'default' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  APPROVED: 'default',
  PUBLISHED: 'success',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  CANCELLED: 'neutral',
};

const severityVariant: Record<IssueSeverity, 'neutral' | 'warning' | 'error'> = {
  INFO: 'neutral',
  WARNING: 'warning',
  CRITICAL: 'error',
};

const emptyOverview: Overview = {
  totalInvoices: 0,
  draftInvoices: 0,
  approvedInvoices: 0,
  publishedInvoices: 0,
  paidInvoices: 0,
  partiallyPaidInvoices: 0,
  cancelledInvoices: 0,
  unpublishedApprovedInvoices: 0,
  totalPublishedAmount: 0,
  totalDraftAmount: 0,
  totalApprovedAmount: 0,
  invoicesWithIssues: 0,
  residentsWithoutUserAccount: 0,
  invoicesWithoutResident: 0,
  invoicesWithoutLines: 0,
  warningsCount: 0,
  criticalIssuesCount: 0,
};

export default function AdminInvoicesPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [issues, setIssues] = useState<InvoiceIssue[]>([]);
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [billingPeriods, setBillingPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'approved' | 'published' | 'issues' | 'periods'>('all');
  const [filters, setFilters] = useState({ search: '', billingPeriodId: '', status: '', onlyUnpublished: false, onlyPublished: false, onlyIssues: false });
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [publishMode, setPublishMode] = useState<'single' | 'bulk' | null>(null);
  const [publishInvoice, setPublishInvoice] = useState<InvoiceRow | null>(null);
  const [publishForm, setPublishForm] = useState({ dueDate: '', publicNote: '', confirm: false });
  const [editForm, setEditForm] = useState({ dueDate: '', publicNote: '', internalNote: '', invoiceNumber: '' });
  const [unpublishReason, setUnpublishReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listParams: Record<string, string | number | boolean | undefined> = {
        search: filters.search || undefined,
        billingPeriodId: filters.billingPeriodId || undefined,
        status: filters.status || undefined,
        onlyUnpublished: filters.onlyUnpublished || undefined,
        onlyPublished: filters.onlyPublished || undefined,
        onlyIssues: filters.onlyIssues || undefined,
        page: 1,
        limit: 80,
      };
      const [listRes, overviewRes, issuesRes, periodsRes] = await Promise.all([
        invoicesApi.getAdminInvoices(listParams),
        invoicesApi.getAdminInvoicesOverview(),
        invoicesApi.getAdminInvoiceIssues({
          billingPeriodId: filters.billingPeriodId || undefined,
          page: 1,
          limit: 100,
        }),
        billingDraftsApi.getAdminBillingPeriods(),
      ]);
      setRows(listRes.data?.items || []);
      setOverview(overviewRes.data || emptyOverview);
      setIssues(issuesRes.data?.issues || []);
      setBillingPeriods(periodsRes.data?.periods || periodsRes.data?.items || []);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca facturile.'));
      setRows([]);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextStatus = params.get('status') || '';
    const billingPeriodId = params.get('billingPeriodId') || '';
    const tab = params.get('tab') || '';
    if (nextStatus || billingPeriodId || tab) {
      setFilters((current) => ({ ...current, status: nextStatus, billingPeriodId }));
      if (tab === 'issues') setActiveTab('issues');
      if (nextStatus === 'APPROVED') setActiveTab('approved');
      if (nextStatus === 'PUBLISHED') setActiveTab('published');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRows = useMemo(() => {
    if (activeTab === 'approved') return rows.filter((row) => row.status === 'APPROVED');
    if (activeTab === 'published') return rows.filter((row) => ['PUBLISHED', 'PAID', 'PARTIALLY_PAID'].includes(row.status));
    return rows;
  }, [activeTab, rows]);

  const selectedRows = visibleRows.filter((row) => selected.includes(row.id));
  const canBulkPublish = selectedRows.some((row) => row.status === 'APPROVED') || Boolean(filters.billingPeriodId);

  function setTab(tab: typeof activeTab) {
    setActiveTab(tab);
    setSelected([]);
    if (tab === 'approved') setFilters((current) => ({ ...current, status: 'APPROVED', onlyPublished: false, onlyIssues: false }));
    if (tab === 'published') setFilters((current) => ({ ...current, status: '', onlyPublished: true, onlyIssues: false }));
    if (tab === 'issues') setFilters((current) => ({ ...current, status: '', onlyPublished: false, onlyIssues: true }));
    if (tab === 'all' || tab === 'periods') setFilters((current) => ({ ...current, status: '', onlyPublished: false, onlyIssues: false }));
  }

  async function openDetail(invoice: InvoiceRow) {
    setDetailLoading(true);
    setError('');
    try {
      const res = await invoicesApi.getAdminInvoice(invoice.id);
      const invoiceDetail = res.data?.invoice || null;
      setDetail(invoiceDetail);
      setEditForm({
        dueDate: toDateInput(invoiceDetail?.dueDate),
        publicNote: invoiceDetail?.publicNote || '',
        internalNote: invoiceDetail?.internalNote || '',
        invoiceNumber: invoiceDetail?.invoiceNumber || '',
      });
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca factura.'));
    } finally {
      setDetailLoading(false);
    }
  }

  function openPublish(invoice?: InvoiceRow) {
    setPublishInvoice(invoice || null);
    setPublishMode(invoice ? 'single' : 'bulk');
    setPublishForm({
      dueDate: toDateInput(invoice?.dueDate),
      publicNote: invoice?.publicNote || '',
      confirm: false,
    });
  }

  async function saveInvoice() {
    if (!detail) return;
    setSaving('save');
    setError('');
    setMessage('');
    try {
      const res = await invoicesApi.updateAdminInvoice(detail.id, {
        dueDate: editForm.dueDate || null,
        publicNote: editForm.publicNote || null,
        internalNote: editForm.internalNote || null,
        invoiceNumber: editForm.invoiceNumber || undefined,
      });
      setDetail(res.data?.invoice || detail);
      setMessage('Factura a fost actualizată.');
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva factura.'));
    } finally {
      setSaving('');
    }
  }

  async function publish() {
    setSaving('publish');
    setError('');
    setMessage('');
    try {
      if (publishMode === 'single' && publishInvoice) {
        await invoicesApi.publishAdminInvoice(publishInvoice.id, {
          confirm: publishForm.confirm,
          dueDate: publishForm.dueDate || null,
          publicNote: publishForm.publicNote || null,
        });
        setMessage('Factura a fost publicată către locatar.');
      } else {
        const res = await invoicesApi.bulkPublishAdminInvoices({
          invoiceIds: selectedRows.length ? selectedRows.map((row) => row.id) : undefined,
          billingPeriodId: selectedRows.length ? undefined : filters.billingPeriodId || undefined,
          confirm: publishForm.confirm,
          dueDate: publishForm.dueDate || null,
          publicNote: publishForm.publicNote || null,
        });
        setMessage(`Au fost publicate ${res.data?.publishedCount || 0} facturi. ${res.data?.skippedCount || 0} au fost sărite.`);
      }
      setPublishMode(null);
      setPublishInvoice(null);
      setSelected([]);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut publica facturile.'));
    } finally {
      setSaving('');
    }
  }

  async function unpublish(invoice: InvoiceRow | InvoiceDetail) {
    setSaving(`unpublish:${invoice.id}`);
    setError('');
    setMessage('');
    try {
      await invoicesApi.unpublishAdminInvoice(invoice.id, { confirm: true, reason: unpublishReason || 'Retrasă manual de administrator.' });
      setMessage('Publicarea facturii a fost anulată.');
      setUnpublishReason('');
      setDetail(null);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut anula publicarea.'));
    } finally {
      setSaving('');
    }
  }

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id));

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Facturi"
        description="Revizuiește, aprobă și publică facturile către locatari."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => openPublish()} disabled={!canBulkPublish}>
              <Send className="h-4 w-4" />
              Publică selectate
            </Button>
            <Button type="button" variant="secondary" onClick={() => openPublish()} disabled={!filters.billingPeriodId && selectedRows.length === 0}>
              Publică perioada
            </Button>
            <Button type="button" variant="secondary" onClick={() => setTab('issues')}>
              <AlertTriangle className="h-4 w-4" />
              Verifică probleme
            </Button>
            <ButtonLink href="/admin/billing-drafts" variant="secondary">
              Mergi la drafturi
            </ButtonLink>
            <Button type="button" variant="secondary" onClick={load} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total facturi" value={overview.totalInvoices} description="În organizația curentă" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Aprobate nepublicate" value={overview.unpublishedApprovedInvoices} description="Pregătite pentru portal" icon={<CheckCircle2 className="h-5 w-5" />} tone={overview.unpublishedApprovedInvoices ? 'warning' : 'neutral'} />
        <StatCard label="Publicate" value={overview.publishedInvoices} description="Vizibile pentru locatari" icon={<Send className="h-5 w-5" />} tone="success" />
        <StatCard label="Total publicat" value={formatMdl(overview.totalPublishedAmount)} description="Nu reprezintă plăți procesate" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Probleme critice" value={overview.criticalIssuesCount} description="Blochează publicarea" icon={<AlertTriangle className="h-5 w-5" />} tone={overview.criticalIssuesCount ? 'danger' : 'success'} />
        <StatCard label="Locatari fără cont" value={overview.residentsWithoutUserAccount} description="Warning, nu blocaj" icon={<Home className="h-5 w-5" />} tone={overview.residentsWithoutUserAccount ? 'warning' : 'neutral'} />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută factură, apartament sau contact" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Perioadă</span>
            <select value={filters.billingPeriodId} onChange={(event) => setFilters((current) => ({ ...current, billingPeriodId: event.target.value }))} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
              <option value="">Toate perioadele</option>
              {billingPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.title || monthLabel(`${period.year}-${String(period.month).padStart(2, '0')}`)} · {period.status}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10">
              <option value="">Toate statusurile</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <Button type="button" variant={filters.onlyUnpublished ? 'primary' : 'secondary'} onClick={() => setFilters((current) => ({ ...current, onlyUnpublished: !current.onlyUnpublished, onlyPublished: false }))} className="self-end">
            Doar nepublicate
          </Button>
          <Button type="button" variant="secondary" onClick={() => setFilters({ search: '', billingPeriodId: '', status: '', onlyUnpublished: false, onlyPublished: false, onlyIssues: false })} className="self-end">
            Resetează
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {[
          ['all', 'Toate'],
          ['approved', 'Aprobate'],
          ['published', 'Publicate'],
          ['issues', 'Probleme'],
          ['periods', 'Perioade'],
        ].map(([value, label]) => (
          <Button key={value} type="button" variant={activeTab === value ? 'primary' : 'secondary'} onClick={() => setTab(value as typeof activeTab)}>
            {label}
          </Button>
        ))}
      </div>

      {activeTab === 'issues' ? (
        <IssuesTable issues={issues} onOpen={(invoiceId) => {
          const row = rows.find((item) => item.id === invoiceId);
          if (row) openDetail(row);
        }} />
      ) : activeTab === 'periods' ? (
        <PeriodsTable periods={billingPeriods} localizedPath={localizedPath} />
      ) : (
        <TableWrapper>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => setSelected(event.target.checked ? visibleRows.map((row) => row.id) : [])}
                    aria-label="Selectează toate facturile"
                  />
                </TableHeaderCell>
                <TableHeaderCell>Factură</TableHeaderCell>
                <TableHeaderCell>Apartament</TableHeaderCell>
                <TableHeaderCell>Locatar / proprietar</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>Scadență</TableHeaderCell>
                <TableHeaderCell>Publicată</TableHeaderCell>
                <TableHeaderCell>Vizualizată</TableHeaderCell>
                <TableHeaderCell>Probleme</TableHeaderCell>
                <TableHeaderCell>Acțiuni</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(invoice.id)}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id))}
                      aria-label={`Selectează ${invoice.invoiceNumber || invoice.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">{invoice.invoiceNumber || 'Fără număr'}</div>
                    <div className="text-xs text-muted-foreground">{invoice.billingMonth || monthLabelFromPeriod(invoice.billingPeriod)}</div>
                  </TableCell>
                  <TableCell>{apartmentLabel(invoice)}</TableCell>
                  <TableCell>{contactLabel(invoice)}</TableCell>
                  <TableCell><Badge variant={statusVariant[invoice.status]}>{statusLabels[invoice.status]}</Badge></TableCell>
                  <TableCell className="font-semibold">{formatMdl(invoice.totalAmount ?? invoice.total)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell>{formatDate(invoice.publishedAt)}</TableCell>
                  <TableCell>{formatDate(invoice.viewedAt)}</TableCell>
                  <TableCell>
                    {invoice.issues?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {invoice.issues.slice(0, 2).map((issue) => <Badge key={issue.id} variant={severityVariant[issue.severity]}>{issue.type}</Badge>)}
                        {invoice.issues.length > 2 ? <Badge variant="neutral">+{invoice.issues.length - 2}</Badge> : null}
                      </div>
                    ) : <Badge variant="success">OK</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" size="sm" variant="secondary" onClick={() => openDetail(invoice)} isLoading={detailLoading && detail?.id === invoice.id}>
                        <Eye className="h-3.5 w-3.5" />
                        Deschide
                      </Button>
                      {invoice.status === 'APPROVED' ? (
                        <Button type="button" size="sm" onClick={() => openPublish(invoice)}>
                          Publică
                        </Button>
                      ) : null}
                      {invoice.status === 'PUBLISHED' ? (
                        <Button type="button" size="sm" variant="secondary" onClick={() => unpublish(invoice)} isLoading={saving === `unpublish:${invoice.id}`}>
                          <Undo2 className="h-3.5 w-3.5" />
                          Retrage
                        </Button>
                      ) : null}
                      <ButtonLink href={`/admin/billing-drafts?periodId=${invoice.billingPeriod?.id || ''}`} size="sm" variant="secondary">
                        Drafturi
                      </ButtonLink>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !visibleRows.length ? (
                <TableEmpty colSpan={11}>
                  Nu există facturi încă. Generează mai întâi drafturi de facturare.
                </TableEmpty>
              ) : null}
            </TableBody>
          </Table>
          {loading ? <div className="p-4 text-sm font-medium text-muted-foreground">Se încarcă facturile...</div> : null}
        </TableWrapper>
      )}

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="2xl">
        <ModalHeader title={detail?.invoiceNumber || 'Detalii factură'} onClose={() => setDetail(null)} />
        <ModalBody className="space-y-5">
          {detail ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Status" value={statusLabels[detail.status]} />
                <Info label="Apartament" value={apartmentLabel(detail)} />
                <Info label="Total" value={formatMdl(detail.totalAmount ?? detail.total)} strong />
              </div>
              {detail.issues?.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
                  <div className="font-semibold text-amber-900">Probleme detectate</div>
                  <div className="mt-2 grid gap-2">
                    {detail.issues.map((issue) => (
                      <div key={issue.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-amber-900">{issue.title}</span>
                        <Badge variant={severityVariant[issue.severity]}>{issue.blocking ? 'Blocant' : issue.severity}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Număr factură" value={editForm.invoiceNumber} onChange={(event) => setEditForm((current) => ({ ...current, invoiceNumber: event.target.value }))} disabled={['PUBLISHED', 'PAID', 'PARTIALLY_PAID'].includes(detail.status)} />
                <Input label="Scadență" type="date" value={editForm.dueDate} onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))} disabled={['PUBLISHED', 'PAID', 'PARTIALLY_PAID'].includes(detail.status)} />
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">Notă publică</span>
                  <textarea value={editForm.publicNote} onChange={(event) => setEditForm((current) => ({ ...current, publicNote: event.target.value }))} rows={3} className="rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10" disabled={['PAID', 'PARTIALLY_PAID'].includes(detail.status)} />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">Notă internă</span>
                  <textarea value={editForm.internalNote} onChange={(event) => setEditForm((current) => ({ ...current, internalNote: event.target.value }))} rows={3} className="rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10" disabled={['PUBLISHED', 'PAID', 'PARTIALLY_PAID'].includes(detail.status)} />
                </label>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Linii factură</h3>
                <div className="mt-2 grid gap-2">
                  {(detail.lines || []).map((line) => (
                    <div key={line.id} className="grid gap-2 rounded-2xl border border-border/70 px-4 py-3 text-sm sm:grid-cols-[1.2fr_0.5fr_0.6fr_0.7fr] sm:items-center">
                      <span className="font-medium text-foreground">{line.description || line.name}</span>
                      <span className="text-muted-foreground">{line.quantity} {line.unit || ''}</span>
                      <span className="text-muted-foreground">{formatMdl(line.unitPrice)}</span>
                      <strong className="text-right text-foreground">{formatMdl(line.amount)}</strong>
                    </div>
                  ))}
                  {!detail.lines?.length ? <p className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Factura nu are linii.</p> : null}
                </div>
              </div>
              {detail.status === 'PUBLISHED' ? (
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Motiv retragere publicare</span>
                  <Input value={unpublishReason} onChange={(event) => setUnpublishReason(event.target.value)} placeholder="Ex. Corectăm nota publică" />
                </label>
              ) : null}
            </>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setDetail(null)}>Închide</Button>
          {detail && !['PUBLISHED', 'PAID', 'PARTIALLY_PAID'].includes(detail.status) ? (
            <Button type="button" variant="secondary" onClick={saveInvoice} isLoading={saving === 'save'}>Salvează note/scadență</Button>
          ) : null}
          {detail?.status === 'APPROVED' ? <Button type="button" onClick={() => openPublish(detail)}>Publică</Button> : null}
          {detail?.status === 'PUBLISHED' ? (
            <Button type="button" variant="danger" onClick={() => unpublish(detail)} isLoading={saving === `unpublish:${detail.id}`}>Anulează publicarea</Button>
          ) : null}
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(publishMode)} onClose={() => setPublishMode(null)} maxWidth="lg">
        <ModalHeader title={publishMode === 'single' ? 'Publică factura' : 'Publică facturile'} onClose={() => setPublishMode(null)} />
        <ModalBody className="space-y-4">
          <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {publishMode === 'single' && publishInvoice ? (
              <span>{publishInvoice.invoiceNumber || 'Factura fără număr'} · {apartmentLabel(publishInvoice)} · {formatMdl(publishInvoice.totalAmount ?? publishInvoice.total)}</span>
            ) : selectedRows.length ? (
              <span>{selectedRows.length} facturi selectate pentru publicare.</span>
            ) : (
              <span>Vor fi publicate facturile APPROVED din perioada selectată.</span>
            )}
          </div>
          <Input label="Scadență" type="date" value={publishForm.dueDate} onChange={(event) => setPublishForm((current) => ({ ...current, dueDate: event.target.value }))} />
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Notă publică opțională</span>
            <textarea value={publishForm.publicNote} onChange={(event) => setPublishForm((current) => ({ ...current, publicNote: event.target.value }))} rows={3} className="rounded-2xl border border-border/70 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10" />
          </label>
          <label className="flex items-start gap-2 rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm">
            <input type="checkbox" checked={publishForm.confirm} onChange={(event) => setPublishForm((current) => ({ ...current, confirm: event.target.checked }))} className="mt-1" />
            <span>Confirm că am verificat factura, liniile, recipientul și scadența. Publicarea o face vizibilă în portalul locatarului.</span>
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setPublishMode(null)}>Anulează</Button>
          <Button type="button" onClick={publish} isLoading={saving === 'publish'} disabled={!publishForm.confirm}>Publică</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function IssuesTable({ issues, onOpen }: { issues: InvoiceIssue[]; onOpen: (invoiceId: string) => void }) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Problemă</TableHeaderCell>
            <TableHeaderCell>Factură</TableHeaderCell>
            <TableHeaderCell>Apartament</TableHeaderCell>
            <TableHeaderCell>Severitate</TableHeaderCell>
            <TableHeaderCell>Recomandare</TableHeaderCell>
            <TableHeaderCell>Acțiune</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.id}>
              <TableCell>{issue.title}</TableCell>
              <TableCell>{issue.invoice?.invoiceNumber || issue.invoice?.id || '-'}</TableCell>
              <TableCell>{issue.apartment ? `Apt. ${issue.apartment.number}${issue.apartment.building ? ` · ${issue.apartment.building}` : ''}` : '-'}</TableCell>
              <TableCell><Badge variant={severityVariant[issue.severity]}>{issue.blocking ? 'Blocant' : issue.severity}</Badge></TableCell>
              <TableCell>{issue.recommendation}</TableCell>
              <TableCell>
                {issue.invoice?.id ? <Button type="button" size="sm" variant="secondary" onClick={() => onOpen(issue.invoice!.id)}>Deschide factura</Button> : null}
              </TableCell>
            </TableRow>
          ))}
          {!issues.length ? <TableEmpty colSpan={6}>Nu există probleme critice detectate.</TableEmpty> : null}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}

function PeriodsTable({ periods, localizedPath }: { periods: any[]; localizedPath: (path: string) => string }) {
  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Perioadă</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Facturi</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
            <TableHeaderCell>Probleme</TableHeaderCell>
            <TableHeaderCell>Actualizat</TableHeaderCell>
            <TableHeaderCell>Acțiuni</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {periods.map((period) => (
            <TableRow key={period.id}>
              <TableCell>{period.title || monthLabel(`${period.year}-${String(period.month).padStart(2, '0')}`)}</TableCell>
              <TableCell><Badge variant={period.status === 'APPROVED' ? 'success' : period.status === 'PUBLISHED' ? 'default' : 'neutral'}>{period.status}</Badge></TableCell>
              <TableCell>{period.invoicesCount || 0}</TableCell>
              <TableCell>{formatMdl(period.totalAmount || 0)}</TableCell>
              <TableCell>{period.issuesCount || 0}</TableCell>
              <TableCell>{formatDate(period.updatedAt)}</TableCell>
              <TableCell>
                <a className="inline-flex h-9 items-center justify-center rounded-2xl border border-border/70 bg-white px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted/80" href={localizedPath(`/admin/invoices?billingPeriodId=${period.id}`)}>
                  Deschide facturi
                </a>
              </TableCell>
            </TableRow>
          ))}
          {!periods.length ? <TableEmpty colSpan={7}>Nu există perioade de facturare.</TableEmpty> : null}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 ${strong ? 'text-lg font-semibold' : 'font-medium'} text-foreground`}>{value}</p>
    </div>
  );
}

function apartmentLabel(invoice: Pick<InvoiceRow, 'apartment'>) {
  const apartment = invoice.apartment;
  if (!apartment) return '-';
  const number = apartment.apartmentNumber || apartment.number || '-';
  const building = apartment.building?.name ? ` · ${apartment.building.name}` : '';
  const staircase = apartment.staircase?.name || apartment.entrance?.name ? ` · sc. ${apartment.staircase?.name || apartment.entrance?.name}` : '';
  return `Apt. ${number}${building}${staircase}`;
}

function contactLabel(invoice: Pick<InvoiceRow, 'resident' | 'owner'>) {
  const contact = invoice.resident || invoice.owner;
  if (!contact) return '-';
  return contact.name || contact.phone || contact.email || '-';
}

function monthLabelFromPeriod(period?: InvoiceRow['billingPeriod']) {
  if (!period) return '-';
  return monthLabel(`${period.year}-${String(period.month).padStart(2, '0')}`);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}
