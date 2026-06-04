'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, MessageCircle, Paperclip, XCircle } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import LoadingState from '@/components/common/LoadingState';
import { filesApi, requestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = {
  NEW: 'Nouă',
  OPEN: 'Deschisă',
  IN_PROGRESS: 'În lucru',
  WAITING_RESIDENT: 'Așteaptă răspunsul tău',
  WAITING_VENDOR: 'Așteaptă prestator',
  RESOLVED: 'Rezolvată',
  CLOSED: 'Închisă',
  CANCELLED: 'Anulată',
};

const categoryLabels: Record<string, string> = {
  REPAIR: 'Reparație',
  WATER_LEAK: 'Scurgere apă',
  ELECTRICITY: 'Electricitate',
  ELEVATOR: 'Lift',
  CLEANING: 'Curățenie',
  HEATING: 'Încălzire',
  INTERCOM: 'Interfon',
  PARKING: 'Parcare',
  COURTYARD: 'Curte',
  DOCUMENTS: 'Documente',
  PAYMENT: 'Plăți',
  METER: 'Contoare',
  NEIGHBOR_ISSUE: 'Vecini / zgomot',
  GENERAL_QUESTION: 'Întrebare generală',
  OTHER: 'Altceva',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Înaltă',
  URGENT: 'Urgentă',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-MD', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function statusVariant(status?: string) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success';
  if (status === 'CANCELLED') return 'neutral';
  if (status === 'WAITING_RESIDENT' || status === 'WAITING_VENDOR') return 'warning';
  return 'warning';
}

function priorityVariant(priority?: string) {
  if (priority === 'URGENT') return 'error';
  if (priority === 'HIGH') return 'warning';
  return 'neutral';
}

export default function ResidentRequestDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const requestId = params?.id;
  const [request, setRequest] = useState<any>(null);
  const [association, setAssociation] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError('');
    try {
      const response = await requestsApi.residentGet(requestId);
      setRequest(response.data?.request || null);
      setAssociation(response.data?.association || null);
    } catch (err: any) {
      setError(String(err?.message || 'Solicitarea nu a fost găsită.'));
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: string, callback: () => Promise<any>, success: string) => {
    setSaving(action);
    setError('');
    setMessage('');
    try {
      await callback();
      setMessage(success);
      await load();
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut salva modificarea.'));
    } finally {
      setSaving('');
    }
  };

  const submitComment = async () => {
    if (!requestId || !comment.trim()) return;
    await runAction(
      'comment',
      async () => requestsApi.residentAddComment(requestId, { message: comment.trim() }),
      'Comentariul a fost adăugat.',
    );
    setComment('');
  };

  const publicMessages = useMemo(() => (request?.messages || []).filter((entry: any) => entry.messageType === 'PUBLIC_COMMENT'), [request]);

  if (loading) {
    return <LoadingState label="Se încarcă solicitarea..." rows={5} />;
  }

  if (!request) {
    return (
      <div className="space-y-5 pb-24 md:pb-6">
        <ButtonLink href="/resident/requests" variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          Înapoi la solicitări
        </ButtonLink>
        <Card className="p-6">
          <h1 className="font-semibold text-foreground">Solicitarea nu a fost găsită</h1>
          <p className="mt-2 text-sm text-muted-foreground">Solicitarea solicitată nu există sau nu aparține contului tău.</p>
        </Card>
      </div>
    );
  }

  const canCancel = ['NEW', 'OPEN'].includes(request.status);
  const canMarkResolved = ['WAITING_RESIDENT', 'IN_PROGRESS', 'OPEN'].includes(request.status);
  const canClose = request.status === 'RESOLVED';
  const canReopen = ['RESOLVED', 'CLOSED'].includes(request.status);
  const canComment = !['CLOSED', 'CANCELLED'].includes(request.status);
  const connectRequestHref = `/resident/connect?new=1&type=SERVICE_TICKET&relatedServiceTicketId=${encodeURIComponent(request.id)}${request.apartment?.id ? `&apartmentId=${encodeURIComponent(request.apartment.id)}` : ''}&subject=${encodeURIComponent(`Discuție despre ${request.requestNumber}`)}`;

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:pb-6">
      <Link href={localizedPath('/resident/requests')} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la solicitări
      </Link>

      <PageHeader
        title={request.title}
        description={`${request.requestNumber} · ${association?.shortName || 'A.P.C.'}`}
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant={statusVariant(request.status)}>{statusLabels[request.status] || request.status}</Badge>
            <Badge variant={priorityVariant(request.priority)}>{priorityLabels[request.priority] || request.priority}</Badge>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Status" value={statusLabels[request.status] || request.status} icon={<Clock3 className="h-5 w-5" />} tone={request.status === 'RESOLVED' || request.status === 'CLOSED' ? 'success' : 'warning'} />
        <StatCard label="Categorie" value={categoryLabels[request.category] || request.category} tone="neutral" />
        <StatCard label="Apartament" value={request.apartment?.apartmentNumber ? `Apt. ${request.apartment.apartmentNumber}` : '—'} tone="neutral" />
        <StatCard label="Creată" value={formatDate(request.createdAt)} icon={<MessageCircle className="h-5 w-5" />} />
      </section>

      <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          {canMarkResolved ? (
            <Button
              variant="secondary"
              isLoading={saving === 'resolved'}
              onClick={() => runAction('resolved', async () => requestsApi.residentMarkResolved(request.id), 'Solicitarea a fost marcată ca rezolvată.')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Marchează ca rezolvată
            </Button>
          ) : null}
          {canClose ? (
            <Button
              variant="secondary"
              isLoading={saving === 'close'}
              onClick={() => runAction('close', async () => requestsApi.residentClose(request.id), 'Solicitarea a fost închisă.')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Închide solicitarea
            </Button>
          ) : null}
          {canReopen ? (
            <Button
              variant="secondary"
              isLoading={saving === 'reopen'}
              onClick={() => runAction('reopen', async () => requestsApi.residentReopen(request.id, { message: 'Problema a reapărut.' }), 'Solicitarea a fost redeschisă.')}
            >
              Redeschide
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="danger"
              isLoading={saving === 'cancel'}
              onClick={() => runAction('cancel', async () => requestsApi.residentCancel(request.id), 'Solicitarea a fost anulată.')}
            >
              <XCircle className="h-4 w-4" />
              Anulează
            </Button>
          ) : null}
          <ButtonLink href={connectRequestHref} variant="secondary">
            <MessageCircle className="h-4 w-4" />
            Continuă în Connect
          </ButtonLink>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Card className="p-5">
          <SectionTitle title="Detalii solicitare" description="Informațiile trimise către administrație." />
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <InfoLine label="Categorie" value={categoryLabels[request.category] || request.category} />
            <InfoLine label="Prioritate" value={priorityLabels[request.priority] || request.priority} />
            <InfoLine label="Locație" value={request.locationText || request.locationDetails || 'Necompletat'} />
            <InfoLine label="Metodă contact" value={request.preferredContactMethod || 'Necompletat'} />
          </div>
          <p className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm leading-7 text-muted-foreground">{request.description}</p>
          {request.attachmentUrl ? (
            <a
              href={request.attachmentFileAssetId ? filesApi.secureDownloadUrl(request.attachmentFileAssetId) : request.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm font-semibold text-foreground hover:bg-white"
            >
              <Paperclip className="h-4 w-4" />
              Deschide atașamentul
            </a>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/25 p-4 text-sm text-muted-foreground">
              <Paperclip className="mb-2 h-4 w-4" />
              Nu există atașamente pentru această cerere.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Timeline" description="Evoluția statusului solicitării." />
          <div className="space-y-3">
            {(request.timeline || []).map((entry: any, index: number) => (
              <div key={`${entry.createdAt}-${index}`} className="rounded-2xl border border-border/70 bg-white p-3">
                <p className="text-sm font-semibold text-foreground">{entry.message || 'Status actualizat'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.oldStatus ? `${statusLabels[entry.oldStatus] || entry.oldStatus} → ` : ''}
                  {statusLabels[entry.newStatus] || entry.newStatus} · {formatDate(entry.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <SectionTitle title="Răspunsuri și comentarii" description="Conversația vizibilă pentru tine și administrație." />
        <div className="space-y-3">
          {publicMessages.map((entry: any) => (
            <div key={entry.id} className="rounded-2xl border border-border/70 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{entry.author?.name || 'Utilizator'}</p>
                <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.message}</p>
            </div>
          ))}
          {!publicMessages.length ? <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">Nu există încă răspunsuri.</p> : null}
        </div>
        <div className="mt-4 space-y-3">
          <textarea
            className="min-h-28 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Adaugă un comentariu pentru administrație"
            disabled={!canComment}
          />
          <Button onClick={submitComment} isLoading={saving === 'comment'} disabled={!comment.trim() || !canComment}>
            <MessageCircle className="h-4 w-4" />
            Trimite comentariu
          </Button>
          {!canComment ? <p className="text-xs text-muted-foreground">Cererea este închisă sau anulată și nu mai acceptă comentarii.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
