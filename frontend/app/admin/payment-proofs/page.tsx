'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileCheck2, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
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
import { paymentsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PaymentProofStatus = 'SUBMITTED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'PARTIALLY_ACCEPTED' | 'CANCELLED';

type PaymentProof = {
  id: string;
  proofId?: string;
  invoiceId: string;
  invoiceNumber?: string | null;
  invoice?: { invoiceNumber?: string | null; totalAmount?: number; remainingAmount?: number } | null;
  apartment?: { apartmentNumber?: string | null; number?: string | null; building?: { name?: string | null } | null; staircase?: { name?: string | null } | null } | null;
  resident?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  owner?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  amount: number;
  acceptedAmount?: number | null;
  currency: 'MDL';
  method: string;
  status: PaymentProofStatus;
  paidAt?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
  proofFileUrl?: string | null;
  proofFileName?: string | null;
  externalReference?: string | null;
  residentNote?: string | null;
  adminNote?: string | null;
  rejectionReason?: string | null;
  remainingAmount?: number | null;
  warnings?: PaymentProofIssue[];
  existingPayments?: Array<{ id: string; amount: number; status: string; paidAt?: string | null }>;
};

type PaymentProofIssue = {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  recommendation: string;
  blocking: boolean;
  proof?: { id?: string } | null;
  invoice?: { id?: string; invoiceNumber?: string | null } | null;
  apartment?: { apartmentNumber?: string | null; number?: string | null } | null;
};

type Overview = {
  totalProofs: number;
  submittedProofs: number;
  inReviewProofs: number;
  acceptedProofs: number;
  rejectedProofs: number;
  partiallyAcceptedProofs: number;
  totalAcceptedAmount: number;
  warningsCount: number;
  criticalIssuesCount: number;
};

const emptyOverview: Overview = {
  totalProofs: 0,
  submittedProofs: 0,
  inReviewProofs: 0,
  acceptedProofs: 0,
  rejectedProofs: 0,
  partiallyAcceptedProofs: 0,
  totalAcceptedAmount: 0,
  warningsCount: 0,
  criticalIssuesCount: 0,
};

const statusLabels: Record<PaymentProofStatus, string> = {
  SUBMITTED: 'Trimise',
  IN_REVIEW: 'În verificare',
  ACCEPTED: 'Acceptate',
  PARTIALLY_ACCEPTED: 'Acceptate parțial',
  REJECTED: 'Respinse',
  CANCELLED: 'Anulate',
};

const statusVariants: Record<PaymentProofStatus, 'default' | 'warning' | 'success' | 'neutral' | 'error'> = {
  SUBMITTED: 'default',
  IN_REVIEW: 'warning',
  ACCEPTED: 'success',
  PARTIALLY_ACCEPTED: 'warning',
  REJECTED: 'error',
  CANCELLED: 'neutral',
};

const methodLabels: Record<string, string> = {
  MANUAL_BANK_TRANSFER: 'Transfer bancar',
  BANK_TRANSFER: 'Transfer bancar',
  CASH: 'Cash',
  TERMINAL: 'Terminal',
  CARD_EXTERNAL: 'Card extern',
  OTHER: 'Altă metodă',
};

export default function AdminPaymentProofsPage() {
  const localizedPath = useLocalizedPath();
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [rows, setRows] = useState<PaymentProof[]>([]);
  const [issues, setIssues] = useState<PaymentProofIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [activeProof, setActiveProof] = useState<PaymentProof | null>(null);
  const [acceptProof, setAcceptProof] = useState<PaymentProof | null>(null);
  const [rejectProof, setRejectProof] = useState<PaymentProof | null>(null);
  const [acceptForm, setAcceptForm] = useState({ acceptedAmount: '', paidAt: new Date().toISOString().slice(0, 10), externalReference: '', adminNote: '', confirm: false });
  const [rejectForm, setRejectForm] = useState({ rejectionReason: '', adminNote: '', confirm: false });

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      paymentsApi.getAdminPaymentProofs({ status: status || undefined, method: method || undefined, search: search || undefined, page: 1, limit: 100 }),
      paymentsApi.getAdminPaymentProofsOverview(),
      paymentsApi.getAdminPaymentProofIssues({ page: 1, limit: 100 }),
    ])
      .then(([listRes, overviewRes, issuesRes]) => {
        setRows(listRes.data?.items || []);
        setOverview(overviewRes.data || emptyOverview);
        setIssues(issuesRes.data?.items || []);
      })
      .catch((err: any) => setError(String(err?.message || 'Nu am putut încărca dovezile de plată.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, method]);

  async function openDetail(proof: PaymentProof) {
    setActionLoading(true);
    setError('');
    try {
      const res = await paymentsApi.getAdminPaymentProof(proof.id);
      setActiveProof(res.data?.proof || proof);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut deschide dovada.'));
    } finally {
      setActionLoading(false);
    }
  }

  async function startReview(proof: PaymentProof) {
    setActionLoading(true);
    setError('');
    try {
      const res = await paymentsApi.startAdminPaymentProofReview(proof.id);
      const updated = res.data?.proof as PaymentProof | undefined;
      if (updated) {
        setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setActiveProof((current) => (current?.id === updated.id ? updated : current));
      }
      load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut începe verificarea.'));
    } finally {
      setActionLoading(false);
    }
  }

  function openAccept(proof: PaymentProof) {
    const amount = proof.remainingAmount && proof.remainingAmount > 0 ? Math.min(proof.amount, proof.remainingAmount) : proof.amount;
    setAcceptForm({ acceptedAmount: String(amount), paidAt: proof.paidAt?.slice(0, 10) || new Date().toISOString().slice(0, 10), externalReference: proof.externalReference || '', adminNote: '', confirm: false });
    setAcceptProof(proof);
  }

  async function acceptSelectedProof() {
    if (!acceptProof || !acceptForm.confirm) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await paymentsApi.acceptAdminPaymentProof(acceptProof.id, {
        acceptedAmount: Number(acceptForm.acceptedAmount),
        paidAt: acceptForm.paidAt,
        externalReference: acceptForm.externalReference || undefined,
        adminNote: acceptForm.adminNote || undefined,
      });
      const updated = res.data?.proof as PaymentProof | undefined;
      if (updated) {
        setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setActiveProof((current) => (current?.id === updated.id ? updated : current));
      }
      setAcceptProof(null);
      load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut accepta dovada.'));
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectSelectedProof() {
    if (!rejectProof || !rejectForm.confirm || !rejectForm.rejectionReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await paymentsApi.rejectAdminPaymentProof(rejectProof.id, {
        rejectionReason: rejectForm.rejectionReason,
        adminNote: rejectForm.adminNote || undefined,
      });
      const updated = res.data?.proof as PaymentProof | undefined;
      if (updated) {
        setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setActiveProof((current) => (current?.id === updated.id ? updated : current));
      }
      setRejectProof(null);
      load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut respinge dovada.'));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Dovezi plăți"
        description="Verifică dovezile de plată trimise de locatari."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ButtonLink href="/admin/payment-proofs?tab=issues" variant="secondary">
              <AlertTriangle className="h-4 w-4" />
              Vezi probleme
            </ButtonLink>
            <ButtonLink href="/admin/invoices">
              <FileTextIcon />
              Mergi la facturi
            </ButtonLink>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Trimise" value={overview.submittedProofs} description="Așteaptă verificare" icon={<FileCheck2 className="h-5 w-5" />} />
        <StatCard label="În verificare" value={overview.inReviewProofs} description="Deschise de admin" icon={<ClockIcon />} tone={overview.inReviewProofs ? 'warning' : 'neutral'} />
        <StatCard label="Acceptate" value={overview.acceptedProofs + overview.partiallyAcceptedProofs} description="Au creat payment" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Respinse" value={overview.rejectedProofs} description="Cu motiv vizibil" icon={<XCircle className="h-5 w-5" />} tone={overview.rejectedProofs ? 'danger' : 'neutral'} />
        <StatCard label="Total acceptat" value={formatMdl(overview.totalAcceptedAmount || 0)} description="Din dovezi verificate" icon={<FileCheck2 className="h-5 w-5" />} />
        <StatCard label="Probleme" value={overview.criticalIssuesCount + overview.warningsCount} description={`${overview.criticalIssuesCount} critice`} icon={<AlertTriangle className="h-5 w-5" />} tone={overview.criticalIssuesCount ? 'danger' : overview.warningsCount ? 'warning' : 'neutral'} />
      </section>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_auto]">
          <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Factură, locatar, referință..." />
          <Select label="Status" value={status} onChange={setStatus} options={([['', 'Toate'], ...Object.entries(statusLabels)] as Array<[string, string]>)} />
          <Select label="Metodă" value={method} onChange={setMethod} options={([['', 'Toate'], ['MANUAL_BANK_TRANSFER', 'Transfer bancar'], ['CASH', 'Cash'], ['TERMINAL', 'Terminal'], ['CARD_EXTERNAL', 'Card extern'], ['OTHER', 'Altă metodă']] as Array<[string, string]>)} />
          <Button type="button" variant="secondary" onClick={load} className="self-end">
            <Search className="h-4 w-4" />
            Caută
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </Card>

      <TableWrapper>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Dovadă</TableHeaderCell>
              <TableHeaderCell>Factură</TableHeaderCell>
              <TableHeaderCell>Apartament</TableHeaderCell>
              <TableHeaderCell>Locatar</TableHeaderCell>
              <TableHeaderCell>Sumă</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Data plății</TableHeaderCell>
              <TableHeaderCell>Acțiuni</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableEmpty colSpan={8}>Se încarcă dovezile...</TableEmpty> : null}
            {!loading && !rows.length ? <TableEmpty colSpan={8}>Nu există dovezi de plată trimise.</TableEmpty> : null}
            {!loading && rows.map((proof) => (
              <TableRow key={proof.id}>
                <TableCell>
                  <button type="button" onClick={() => openDetail(proof)} className="text-left font-semibold text-primary hover:underline">
                    {proof.id.slice(0, 8)}
                  </button>
                  {proof.warnings?.length ? <p className="mt-1 text-xs text-amber-700">{proof.warnings.length} warning-uri</p> : null}
                </TableCell>
                <TableCell>
                  <Link className="font-medium text-primary hover:underline" href={localizedPath(`/admin/invoices/${proof.invoiceId}`)}>
                    {proof.invoiceNumber || proof.invoice?.invoiceNumber || '-'}
                  </Link>
                </TableCell>
                <TableCell>Apt. {proof.apartment?.apartmentNumber || proof.apartment?.number || '-'}</TableCell>
                <TableCell>{proof.resident?.name || proof.resident?.email || proof.owner?.name || '-'}</TableCell>
                <TableCell>
                  <p className="font-semibold">{formatMdl(proof.amount)}</p>
                  <p className="text-xs text-muted-foreground">{methodLabels[proof.method] || proof.method}</p>
                </TableCell>
                <TableCell><Badge variant={statusVariants[proof.status]}>{statusLabels[proof.status] || proof.status}</Badge></TableCell>
                <TableCell>{formatDate(proof.paidAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => openDetail(proof)}>
                      <Eye className="h-4 w-4" />
                      Deschide
                    </Button>
                    {proof.status === 'SUBMITTED' ? <Button type="button" size="sm" variant="secondary" onClick={() => startReview(proof)}>Începe</Button> : null}
                    {proof.status === 'SUBMITTED' || proof.status === 'IN_REVIEW' ? (
                      <>
                        <Button type="button" size="sm" onClick={() => openAccept(proof)}>Acceptă</Button>
                        <Button type="button" size="sm" variant="danger" onClick={() => setRejectProof(proof)}>Respinge</Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>

      {issues.length ? (
        <Card>
          <h2 className="font-semibold text-foreground">Probleme detectate</h2>
          <div className="mt-3 grid gap-2">
            {issues.slice(0, 8).map((issue) => (
              <div key={issue.id} className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{issue.title}</p>
                  <Badge variant={issue.severity === 'CRITICAL' ? 'error' : issue.severity === 'WARNING' ? 'warning' : 'neutral'}>{issue.severity}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{issue.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Modal isOpen={Boolean(activeProof)} onClose={() => setActiveProof(null)} maxWidth="2xl">
        <ModalHeader title="Detalii dovadă plată" onClose={() => setActiveProof(null)} />
        <ModalBody className="space-y-4">
          {activeProof ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Info label="Factură" value={activeProof.invoiceNumber || activeProof.invoice?.invoiceNumber || '-'} />
                <Info label="Sumă declarată" value={formatMdl(activeProof.amount)} strong />
                <Info label="Rămas pe factură" value={formatMdl(activeProof.remainingAmount || 0)} />
                <Info label="Metodă" value={methodLabels[activeProof.method] || activeProof.method} />
                <Info label="Data plății" value={formatDate(activeProof.paidAt)} />
                <Info label="Referință" value={activeProof.externalReference || '-'} />
              </div>
              {activeProof.proofFileUrl ? (
                <a href={activeProof.proofFileUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-primary hover:underline">
                  Deschide dovada atașată
                </a>
              ) : (
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Nu există fișier/link dovadă. Verifică manual referința sau cere clarificări.</p>
              )}
              {activeProof.residentNote ? <Info label="Notă locatar" value={activeProof.residentNote} /> : null}
              {activeProof.adminNote ? <Info label="Notă admin" value={activeProof.adminNote} /> : null}
              {activeProof.warnings?.length ? (
                <div className="grid gap-2">
                  {activeProof.warnings.map((warning) => (
                    <div key={warning.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-semibold">{warning.title}</p>
                      <p className="mt-1">{warning.recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setActiveProof(null)}>Închide</Button>
          {activeProof?.status === 'SUBMITTED' ? <Button type="button" variant="secondary" onClick={() => startReview(activeProof)} disabled={actionLoading}>Începe verificarea</Button> : null}
          {activeProof && (activeProof.status === 'SUBMITTED' || activeProof.status === 'IN_REVIEW') ? (
            <>
              <Button type="button" onClick={() => openAccept(activeProof)}>Acceptă</Button>
              <Button type="button" variant="danger" onClick={() => setRejectProof(activeProof)}>Respinge</Button>
            </>
          ) : null}
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(acceptProof)} onClose={() => setAcceptProof(null)} maxWidth="lg">
        <ModalHeader title="Acceptă dovada plății" onClose={() => setAcceptProof(null)} />
        <ModalBody className="space-y-4">
          {acceptProof ? (
            <div className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
              Factura {acceptProof.invoiceNumber || acceptProof.invoice?.invoiceNumber || '-'} · declarat {formatMdl(acceptProof.amount)} · rămas {formatMdl(acceptProof.remainingAmount || 0)}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Suma acceptată" type="number" min="0" step="0.01" value={acceptForm.acceptedAmount} onChange={(event) => setAcceptForm((current) => ({ ...current, acceptedAmount: event.target.value }))} />
            <Input label="Data plății" type="date" value={acceptForm.paidAt} onChange={(event) => setAcceptForm((current) => ({ ...current, paidAt: event.target.value }))} />
          </div>
          <Input label="Referință externă" value={acceptForm.externalReference} onChange={(event) => setAcceptForm((current) => ({ ...current, externalReference: event.target.value }))} />
          <TextArea label="Notă internă" value={acceptForm.adminNote} onChange={(value) => setAcceptForm((current) => ({ ...current, adminNote: value }))} />
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="mt-1" checked={acceptForm.confirm} onChange={(event) => setAcceptForm((current) => ({ ...current, confirm: event.target.checked }))} />
            Confirm că am verificat dovada plății.
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setAcceptProof(null)}>Renunță</Button>
          <Button type="button" onClick={acceptSelectedProof} disabled={!acceptForm.confirm || actionLoading}>
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Acceptă
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(rejectProof)} onClose={() => setRejectProof(null)} maxWidth="lg">
        <ModalHeader title="Respinge dovada plății" onClose={() => setRejectProof(null)} />
        <ModalBody className="space-y-4">
          <TextArea label="Motiv respingere" value={rejectForm.rejectionReason} onChange={(value) => setRejectForm((current) => ({ ...current, rejectionReason: value }))} />
          <TextArea label="Notă internă" value={rejectForm.adminNote} onChange={(value) => setRejectForm((current) => ({ ...current, adminNote: value }))} />
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="mt-1" checked={rejectForm.confirm} onChange={(event) => setRejectForm((current) => ({ ...current, confirm: event.target.checked }))} />
            Confirm că locatarul va vedea motivul respingerii.
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setRejectProof(null)}>Renunță</Button>
          <Button type="button" variant="danger" onClick={rejectSelectedProof} disabled={!rejectForm.confirm || !rejectForm.rejectionReason.trim() || actionLoading}>
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Respinge
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm text-foreground" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([key, itemLabel]) => <option key={key || 'all'} value={key}>{itemLabel}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea className="min-h-24 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm text-foreground" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words ${strong ? 'font-semibold' : 'font-medium'} text-foreground`}>{value}</p>
    </div>
  );
}

function FileTextIcon() {
  return <FileCheck2 className="h-4 w-4" />;
}

function ClockIcon() {
  return <Loader2 className="h-5 w-5" />;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
