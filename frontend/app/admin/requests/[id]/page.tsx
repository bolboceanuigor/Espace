'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, MessageCircle, StickyNote, UserRound, Wrench } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, PageHeader, StatCard } from '@/components/ui';
import LoadingState from '@/components/common/LoadingState';
import { filesApi, requestsApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusLabels: Record<string, string> = {
  NEW: 'Nouă',
  OPEN: 'Deschisă',
  IN_PROGRESS: 'În lucru',
  WAITING_RESIDENT: 'Așteaptă locatar',
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

export default function AdminRequestDetailsPage() {
  const params = useParams<{ id: string }>();
  const localizedPath = useLocalizedPath();
  const requestId = params?.id;
  const [request, setRequest] = useState<any>(null);
  const [association, setAssociation] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [publicComment, setPublicComment] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError('');
    try {
      const response = await requestsApi.adminGet(requestId);
      const nextRequest = response.data?.request || null;
      setRequest(nextRequest);
      setAssociation(response.data?.association || null);
      setStatus(nextRequest?.status || '');
      setPriority(nextRequest?.priority || '');
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

  const publicMessages = useMemo(() => (request?.messages || []).filter((entry: any) => entry.messageType !== 'INTERNAL_NOTE'), [request]);
  const internalNotes = useMemo(() => (request?.messages || []).filter((entry: any) => entry.messageType === 'INTERNAL_NOTE'), [request]);

  if (loading) {
    return <LoadingState label="Se încarcă solicitarea..." rows={6} />;
  }

  if (!request) {
    return (
      <div className="space-y-5 pb-6">
        <ButtonLink href="/admin/requests" variant="secondary">
          <ArrowLeft className="h-4 w-4" />
          Înapoi la solicitări
        </ButtonLink>
        <Card className="p-6">
          <h1 className="font-semibold text-foreground">Solicitarea nu a fost găsită</h1>
          <p className="mt-2 text-sm text-muted-foreground">Solicitarea solicitată nu există sau nu aparține asociației tale.</p>
        </Card>
      </div>
    );
  }

  const isReadonly = ['CANCELLED'].includes(request.status);
  const connectRequestHref = `/admin/connect?new=1&type=SERVICE_TICKET&relatedServiceTicketId=${encodeURIComponent(request.id)}${request.apartment?.id ? `&apartmentId=${encodeURIComponent(request.apartment.id)}` : ''}&subject=${encodeURIComponent(`Discuție despre ${request.requestNumber}`)}`;

  return (
    <div className="space-y-5 overflow-x-hidden pb-6">
      <Link href={localizedPath('/admin/requests')} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la solicitări
      </Link>

      <PageHeader
        title={request.title}
        description={`${request.requestNumber} · ${association?.shortName || 'A.P.C.'} · Apt. ${request.apartment?.apartmentNumber || '—'}`}
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant={statusVariant(request.status)}>{statusLabels[request.status] || request.status}</Badge>
            <Badge variant={priorityVariant(request.priority)}>{priorityLabels[request.priority] || request.priority}</Badge>
          </div>
        }
      />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Status" value={statusLabels[request.status] || request.status} icon={<Clock3 className="h-5 w-5" />} tone={request.status === 'RESOLVED' || request.status === 'CLOSED' ? 'success' : 'warning'} />
        <StatCard label="Prioritate" value={priorityLabels[request.priority] || request.priority} icon={<Wrench className="h-5 w-5" />} tone={request.priority === 'URGENT' ? 'danger' : request.priority === 'HIGH' ? 'warning' : 'neutral'} />
        <StatCard label="Locatar" value={request.resident?.fullName || '—'} icon={<UserRound className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Creată" value={formatDate(request.createdAt)} tone="neutral" />
      </section>

      <Card className="p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Status
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} disabled={isReadonly}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Prioritate
            <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)} disabled={isReadonly}>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="secondary"
              isLoading={saving === 'status'}
              disabled={isReadonly || status === request.status}
              onClick={() => runAction('status', async () => requestsApi.adminUpdateStatus(request.id, status), 'Statusul a fost actualizat.')}
            >
              Salvează status
            </Button>
            <Button
              variant="secondary"
              isLoading={saving === 'priority'}
              disabled={isReadonly || priority === request.priority}
              onClick={() => runAction('priority', async () => requestsApi.adminUpdatePriority(request.id, priority), 'Prioritatea a fost actualizată.')}
            >
              Salvează prioritate
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" isLoading={saving === 'assign'} disabled={isReadonly} onClick={() => runAction('assign', async () => requestsApi.adminAssign(request.id), 'Solicitarea a fost asignată către tine.')}>
            Preia solicitarea
          </Button>
          <Button variant="secondary" isLoading={saving === 'resolve'} disabled={isReadonly || request.status === 'RESOLVED'} onClick={() => runAction('resolve', async () => requestsApi.adminResolve(request.id, { message: 'Problema a fost rezolvată.' }), 'Solicitarea a fost marcată ca rezolvată.')}>
            <CheckCircle2 className="h-4 w-4" />
            Marchează rezolvată
          </Button>
          <Button variant="secondary" isLoading={saving === 'close'} disabled={isReadonly || request.status === 'CLOSED'} onClick={() => runAction('close', async () => requestsApi.adminClose(request.id, { message: 'Ticket închis.' }), 'Solicitarea a fost închisă.')}>
            Închide
          </Button>
          <Button variant="danger" isLoading={saving === 'cancel'} disabled={isReadonly} onClick={() => runAction('cancel', async () => requestsApi.adminCancel(request.id, { reason: 'Cerere anulată de administrator.' }), 'Solicitarea a fost anulată.')}>
            Anulează
          </Button>
          {(request.status === 'CLOSED' || request.status === 'RESOLVED') ? (
            <Button variant="secondary" isLoading={saving === 'reopen'} onClick={() => runAction('reopen', async () => requestsApi.adminReopen(request.id), 'Solicitarea a fost redeschisă.')}>
              Redeschide
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
          <SectionTitle title="Date solicitare" description="Contextul transmis de locatar." />
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <InfoLine label="Categorie" value={categoryLabels[request.category] || request.category} />
            <InfoLine label="Locație" value={request.locationText || request.locationDetails || 'Necompletat'} />
            <InfoLine label="Metodă contact" value={request.preferredContactMethod || 'Necompletat'} />
            <InfoLine label="Asignat" value={request.assignedTo?.fullName || 'Neasignată'} />
            <InfoLine label="Scadență" value={formatDate(request.dueDate)} />
          </div>
          <p className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm leading-7 text-muted-foreground">{request.description}</p>
          {request.attachmentUrl ? (
            <a
              href={request.attachmentFileAssetId ? filesApi.secureDownloadUrl(request.attachmentFileAssetId) : request.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-2xl border border-border/70 px-4 py-2 text-sm font-semibold hover:bg-muted/60"
            >
              Deschide atașamentul
            </a>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {request.apartment?.id ? <ButtonLink href={`/admin/apartments/${request.apartment.id}`} variant="secondary">Vezi apartament</ButtonLink> : null}
            {request.resident?.id ? <ButtonLink href={`/admin/residents/${request.resident.id}`} variant="secondary">Vezi locatar</ButtonLink> : null}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Timeline statusuri" description="Istoricul schimbărilor de status." />
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

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Comentarii publice" description="Vizibile pentru locatar și administrație." />
          <MessageList messages={publicMessages} />
          <div className="mt-4 space-y-3">
            <textarea
              className="min-h-28 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
              value={publicComment}
              onChange={(event) => setPublicComment(event.target.value)}
              placeholder="Răspunde locatarului"
            />
            <Button
              isLoading={saving === 'public-comment'}
              disabled={!publicComment.trim()}
              onClick={() => {
                const value = publicComment.trim();
                void runAction('public-comment', async () => requestsApi.adminAddComment(request.id, { message: value }), 'Răspunsul a fost adăugat.');
                setPublicComment('');
              }}
            >
              <MessageCircle className="h-4 w-4" />
              Trimite răspuns
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Note interne" description="Vizibile doar pentru administratori." />
          <MessageList messages={internalNotes} emptyLabel="Nu există note interne." />
          <div className="mt-4 space-y-3">
            <textarea
              className="min-h-28 w-full rounded-2xl border border-border/70 bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Adaugă o notă internă"
            />
            <Button
              variant="secondary"
              isLoading={saving === 'internal-note'}
              disabled={!internalNote.trim()}
              onClick={() => {
                const value = internalNote.trim();
                void runAction('internal-note', async () => requestsApi.adminAddInternalNote(request.id, { message: value }), 'Nota internă a fost adăugată.');
                setInternalNote('');
              }}
            >
              <StickyNote className="h-4 w-4" />
              Adaugă notă internă
            </Button>
          </div>
        </Card>
      </section>
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

function MessageList({ messages, emptyLabel = 'Nu există comentarii.' }: { messages: any[]; emptyLabel?: string }) {
  if (!messages.length) {
    return <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {messages.map((entry) => (
        <div key={entry.id} className="rounded-2xl border border-border/70 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{entry.author?.name || 'Utilizator'}</p>
            <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.message}</p>
        </div>
      ))}
    </div>
  );
}
