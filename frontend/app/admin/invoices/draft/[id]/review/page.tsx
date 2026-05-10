'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calculator, CheckCircle2, Eye, LockKeyhole, Pencil, Plus, RefreshCw, Save, Trash2, TriangleAlert, WalletCards, XCircle } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

type DraftStatus = 'DRAFT' | 'LOCKED' | 'CANCELLED';
type LineStatus = 'READY' | 'WARNING' | 'ERROR' | 'EXCLUDED';
type ManualType = 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION';

type DraftLine = {
  id: string;
  lineType: 'TARIFF' | 'MANUAL' | 'ADJUSTMENT';
  tariffId: string | null;
  isManual?: boolean;
  manualType?: ManualType | null;
  name: string;
  description: string;
  calculationType: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  formulaLabel: string;
  status: LineStatus;
  warnings: string[];
};

type DraftItem = {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  staircase: string;
  floor: string | null;
  areaM2: number | null;
  primaryContact: { id: string; fullName: string; phone: string | null } | null;
  lines: DraftLine[];
  total: number;
  status: LineStatus;
  warnings: string[];
  internalNotes?: string;
};

type ReviewData = {
  draft: {
    id: string;
    billingMonth: string;
    status: DraftStatus;
    currency: 'MDL';
    totalAmount: number;
    includedAmount: number;
    excludedAmount: number;
    apartmentsCount: number;
    includedApartments: number;
    excludedApartments: number;
    warningsCount: number;
    errorsCount: number;
    tariffLinesCount: number;
    createdAt: string;
    createdById?: string | null;
    lockedAt?: string | null;
    lockedById?: string | null;
    cancelledAt?: string | null;
    cancelledById?: string | null;
  };
  association: {
    id: string;
    shortName: string;
    associationCode: string;
  };
  checklist: Array<{ key: string; label: string; status: 'COMPLETE' | 'WARNING' | 'BLOCKED' }>;
  canLock: boolean;
  requiresWarningConfirmation: boolean;
  items: DraftItem[];
  warnings: string[];
};

const statusLabels: Record<LineStatus, string> = {
  READY: 'Gata',
  WARNING: 'Avertizare',
  ERROR: 'Eroare',
  EXCLUDED: 'Exclus',
};

const statusVariant = {
  READY: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  EXCLUDED: 'neutral',
} as const;

const draftStatusVariant = {
  DRAFT: 'warning',
  LOCKED: 'success',
  CANCELLED: 'neutral',
} as const;

const checklistIcons = {
  COMPLETE: CheckCircle2,
  WARNING: TriangleAlert,
  BLOCKED: XCircle,
} as const;

const emptyAdjustment = {
  name: '',
  description: '',
  amount: '',
  type: 'MANUAL_ADJUSTMENT' as ManualType,
  status: 'READY' as 'READY' | 'EXCLUDED',
};

export default function InvoiceDraftReviewPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const draftId = String(params?.id || '');
  const [data, setData] = useState<ReviewData | null>(null);
  const [selected, setSelected] = useState<DraftItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lockOpen, setLockOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(false);

  const readOnly = data?.draft.status === 'LOCKED' || data?.draft.status === 'CANCELLED';

  const loadReview = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    setError('');
    try {
      const res = await invoicesApi.draftReview(draftId);
      setData(res.data || null);
    } catch (err: any) {
      setData(null);
      setError(String(err?.message || 'Nu am putut încărca draftul.'));
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const selectedItem = useMemo(() => {
    if (!selected || !data) return selected;
    return data.items.find((item) => item.apartmentId === selected.apartmentId) || selected;
  }, [data, selected]);

  async function runAction(key: string, action: () => Promise<void>, successMessage: string) {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await action();
      await loadReview();
      setMessage(successMessage);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva modificările.'));
    } finally {
      setBusy('');
    }
  }

  const recalculateDraft = () =>
    runAction('recalculate', () => invoicesApi.draftRecalculate(draftId).then(() => undefined), 'Draftul a fost recalculat.');

  const cancelDraft = () =>
    runAction('cancel', () => invoicesApi.draftCancel(draftId).then(() => undefined), 'Draftul a fost anulat.');

  const setApartmentStatus = (item: DraftItem, status: 'READY' | 'EXCLUDED') =>
    runAction(
      `apt:${item.apartmentId}`,
      () => invoicesApi.draftUpdateApartmentStatus(draftId, item.apartmentId, status).then(() => undefined),
      status === 'EXCLUDED' ? 'Apartamentul a fost exclus temporar.' : 'Apartamentul a fost inclus în draft.',
    );

  const setLineStatus = (line: DraftLine, status: 'READY' | 'EXCLUDED') =>
    runAction(
      `line:${line.id}`,
      () => invoicesApi.draftUpdateLineStatus(draftId, line.id, status).then(() => undefined),
      status === 'EXCLUDED' ? 'Linia a fost exclusă temporar.' : 'Linia a fost inclusă în draft.',
    );

  const recalculateApartment = (item: DraftItem) =>
    runAction(
      `recalculate:${item.apartmentId}`,
      () => invoicesApi.draftRecalculateApartment(draftId, item.apartmentId).then(() => undefined),
      'Apartamentul a fost recalculat.',
    );

  const saveAdjustment = (item: DraftItem, lineId: string | null, form: typeof emptyAdjustment) => {
    const amount = Number(form.amount);
    if (!form.name.trim()) {
      setError('Numele ajustării este obligatoriu.');
      return Promise.resolve();
    }
    if (!Number.isFinite(amount)) {
      setError('Suma ajustării trebuie să fie un număr.');
      return Promise.resolve();
    }
    return runAction(
      lineId ? `adjust:${lineId}` : `adjust:${item.apartmentId}`,
      () =>
        (lineId
          ? invoicesApi.draftUpdateAdjustment(draftId, lineId, {
              name: form.name.trim(),
              description: form.description.trim(),
              amount,
              type: form.type,
              status: form.status,
            })
          : invoicesApi.draftAddAdjustment(draftId, item.apartmentId, {
              name: form.name.trim(),
              description: form.description.trim(),
              amount,
              type: form.type,
              status: form.status,
            })
        ).then(() => undefined),
      lineId ? 'Ajustarea a fost actualizată.' : 'Ajustarea a fost adăugată.',
    );
  };

  const deleteAdjustment = (line: DraftLine) =>
    runAction(`delete:${line.id}`, () => invoicesApi.draftDeleteAdjustment(draftId, line.id).then(() => undefined), 'Ajustarea a fost eliminată din draft.');

  async function lockDraft() {
    await runAction(
      'lock',
      () =>
        invoicesApi
          .draftLock(draftId, {
            understood,
            confirmWarnings: data?.requiresWarningConfirmation ? confirmWarnings : undefined,
          })
          .then(() => undefined),
      'Draftul a fost blocat.',
    );
    setLockOpen(false);
  }

  if (!loading && !data) {
    return (
      <div className="space-y-5 pb-8">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Draftul nu a fost găsit</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Reveniți la calculul draftului și selectați luna dorită.</p>
          <Link href={localizedPath('/admin/invoices/draft')} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background">
            Înapoi la calcul draft
          </Link>
        </Card>
      </div>
    );
  }

  const draft = data?.draft;

  return (
    <div className="space-y-5 pb-8">
      <Link href={localizedPath('/admin/invoices/draft')} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la calcul draft
      </Link>

      <PageHeader
        title="Revizuire draft facturi"
        description="Verifică sumele calculate înainte de blocarea draftului."
        rightSlot={
          draft ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{data?.association.shortName || 'A.P.C.'} · {data?.association.associationCode || 'cod necompletat'}</Badge>
              <Badge variant={draftStatusVariant[draft.status]}>{draft.status}</Badge>
              <Badge variant="neutral">{draft.billingMonth} · MDL</Badge>
            </div>
          ) : null
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {data?.warnings?.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{data.warnings.join(' ')}</div> : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1 text-sm text-muted-foreground">
            <span>Creat: {formatDate(draft?.createdAt)}</span>
            <span>Creat de: {draft?.createdById || 'Nespecificat'}</span>
            {draft?.lockedAt ? <span>Blocat: {formatDate(draft.lockedAt)} · {draft.lockedById || ''}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={recalculateDraft} isLoading={busy === 'recalculate'} disabled={readOnly || !draft}>
              <RefreshCw className="h-4 w-4" />
              Recalculează draft
            </Button>
            <Button variant="secondary" onClick={loadReview} disabled={!draft}>
              <Save className="h-4 w-4" />
              Salvează modificări
            </Button>
            <Button onClick={() => setLockOpen(true)} disabled={!data?.canLock || readOnly || !draft}>
              <LockKeyhole className="h-4 w-4" />
              Blochează draft
            </Button>
            <Button variant="danger" onClick={cancelDraft} isLoading={busy === 'cancel'} disabled={readOnly || !draft}>
              <Trash2 className="h-4 w-4" />
              Anulează draft
            </Button>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Apartamente în draft" value={draft?.apartmentsCount || 0} description="Total rânduri" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Incluse" value={draft?.includedApartments || 0} description={formatMdl(draft?.includedAmount || 0)} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Excluse" value={draft?.excludedApartments || 0} description={formatMdl(draft?.excludedAmount || 0)} icon={<XCircle className="h-5 w-5" />} tone="warning" />
        <StatCard label="Total inclus" value={formatMdl(draft?.totalAmount || 0)} description="Nu este factură finală" icon={<Calculator className="h-5 w-5" />} />
        <StatCard label="Avertizări" value={draft?.warningsCount || 0} description="Pot fi blocate cu confirmare" icon={<TriangleAlert className="h-5 w-5" />} tone={draft?.warningsCount ? 'warning' : 'neutral'} />
        <StatCard label="Erori" value={draft?.errorsCount || 0} description="Blochează lock-ul" icon={<TriangleAlert className="h-5 w-5" />} tone={draft?.errorsCount ? 'danger' : 'neutral'} />
        <StatCard label="Linii tarifare" value={draft?.tariffLinesCount || 0} description="Generate + manuale" icon={<Pencil className="h-5 w-5" />} />
        <StatCard label="Status" value={draft?.status || '-'} description="Etapa curentă" icon={<LockKeyhole className="h-5 w-5" />} />
      </section>

      <Card>
        <h2 className="text-base font-semibold text-foreground">Checklist de verificare</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(data?.checklist || []).map((item) => {
            const Icon = checklistIcons[item.status];
            return (
              <div key={item.key} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3">
                <Icon className={`h-5 w-5 ${item.status === 'COMPLETE' ? 'text-emerald-600' : item.status === 'WARNING' ? 'text-amber-600' : 'text-rose-600'}`} />
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => <Card key={item} className="h-24 animate-pulse bg-muted/40" />)}
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="hidden overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)] xl:block">
            <div className="grid grid-cols-[0.85fr_0.6fr_0.55fr_0.8fr_1.1fr_0.9fr_0.8fr_1.3fr_0.85fr_1.45fr] gap-3 border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Apartament</span>
              <span>Scara</span>
              <span>Etaj</span>
              <span>Suprafață</span>
              <span>Contact principal</span>
              <span>Total calculat</span>
              <span>Status</span>
              <span>Avertizări</span>
              <span>Inclus</span>
              <span>Acțiuni</span>
            </div>
            {data.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[0.85fr_0.6fr_0.55fr_0.8fr_1.1fr_0.9fr_0.8fr_1.3fr_0.85fr_1.45fr] items-center gap-3 border-b border-border/50 px-4 py-4 text-sm last:border-b-0">
                <strong className="text-foreground">Apt. {item.apartmentNumber}</strong>
                <span className="text-muted-foreground">{item.staircase || '-'}</span>
                <span className="text-muted-foreground">{item.floor || '-'}</span>
                <span className="text-muted-foreground">{item.areaM2 ? `${item.areaM2} m²` : '-'}</span>
                <span className="text-muted-foreground">{item.primaryContact?.fullName || '-'}</span>
                <strong className="text-foreground">{formatMdl(item.status === 'EXCLUDED' ? 0 : item.total)}</strong>
                <Badge variant={statusVariant[item.status]}>{statusLabels[item.status]}</Badge>
                <span className="text-xs text-muted-foreground">{item.warnings.length ? item.warnings.join(' ') : '-'}</span>
                <span>{item.status === 'EXCLUDED' ? 'Nu' : 'Da'}</span>
                <RowActions item={item} readOnly={Boolean(readOnly)} busy={busy} onOpen={() => setSelected(item)} onStatus={setApartmentStatus} onRecalculate={recalculateApartment} />
              </div>
            ))}
          </section>

          <section className="grid gap-3 xl:hidden">
            {data.items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Apt. {item.apartmentNumber}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Scara {item.staircase || '-'} · Etaj {item.floor || '-'}</p>
                  </div>
                  <Badge variant={statusVariant[item.status]}>{statusLabels[item.status]}</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <Info label="Suprafață" value={item.areaM2 ? `${item.areaM2} m²` : '-'} />
                  <Info label="Contact principal" value={item.primaryContact?.fullName || '-'} />
                  <Info label="Total calculat" value={formatMdl(item.status === 'EXCLUDED' ? 0 : item.total)} strong />
                  <Info label="Avertizări" value={item.warnings.length ? item.warnings.join(' ') : '-'} />
                </div>
                <div className="mt-4">
                  <RowActions item={item} readOnly={Boolean(readOnly)} busy={busy} onOpen={() => setSelected(item)} onStatus={setApartmentStatus} onRecalculate={recalculateApartment} />
                </div>
              </Card>
            ))}
          </section>
        </>
      ) : null}

      <DraftItemModal
        item={selectedItem}
        readOnly={Boolean(readOnly)}
        busy={busy}
        onClose={() => setSelected(null)}
        onLineStatus={setLineStatus}
        onSaveAdjustment={saveAdjustment}
        onDeleteAdjustment={deleteAdjustment}
      />

      <Modal isOpen={lockOpen} onClose={() => setLockOpen(false)} maxWidth="lg">
        <ModalHeader title="Blochează draft" onClose={() => setLockOpen(false)} />
        <ModalBody>
          <div className="space-y-3 rounded-2xl bg-muted/35 px-4 py-4 text-sm">
            <Info label="Luna" value={draft?.billingMonth || '-'} />
            <Info label="Apartamente incluse" value={String(draft?.includedApartments || 0)} />
            <Info label="Total sumă" value={formatMdl(draft?.totalAmount || 0)} strong />
            <Info label="Avertizări rămase" value={String(draft?.warningsCount || 0)} />
          </div>
          {data?.requiresWarningConfirmation ? (
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              <input type="checkbox" checked={confirmWarnings} onChange={(event) => setConfirmWarnings(event.target.checked)} />
              Confirm că am verificat avertizările rămase.
            </label>
          ) : null}
          <label className="mt-3 flex items-start gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm font-medium text-foreground">
            <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
            Înțeleg că după blocare draftul nu va mai putea fi modificat direct.
          </label>
          <p className="mt-4 text-xs text-muted-foreground">Blocarea nu creează facturi finale și nu trimite nimic către locatari.</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setLockOpen(false)}>Anulează</Button>
          <Button onClick={lockDraft} isLoading={busy === 'lock'} disabled={!understood || (data?.requiresWarningConfirmation && !confirmWarnings)}>
            Blochează draft
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function RowActions({
  item,
  readOnly,
  busy,
  onOpen,
  onStatus,
  onRecalculate,
}: {
  item: DraftItem;
  readOnly: boolean;
  busy: string;
  onOpen: () => void;
  onStatus: (item: DraftItem, status: 'READY' | 'EXCLUDED') => void;
  onRecalculate: (item: DraftItem) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={onOpen} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">
        <Eye className="mr-1 inline h-3.5 w-3.5" />
        Deschide
      </button>
      <button type="button" onClick={() => onStatus(item, item.status === 'EXCLUDED' ? 'READY' : 'EXCLUDED')} disabled={readOnly || busy === `apt:${item.apartmentId}`} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60 disabled:opacity-60">
        {item.status === 'EXCLUDED' ? 'Include' : 'Exclude'}
      </button>
      <button type="button" onClick={() => onRecalculate(item)} disabled={readOnly || busy === `recalculate:${item.apartmentId}`} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60 disabled:opacity-60">
        Recalculează
      </button>
    </div>
  );
}

function DraftItemModal({
  item,
  readOnly,
  busy,
  onClose,
  onLineStatus,
  onSaveAdjustment,
  onDeleteAdjustment,
}: {
  item: DraftItem | null;
  readOnly: boolean;
  busy: string;
  onClose: () => void;
  onLineStatus: (line: DraftLine, status: 'READY' | 'EXCLUDED') => void;
  onSaveAdjustment: (item: DraftItem, lineId: string | null, form: typeof emptyAdjustment) => Promise<void>;
  onDeleteAdjustment: (line: DraftLine) => void;
}) {
  const [form, setForm] = useState(emptyAdjustment);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  useEffect(() => {
    setForm(emptyAdjustment);
    setEditingLineId(null);
  }, [item?.apartmentId]);

  if (!item) return null;

  const submitAdjustment = async () => {
    await onSaveAdjustment(item, editingLineId, form);
    setForm(emptyAdjustment);
    setEditingLineId(null);
  };

  const startEdit = (line: DraftLine) => {
    setEditingLineId(line.id);
    setForm({
      name: line.name,
      description: line.description || '',
      amount: String(line.amount),
      type: line.manualType || 'MANUAL_ADJUSTMENT',
      status: line.status === 'EXCLUDED' ? 'EXCLUDED' : 'READY',
    });
  };

  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={`Apt. ${item.apartmentNumber}`} onClose={onClose} />
      <ModalBody>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Scara" value={item.staircase || '-'} />
          <Info label="Etaj" value={item.floor || '-'} />
          <Info label="Suprafață" value={item.areaM2 ? `${item.areaM2} m²` : '-'} />
          <Info label="Contact principal" value={item.primaryContact?.fullName || '-'} />
        </div>

        <div className="mt-4 space-y-2">
          {item.lines.map((line) => (
            <div key={line.id} className="rounded-2xl border border-border/70 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{line.name} {line.isManual ? <span className="text-xs text-muted-foreground">(manual)</span> : null}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{line.formulaLabel} = {formatMdl(line.amount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Cantitate {line.quantity} · Preț unitar {formatMdl(line.unitPrice)}</p>
                </div>
                <Badge variant={statusVariant[line.status]}>{statusLabels[line.status]}</Badge>
              </div>
              {line.description ? <p className="mt-2 text-xs text-muted-foreground">{line.description}</p> : null}
              {line.warnings.length ? <p className="mt-2 text-xs font-medium text-amber-700">{line.warnings.join(' ')}</p> : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button type="button" disabled={readOnly || busy === `line:${line.id}`} onClick={() => onLineStatus(line, line.status === 'EXCLUDED' ? 'READY' : 'EXCLUDED')} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60 disabled:opacity-60">
                  {line.status === 'EXCLUDED' ? 'Include linia' : 'Exclude linia'}
                </button>
                {line.isManual ? (
                  <>
                    <button type="button" disabled={readOnly} onClick={() => startEdit(line)} className="rounded-xl border border-border/70 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60">
                      Editează ajustare
                    </button>
                    <button type="button" disabled={readOnly || busy === `delete:${line.id}`} onClick={() => onDeleteAdjustment(line)} className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
                      Șterge ajustare
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {!readOnly ? (
          <div className="mt-5 rounded-2xl border border-border/70 bg-muted/20 p-4">
            <h3 className="text-sm font-semibold text-foreground">{editingLineId ? 'Editează ajustare manuală' : 'Adaugă ajustare manuală'}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="Nume" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <Input label="Sumă MDL" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Tip</span>
                <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ManualType })}>
                  <option value="MANUAL_ADJUSTMENT">Ajustare manuală</option>
                  <option value="DISCOUNT">Reducere</option>
                  <option value="CORRECTION">Corecție</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Status</span>
                <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-4 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as 'READY' | 'EXCLUDED' })}>
                  <option value="READY">Inclusă</option>
                  <option value="EXCLUDED">Exclusă</option>
                </select>
              </label>
              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Descriere</span>
                <textarea className="min-h-20 w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={submitAdjustment} isLoading={busy === `adjust:${item.apartmentId}` || Boolean(editingLineId && busy === `adjust:${editingLineId}`)}>
                <Plus className="h-4 w-4" />
                {editingLineId ? 'Salvează ajustarea' : 'Adaugă ajustare'}
              </Button>
              {editingLineId ? <Button variant="secondary" onClick={() => { setEditingLineId(null); setForm(emptyAdjustment); }}>Anulează editarea</Button> : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-4">
          <p className="text-sm text-muted-foreground">Total apartament</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatMdl(item.status === 'EXCLUDED' ? 0 : item.total)}</p>
        </div>
        <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted/35 px-4 py-4 text-sm text-muted-foreground">
          {item.internalNotes || 'Nu există note interne pentru acest calcul.'}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Închide</Button>
      </ModalFooter>
    </Modal>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2 text-sm">
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
