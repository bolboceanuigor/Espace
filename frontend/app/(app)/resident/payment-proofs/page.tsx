'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock3, FileCheck2, FileText, RefreshCw, Search, XCircle } from 'lucide-react';
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
import { invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type PaymentProofStatus = 'SUBMITTED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'PARTIALLY_ACCEPTED' | 'CANCELLED';

type PaymentProof = {
  id: string;
  invoiceId: string;
  invoiceNumber?: string | null;
  invoice?: { invoiceNumber?: string | null } | null;
  apartment?: { apartmentNumber?: string | null; number?: string | null } | null;
  amount: number;
  acceptedAmount?: number | null;
  currency: 'MDL';
  method: string;
  status: PaymentProofStatus;
  paidAt?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
};

const statusLabels: Record<PaymentProofStatus, string> = {
  SUBMITTED: 'Trimisă',
  IN_REVIEW: 'În verificare',
  ACCEPTED: 'Acceptată',
  PARTIALLY_ACCEPTED: 'Acceptată parțial',
  REJECTED: 'Respinsă',
  CANCELLED: 'Anulată',
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

export default function ResidentPaymentProofsPage() {
  const localizedPath = useLocalizedPath();
  const [rows, setRows] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  function load() {
    setLoading(true);
    setError('');
    invoicesApi
      .getResidentPaymentProofs({ status: status || undefined, search: search || undefined, page: 1, limit: 100 })
      .then((res) => setRows(res.data?.items || []))
      .catch((err: any) => setError(String(err?.message || 'Nu am putut încărca dovezile de plată.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const submitted = rows.filter((row) => row.status === 'SUBMITTED' || row.status === 'IN_REVIEW').length;
  const rejected = rows.filter((row) => row.status === 'REJECTED').length;
  const accepted = rows.filter((row) => row.status === 'ACCEPTED' || row.status === 'PARTIALLY_ACCEPTED').length;

  async function cancelProof(proof: PaymentProof) {
    try {
      const res = await invoicesApi.cancelResidentPaymentProof(proof.id);
      const updated = res.data?.proof as PaymentProof | undefined;
      if (updated) setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut anula dovada.'));
    }
  }

  const filteredRows = search
    ? rows.filter((row) => [row.invoiceNumber, row.invoice?.invoiceNumber, row.method, row.rejectionReason].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Dovezi de plată"
        description="Urmărește dovezile trimise către administrație."
        rightSlot={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ButtonLink href="/resident/invoices">
              <FileText className="h-4 w-4" />
              Vezi facturi
            </ButtonLink>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total dovezi" value={rows.length} description="Trimise până acum" icon={<FileCheck2 className="h-5 w-5" />} />
        <StatCard label="În verificare" value={submitted} description="Așteaptă admin" icon={<Clock3 className="h-5 w-5" />} tone={submitted ? 'warning' : 'neutral'} />
        <StatCard label="Acceptate" value={accepted} description="Au creat plăți manuale" icon={<FileCheck2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Respinse" value={rejected} description="Necesită verificare" icon={<XCircle className="h-5 w-5" />} tone={rejected ? 'danger' : 'neutral'} />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Factură, metodă, motiv..." />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Toate</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
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
              <TableHeaderCell>Factura</TableHeaderCell>
              <TableHeaderCell>Apartament</TableHeaderCell>
              <TableHeaderCell>Sumă</TableHeaderCell>
              <TableHeaderCell>Metodă</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Trimisă</TableHeaderCell>
              <TableHeaderCell>Acțiuni</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableEmpty colSpan={7}>Se încarcă dovezile...</TableEmpty> : null}
            {!loading && !filteredRows.length ? <TableEmpty colSpan={7}>Nu ai trimis încă dovezi de plată.</TableEmpty> : null}
            {!loading && filteredRows.map((proof) => (
              <TableRow key={proof.id}>
                <TableCell>
                  <Link className="font-semibold text-primary hover:underline" href={localizedPath(`/resident/invoices/${proof.invoiceId}`)}>
                    {proof.invoiceNumber || proof.invoice?.invoiceNumber || proof.invoiceId.slice(0, 8)}
                  </Link>
                  {proof.rejectionReason ? <p className="mt-1 text-xs text-rose-700">{proof.rejectionReason}</p> : null}
                </TableCell>
                <TableCell>Apt. {proof.apartment?.apartmentNumber || proof.apartment?.number || '-'}</TableCell>
                <TableCell>
                  <p className="font-semibold">{formatMdl(proof.amount)}</p>
                  {proof.acceptedAmount ? <p className="text-xs text-muted-foreground">Acceptat: {formatMdl(proof.acceptedAmount)}</p> : null}
                </TableCell>
                <TableCell>{methodLabels[proof.method] || proof.method}</TableCell>
                <TableCell><Badge variant={statusVariants[proof.status]}>{statusLabels[proof.status] || proof.status}</Badge></TableCell>
                <TableCell>{formatDateTime(proof.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={`/resident/invoices/${proof.invoiceId}`} variant="secondary" size="sm">Factura</ButtonLink>
                    {proof.status === 'SUBMITTED' ? <Button type="button" variant="secondary" size="sm" onClick={() => cancelProof(proof)}>Anulează</Button> : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
