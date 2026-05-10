'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, Info, RefreshCw, Search, TriangleAlert } from 'lucide-react';
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
import { auditLogsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type AuditSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  billingRunId?: string | null;
  severity: AuditSeverity;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: unknown;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  actor?: { id: string; fullName: string; email?: string | null; role?: string | null } | null;
  createdAt: string;
};

type AuditResponse = {
  items: AuditLogItem[];
  meta: { page: number; limit: number; total: number };
  stats: { total: number; today: number; warnings: number; errors: number; billingActions?: number; lastActivityAt?: string | null };
  association?: { id: string; shortName: string; associationCode?: string | null } | null;
  billingRun?: { id: string; billingMonth: string; status: string; warningsCount?: number; errorsCount?: number; updatedAt?: string } | null;
};

const severityLabel: Record<AuditSeverity, string> = {
  INFO: 'Info',
  SUCCESS: 'Succes',
  WARNING: 'Avertizare',
  ERROR: 'Eroare',
};

const severityVariant: Record<AuditSeverity, 'neutral' | 'success' | 'warning' | 'error'> = {
  INFO: 'neutral',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

const severityIcon = {
  INFO: Info,
  SUCCESS: CheckCircle2,
  WARNING: TriangleAlert,
  ERROR: CircleAlert,
} as const;

const actionLabels: Record<string, string> = {
  BILLING_RUN_CREATED: 'Proces pornit',
  BILLING_RUN_PRECHECK_RUN: 'Verificări rulate',
  BILLING_RUN_STATUS_CHANGED: 'Status proces',
  BILLING_RUN_CANCELLED: 'Proces anulat',
  DRAFT_CALCULATED: 'Draft calculat',
  DRAFT_RECALCULATED: 'Draft recalculat',
  DRAFT_LINE_EXCLUDED: 'Linie exclusă',
  DRAFT_LINE_INCLUDED: 'Linie inclusă',
  DRAFT_MANUAL_ADJUSTMENT_ADDED: 'Ajustare adăugată',
  DRAFT_MANUAL_ADJUSTMENT_UPDATED: 'Ajustare actualizată',
  DRAFT_MANUAL_ADJUSTMENT_REMOVED: 'Ajustare eliminată',
  DRAFT_LOCKED: 'Draft blocat',
  DRAFT_CANCELLED: 'Draft anulat',
  INVOICES_FINALIZED: 'Facturi generate',
  PAYMENT_RECORDED: 'Plată înregistrată',
  PAYMENT_CANCELLED: 'Plată anulată',
  TARIFF_CREATED: 'Tarif creat',
  TARIFF_UPDATED: 'Tarif actualizat',
  TARIFF_STATUS_CHANGED: 'Status tarif',
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ro-MD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDateGroup(value: string) {
  return new Intl.DateTimeFormat('ro-MD', { dateStyle: 'full' }).format(new Date(value));
}

function normalizeActionUrl(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('/ro/') || url.startsWith('/ru/') || url.startsWith('/en/')) return url.replace(/^\/(ro|ru|en)/, '');
  return url;
}

function safeJson(value: unknown) {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function unwrap<T>(res: any): T {
  return res?.data || res;
}

function AuditFilters({
  filters,
  onChange,
  onRefresh,
}: {
  filters: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onRefresh: () => void;
}) {
  function setField(key: string, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-6">
        <Input label="Search" value={filters.search || ''} onChange={(event) => setField('search', event.target.value)} placeholder="titlu, mesaj, actor" />
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>Acțiune</span>
          <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={filters.action || ''} onChange={(event) => setField('action', event.target.value)}>
            <option value="">Toate</option>
            {Object.keys(actionLabels).map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>Entitate</span>
          <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={filters.entityType || ''} onChange={(event) => setField('entityType', event.target.value)}>
            <option value="">Toate</option>
            {['BILLING_RUN', 'INVOICE_DRAFT', 'INVOICE_DRAFT_LINE', 'INTERNAL_INVOICE', 'PAYMENT', 'TARIFF', 'METER_READING'].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span>Severitate</span>
          <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={filters.severity || ''} onChange={(event) => setField('severity', event.target.value)}>
            <option value="">Toate</option>
            {Object.keys(severityLabel).map((severity) => <option key={severity} value={severity}>{severityLabel[severity as AuditSeverity]}</option>)}
          </select>
        </label>
        <Input label="De la" type="date" value={filters.dateFrom || ''} onChange={(event) => setField('dateFrom', event.target.value)} />
        <div className="flex items-end gap-2">
          <Input label="Până la" type="date" value={filters.dateTo || ''} onChange={(event) => setField('dateTo', event.target.value)} />
          <Button variant="secondary" onClick={onRefresh} aria-label="Actualizează">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DetailModal({ item, onClose }: { item: AuditLogItem | null; onClose: () => void }) {
  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} maxWidth="lg">
      <ModalHeader title={item?.title || 'Detalii log'} onClose={onClose} />
      <ModalBody className="space-y-4">
        {item ? (
          <>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p><span className="text-muted-foreground">Acțiune:</span> <span className="font-medium text-foreground">{item.action}</span></p>
              <p><span className="text-muted-foreground">Entitate:</span> <span className="font-medium text-foreground">{item.entityType}</span></p>
              <p><span className="text-muted-foreground">Actor:</span> <span className="font-medium text-foreground">{item.actor?.fullName || 'Sistem'}</span></p>
              <p><span className="text-muted-foreground">Data:</span> <span className="font-medium text-foreground">{formatDateTime(item.createdAt)}</span></p>
            </div>
            <p className="text-sm text-muted-foreground">{item.message}</p>
            <div className="grid gap-3">
              <JsonBlock title="Metadata" value={item.metadata} />
              <JsonBlock title="Înainte" value={item.beforeSnapshot} />
              <JsonBlock title="După" value={item.afterSnapshot} />
            </div>
          </>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Închide</Button>
      </ModalFooter>
    </Modal>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{safeJson(value)}</pre>
    </div>
  );
}

function AuditStats({ data }: { data: AuditResponse }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      <StatCard label="Total loguri" value={data.stats?.total || 0} />
      <StatCard label="Astăzi" value={data.stats?.today || 0} />
      <StatCard label="Warnings" value={data.stats?.warnings || 0} />
      <StatCard label="Errors" value={data.stats?.errors || 0} />
      <StatCard label="Ultima activitate" value={data.stats?.lastActivityAt ? formatDateTime(data.stats.lastActivityAt) : '—'} />
    </div>
  );
}

function AuditTable({ items, onDetails }: { items: AuditLogItem[]; onDetails: (item: AuditLogItem) => void }) {
  const localizedPath = useLocalizedPath();

  return (
    <TableWrapper>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Data</TableHeaderCell>
            <TableHeaderCell>Actor</TableHeaderCell>
            <TableHeaderCell>Acțiune</TableHeaderCell>
            <TableHeaderCell>Entitate</TableHeaderCell>
            <TableHeaderCell>Mesaj</TableHeaderCell>
            <TableHeaderCell>Severitate</TableHeaderCell>
            <TableHeaderCell>Link</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!items.length ? (
            <TableEmpty colSpan={7}>Nu există loguri de activitate.</TableEmpty>
          ) : null}
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(item.createdAt)}</TableCell>
              <TableCell>{item.actor?.fullName || 'Sistem'}</TableCell>
              <TableCell>{actionLabels[item.action] || item.action}</TableCell>
              <TableCell><span className="font-mono text-xs">{item.entityType}</span></TableCell>
              <TableCell>
                <button type="button" className="text-left font-medium text-foreground hover:text-primary" onClick={() => onDetails(item)}>
                  {item.title}
                </button>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
              </TableCell>
              <TableCell><Badge variant={severityVariant[item.severity]}>{severityLabel[item.severity]}</Badge></TableCell>
              <TableCell>
                {item.actionUrl ? (
                  <ButtonLink href={localizedPath(normalizeActionUrl(item.actionUrl))} size="sm" variant="secondary">Deschide</ButtonLink>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => onDetails(item)}>Detalii</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}

export function AdminAuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({ sortDirection: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await auditLogsApi.adminActivityList({ ...filters, limit: 50 });
      setData(unwrap<AuditResponse>(res));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca istoricul de activitate.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Istoric activitate"
        description="Urmărește acțiunile importante efectuate în asociație."
        rightSlot={<Button onClick={load} variant="secondary"><RefreshCw className="h-4 w-4" /> Actualizează</Button>}
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{data?.association?.shortName || 'APC'}</Badge>
        <Badge variant="neutral">{data?.association?.associationCode || 'Cod APC'}</Badge>
      </div>
      <AuditFilters filters={filters} onChange={setFilters} onRefresh={load} />
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {data ? <AuditStats data={data} /> : null}
      <Card className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Se încarcă istoricul...</div>
        ) : (
          <AuditTable items={data?.items || []} onDetails={setSelected} />
        )}
      </Card>
      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function BillingRunActivityPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const id = String(params?.id || '');
  const [data, setData] = useState<AuditResponse | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({ sortDirection: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await auditLogsApi.billingRunActivity(id, { ...filters, limit: 50 });
      setData(unwrap<AuditResponse>(res));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca activitatea procesului.'));
    } finally {
      setLoading(false);
    }
  }, [filters, id]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const items = data?.items || [];
    return items.reduce<Record<string, AuditLogItem[]>>((acc, item) => {
      const key = formatDateGroup(item.createdAt);
      acc[key] = [...(acc[key] || []), item];
      return acc;
    }, {});
  }, [data?.items]);

  return (
    <div className="space-y-6">
      <Link href={localizedPath(`/admin/billing/runs/${id}`)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Înapoi la proces
      </Link>
      <PageHeader
        title="Istoric proces lunar"
        description="Vezi toate acțiunile efectuate în acest proces de facturare."
        rightSlot={<Button onClick={load} variant="secondary"><RefreshCw className="h-4 w-4" /> Actualizează</Button>}
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{data?.association?.shortName || 'APC'}</Badge>
        <Badge variant="neutral">{data?.association?.associationCode || 'Cod APC'}</Badge>
        <Badge variant="neutral">{data?.billingRun?.billingMonth || 'Luna'}</Badge>
        <Badge variant="neutral">{data?.billingRun?.status || 'Status'}</Badge>
        <Badge variant="neutral">{data?.meta?.total || 0} activități</Badge>
      </div>
      <AuditFilters filters={filters} onChange={setFilters} onRefresh={load} />
      {error ? <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card> : null}
      {data ? <AuditStats data={data} /> : null}
      <Card className="p-5">
        {loading ? <p className="text-sm text-muted-foreground">Se încarcă activitatea...</p> : null}
        {!loading && !data?.items?.length ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">Nu există activitate înregistrată</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acțiunile importante din acest proces lunar vor apărea aici.</p>
          </div>
        ) : null}
        <div className="space-y-6">
          {Object.entries(groups).map(([day, items]) => (
            <section key={day} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarDays className="h-4 w-4" /> {day}
              </h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const Icon = severityIcon[item.severity] || Info;
                  return (
                    <article key={item.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                              <Badge variant={severityVariant[item.severity]}>{severityLabel[item.severity]}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {item.actor?.fullName || 'Sistem'} · {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(item)}>Detalii</Button>
                          {item.actionUrl ? <ButtonLink href={localizedPath(normalizeActionUrl(item.actionUrl))} size="sm" variant="secondary">Deschide</ButtonLink> : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>
      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
