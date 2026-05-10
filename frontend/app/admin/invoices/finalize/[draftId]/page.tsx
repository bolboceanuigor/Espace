'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileCheck2, FileText, LockKeyhole, TriangleAlert, WalletCards } from 'lucide-react';
import { Badge, Button, Card, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type FinalizeSummary = {
  draft: {
    id: string;
    billingMonth: string;
    status: 'DRAFT' | 'LOCKED' | 'CANCELLED';
    currency: 'MDL';
    includedApartments: number;
    includedAmount: number;
    totalAmount: number;
    lockedAt?: string | null;
    lockedById?: string | null;
    finalizedAt?: string | null;
    invoicesGenerated?: boolean;
    invoicesCount?: number;
  };
  association: {
    id: string;
    shortName: string;
    legalName?: string;
    associationCode: string;
  };
  eligibility: {
    canFinalize: boolean;
    reasons: string[];
  };
  preview: {
    invoicesToCreate: number;
    totalAmount: number;
    firstInvoiceNumber: string;
    lastInvoiceNumber: string;
  };
};

const statusVariant = {
  DRAFT: 'warning',
  LOCKED: 'success',
  CANCELLED: 'neutral',
} as const;

export default function FinalizeInternalInvoicesPage() {
  const params = useParams<{ draftId: string }>();
  const draftId = String(params?.draftId || '');
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const [summary, setSummary] = useState<FinalizeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSummary = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    setError('');
    try {
      const res = await invoicesApi.finalizeSummary(draftId);
      setSummary(res.data || null);
    } catch (err: any) {
      setSummary(null);
      setError(String(err?.message || 'Nu am putut încărca sumarul de finalizare.'));
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const draft = summary?.draft;
  const reasons = useMemo(() => summary?.eligibility.reasons || [], [summary]);

  async function finalizeDraft() {
    if (!draftId || !understood) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await invoicesApi.finalizeDraft(draftId);
      const billingMonth = res.data?.billingMonth || draft?.billingMonth;
      setMessage('Facturile interne au fost generate.');
      setConfirmOpen(false);
      router.push(localizedPath(`/admin/invoices${billingMonth ? `?billingMonth=${billingMonth}` : ''}`));
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut genera facturile finale.'));
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !summary) {
    return (
      <div className="space-y-5 pb-8">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Draftul nu a fost găsit</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Reveniți la revizuirea draftului și verificați statusul înainte de finalizare.</p>
          <Link href={localizedPath('/admin/invoices/draft')} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
            Înapoi la calcul draft
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath(`/admin/invoices/draft/${draftId}/review`)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la review draft
      </Link>

      <PageHeader
        title="Finalizare facturi interne"
        description="Transformă draftul blocat în facturi interne finale pentru apartamente."
        rightSlot={
          draft ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{summary?.association.shortName || 'A.P.C.'} · {summary?.association.associationCode || 'cod necompletat'}</Badge>
              <Badge variant={statusVariant[draft.status]}>{draft.status}</Badge>
              <Badge variant="neutral">{draft.billingMonth} · MDL</Badge>
            </div>
          ) : null
        }
      />

      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      {summary ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draft blocat</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{summary.association.shortName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Luna {summary.draft.billingMonth} · blocat {formatDate(summary.draft.lockedAt)} · {summary.draft.lockedById || 'utilizator nespecificat'}
                </p>
              </div>
              <Button onClick={() => setConfirmOpen(true)} disabled={!summary.eligibility.canFinalize || busy}>
                <FileCheck2 className="h-4 w-4" />
                Generează facturi finale
              </Button>
            </div>
          </Card>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Facturi de creat" value={summary.preview.invoicesToCreate} description="Apartamente incluse" icon={<FileText className="h-5 w-5" />} />
            <StatCard label="Total sumă" value={formatMdl(summary.preview.totalAmount)} description="Valoare finală internă" icon={<WalletCards className="h-5 w-5" />} />
            <StatCard label="Prima factură" value={summary.preview.firstInvoiceNumber} description="Număr intern" icon={<FileCheck2 className="h-5 w-5" />} />
            <StatCard label="Ultima factură" value={summary.preview.lastInvoiceNumber} description="Număr intern" icon={<FileCheck2 className="h-5 w-5" />} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <h2 className="text-base font-semibold text-foreground">Condiții de finalizare</h2>
              {summary.eligibility.canFinalize ? (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-5 w-5" />
                  Draftul este eligibil pentru generarea facturilor interne finale.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {reasons.map((reason) => (
                    <div key={reason} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                      <TriangleAlert className="mt-0.5 h-5 w-5" />
                      {reason}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-base font-semibold text-foreground">Ce se va crea</h2>
              <div className="mt-4 grid gap-2 text-sm">
                <Info label="Status facturi" value="ISSUED" />
                <Info label="Achitat inițial" value={formatMdl(0)} />
                <Info label="Sold inițial" value={formatMdl(summary.preview.totalAmount)} strong />
                <Info label="Sursă" value="Draft blocat" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Nu se implementează plăți reale, BPay, e-Factura sau trimitere automată către locatari în acest pas.
              </p>
            </Card>
          </div>

          <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="lg">
            <ModalHeader title="Confirmă generarea facturilor" onClose={() => setConfirmOpen(false)} />
            <ModalBody>
              <div className="space-y-3 rounded-2xl bg-muted/35 px-4 py-4 text-sm">
                <Info label="Luna de facturare" value={summary.draft.billingMonth} />
                <Info label="Facturi create" value={String(summary.preview.invoicesToCreate)} />
                <Info label="Suma totală" value={formatMdl(summary.preview.totalAmount)} strong />
              </div>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                După generare, facturile interne vor deveni finale în sistem și nu vor mai putea fi modificate direct.
              </div>
              <label className="mt-3 flex items-start gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm font-medium text-foreground">
                <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
                Înțeleg că facturile vor fi create ca documente interne finale.
              </label>
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>Anulează</Button>
              <Button onClick={finalizeDraft} isLoading={busy} disabled={!understood || busy}>
                Confirmă și generează facturi
              </Button>
            </ModalFooter>
          </Modal>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>{value}</span>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ro-RO');
}
