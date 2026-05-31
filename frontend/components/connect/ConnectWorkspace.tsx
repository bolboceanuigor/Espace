'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  Home,
  Inbox,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { connectApi } from '@/lib/api';
import { useLocalizedPath } from '@/lib/use-localized-path';

type ConnectMode = 'admin' | 'resident';

type ConversationStatus = 'OPEN' | 'PENDING_RESIDENT' | 'PENDING_ADMIN' | 'RESOLVED' | 'CLOSED' | 'ARCHIVED';
type ConversationType =
  | 'GENERAL'
  | 'APARTMENT'
  | 'INVOICE'
  | 'PAYMENT'
  | 'PAYMENT_PROOF'
  | 'METER_READING'
  | 'SERVICE_TICKET'
  | 'DOCUMENT'
  | 'ANNOUNCEMENT'
  | 'SYSTEM';
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

type ApartmentSummary = {
  id: string;
  number?: string | null;
  building?: { id: string; name?: string | null } | null;
  staircase?: { id: string; name?: string | null } | null;
};

type ResidentSummary = {
  id: string;
  name?: string | null;
  initials?: string | null;
  email?: string | null;
  phone?: string | null;
};

type Conversation = {
  id: string;
  subject?: string | null;
  type: ConversationType;
  status: ConversationStatus;
  priority: Priority;
  apartment?: ApartmentSummary | null;
  resident?: ResidentSummary | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount?: number;
  internalNote?: string | null;
  related?: Record<string, string | null | undefined>;
};

type ConnectMessage = {
  id: string;
  senderRole: 'ADMIN' | 'RESIDENT' | 'SUPERADMIN' | 'SYSTEM';
  senderName?: string | null;
  senderInitials?: string | null;
  messageType: 'TEXT' | 'SYSTEM' | 'ATTACHMENT' | 'IMAGE' | 'DOCUMENT';
  body?: string | null;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
};

type DetailPayload = {
  conversation: Conversation;
  messages: ConnectMessage[];
  context?: any;
  relatedSummary?: any;
};

type RecipientOption = {
  residentUserId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  apartment?: ApartmentSummary | null;
};

type ConnectWorkspaceProps = {
  mode: ConnectMode;
  conversationId?: string;
  prefill?: ConnectPrefill;
};

export type ConnectPrefill = {
  new?: boolean;
  type?: ConversationType;
  apartmentId?: string;
  subject?: string;
  relatedInvoiceId?: string;
  relatedServiceTicketId?: string;
  relatedMeterReadingId?: string;
  relatedPaymentProofId?: string;
};

const typeLabels: Record<ConversationType, string> = {
  GENERAL: 'General',
  APARTMENT: 'Apartament',
  INVOICE: 'Factură',
  PAYMENT: 'Plată',
  PAYMENT_PROOF: 'Dovadă plată',
  METER_READING: 'Citire contor',
  SERVICE_TICKET: 'Cerere',
  DOCUMENT: 'Document',
  ANNOUNCEMENT: 'Anunț',
  SYSTEM: 'Sistem',
};

const statusLabels: Record<ConversationStatus, string> = {
  OPEN: 'Deschis',
  PENDING_RESIDENT: 'Așteaptă locatar',
  PENDING_ADMIN: 'Așteaptă admin',
  RESOLVED: 'Rezolvat',
  CLOSED: 'Închis',
  ARCHIVED: 'Arhivat',
};

const priorityLabels: Record<Priority, string> = {
  LOW: 'Scăzută',
  NORMAL: 'Normală',
  HIGH: 'Ridicată',
  URGENT: 'Urgentă',
};

const statusBadgeMap: Record<ConversationStatus, string> = {
  OPEN: 'OPEN',
  PENDING_RESIDENT: 'WAITING_RESIDENT',
  PENDING_ADMIN: 'WAITING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  ARCHIVED: 'INACTIVE',
};

const typeOptions: ConversationType[] = ['GENERAL', 'INVOICE', 'PAYMENT', 'PAYMENT_PROOF', 'METER_READING', 'SERVICE_TICKET', 'DOCUMENT'];
const adminTypeOptions: ConversationType[] = [...typeOptions, 'APARTMENT', 'ANNOUNCEMENT'];
const priorityOptions: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function formatDateTime(value?: string | null) {
  if (!value) return 'Fără mesaje';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fără mesaje';
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function apartmentLabel(apartment?: ApartmentSummary | null) {
  if (!apartment) return 'Fără apartament';
  return [`Apt. ${apartment.number || '-'}`, apartment.staircase?.name, apartment.building?.name].filter(Boolean).join(' · ');
}

function money(value: unknown, currency = 'MDL') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function messageReceipt(message: ConnectMessage) {
  if (message.status === 'READ') return 'citit';
  if (message.status === 'DELIVERED') return 'livrat';
  if (message.status === 'FAILED') return 'eșuat';
  return 'trimis';
}

export default function ConnectWorkspace({ mode, conversationId, prefill }: ConnectWorkspaceProps) {
  const localizedPath = useLocalizedPath();
  const [overview, setOverview] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [apartments, setApartments] = useState<ApartmentSummary[]>([]);
  const [selectedId, setSelectedId] = useState(conversationId || '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [composer, setComposer] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [draft, setDraft] = useState({
    residentKey: '',
    apartmentId: '',
    type: 'GENERAL' as ConversationType,
    priority: 'NORMAL' as Priority,
    subject: '',
    body: '',
    relatedInvoiceId: '',
    relatedServiceTicketId: '',
    relatedMeterReadingId: '',
    relatedPaymentProofId: '',
  });

  const activeConversation = detail?.conversation || conversations.find((item) => item.id === selectedId) || null;
  const isClosed = activeConversation ? ['CLOSED', 'ARCHIVED'].includes(activeConversation.status) : false;
  const basePath = mode === 'admin' ? '/admin/connect' : '/resident/connect';

  useEffect(() => {
    if (prefillApplied || conversationId) return;
    const hasPrefill =
      Boolean(prefill?.new) ||
      Boolean(prefill?.type) ||
      Boolean(prefill?.relatedInvoiceId) ||
      Boolean(prefill?.relatedServiceTicketId) ||
      Boolean(prefill?.relatedMeterReadingId) ||
      Boolean(prefill?.relatedPaymentProofId) ||
      Boolean(prefill?.subject);
    if (!hasPrefill) return;
    const apartmentId = prefill?.apartmentId || '';
    if (mode === 'resident' && !apartmentId && !apartments.length) return;
    const requestedType = prefill?.type || null;
    const availableTypes = mode === 'admin' ? adminTypeOptions : typeOptions;
    const nextType = requestedType && availableTypes.includes(requestedType) ? requestedType : 'GENERAL';
    setDraft((current) => ({
      ...current,
      apartmentId: apartmentId || current.apartmentId || (mode === 'resident' ? apartments[0]?.id || '' : ''),
      type: nextType,
      subject: prefill?.subject || current.subject,
      relatedInvoiceId: prefill?.relatedInvoiceId || current.relatedInvoiceId,
      relatedServiceTicketId: prefill?.relatedServiceTicketId || current.relatedServiceTicketId,
      relatedMeterReadingId: prefill?.relatedMeterReadingId || current.relatedMeterReadingId,
      relatedPaymentProofId: prefill?.relatedPaymentProofId || current.relatedPaymentProofId,
    }));
    setNewOpen(true);
    setPrefillApplied(true);
  }, [apartments, conversationId, mode, prefill, prefillApplied]);

  const loadOverview = useCallback(async () => {
    const response = mode === 'admin' ? await connectApi.adminOverview() : await connectApi.residentOverview();
    setOverview(response.data);
    if (mode === 'resident') {
      setApartments(response.data?.apartments || []);
    }
  }, [mode]);

  const loadRecipients = useCallback(async () => {
    if (mode === 'admin') {
      const response = await connectApi.adminResidents();
      setRecipients(response.data || []);
      return;
    }
    const response = await connectApi.residentContext();
    setApartments(response.data?.apartments || []);
  }, [mode]);

  const loadConversations = useCallback(async () => {
    const params = {
      search: search || undefined,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      onlyUnread: onlyUnread ? 'true' : undefined,
      page: 1,
      limit: 50,
    };
    const response = mode === 'admin'
      ? await connectApi.adminConversations(params)
      : await connectApi.residentConversations(params);
    const rows = response.data?.items || [];
    setConversations(rows);
    setSelectedId((current) => conversationId || current || rows[0]?.id || '');
  }, [conversationId, mode, onlyUnread, search, statusFilter, typeFilter]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const response = mode === 'admin' ? await connectApi.adminConversation(id) : await connectApi.residentConversation(id);
      setDetail(response.data);
      if (mode === 'admin') {
        await connectApi.adminRead(id).catch(() => undefined);
      } else {
        await connectApi.residentRead(id).catch(() => undefined);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [mode]);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await Promise.all([loadOverview(), loadConversations(), loadRecipients()]);
    } catch {
      setError('Nu am putut încărca Espace Connect.');
    } finally {
      setLoading(false);
    }
  }, [loadConversations, loadOverview, loadRecipients]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId).catch(() => setError('Nu am putut încărca conversația.'));
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const interval = window.setInterval(() => {
      void loadConversations().catch(() => undefined);
      void loadDetail(selectedId).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadConversations, loadDetail, selectedId]);

  const kpis = useMemo(() => {
    if (mode === 'admin') {
      return [
        { label: 'Necitite', value: overview?.unreadCount || 0, icon: Inbox, tone: Number(overview?.unreadCount || 0) > 0 ? 'warning' : 'neutral' },
        { label: 'Deschise', value: overview?.openConversations || 0, icon: MessageCircle, tone: 'neutral' },
        { label: 'Așteaptă Admin', value: overview?.pendingAdminConversations || 0, icon: Clock3, tone: 'warning' },
        { label: 'Urgente', value: overview?.urgentConversations || 0, icon: XCircle, tone: Number(overview?.urgentConversations || 0) > 0 ? 'danger' : 'neutral' },
      ] as const;
    }
    return [
      { label: 'Necitite', value: overview?.unreadCount || 0, icon: Inbox, tone: Number(overview?.unreadCount || 0) > 0 ? 'warning' : 'neutral' },
      { label: 'Deschise', value: overview?.openConversations || 0, icon: MessageCircle, tone: 'neutral' },
      { label: 'Așteaptă răspuns', value: overview?.pendingAdminCount || 0, icon: Clock3, tone: 'warning' },
      { label: 'Rezolvate', value: overview?.resolvedCount || 0, icon: CheckCircle2, tone: 'success' },
    ] as const;
  }, [mode, overview]);

  function selectConversation(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, '', localizedPath(`${basePath}/${id}`));
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || isSending || isClosed) return;
    const body = composer.trim();
    const attachment = attachmentUrl.trim();
    if (!body && !attachment) return;
    setIsSending(true);
    setError('');
    try {
      const payload = {
        body: body || undefined,
        attachmentUrl: attachment || undefined,
        attachmentFileName: attachment ? attachment.split('/').pop() || 'Atașament' : undefined,
        messageType: attachment ? 'ATTACHMENT' : 'TEXT',
      };
      if (mode === 'admin') {
        await connectApi.adminSendMessage(selectedId, payload);
      } else {
        await connectApi.residentSendMessage(selectedId, payload);
      }
      setComposer('');
      setAttachmentUrl('');
      await Promise.all([loadConversations(), loadDetail(selectedId), loadOverview()]);
    } catch {
      setError('Nu am putut trimite mesajul.');
    } finally {
      setIsSending(false);
    }
  }

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.body.trim();
    if (!body) return;
    setIsSending(true);
    setError('');
    try {
      let response;
      if (mode === 'admin') {
        const [residentUserId, apartmentId] = draft.residentKey.split('|');
        response = await connectApi.adminCreateConversation({
          residentUserId,
          apartmentId,
          type: draft.type,
          priority: draft.priority,
          subject: draft.subject || undefined,
          body,
          relatedInvoiceId: draft.relatedInvoiceId || undefined,
          relatedServiceTicketId: draft.relatedServiceTicketId || undefined,
          relatedMeterReadingId: draft.relatedMeterReadingId || undefined,
          relatedPaymentProofId: draft.relatedPaymentProofId || undefined,
        });
      } else {
        response = await connectApi.residentCreateConversation({
          apartmentId: draft.apartmentId,
          type: draft.type,
          subject: draft.subject || undefined,
          body,
          relatedInvoiceId: draft.relatedInvoiceId || undefined,
          relatedServiceTicketId: draft.relatedServiceTicketId || undefined,
          relatedMeterReadingId: draft.relatedMeterReadingId || undefined,
          relatedPaymentProofId: draft.relatedPaymentProofId || undefined,
        });
      }
      const createdId = response.data?.conversation?.id || response.data?.id;
      setNewOpen(false);
      setDraft({
        residentKey: '',
        apartmentId: '',
        type: 'GENERAL',
        priority: 'NORMAL',
        subject: '',
        body: '',
        relatedInvoiceId: '',
        relatedServiceTicketId: '',
        relatedMeterReadingId: '',
        relatedPaymentProofId: '',
      });
      await refresh();
      if (createdId) selectConversation(createdId);
    } catch {
      setError('Nu am putut crea conversația.');
    } finally {
      setIsSending(false);
    }
  }

  async function updateAdminConversation(data: Record<string, unknown>) {
    if (!activeConversation || mode !== 'admin') return;
    await connectApi.adminUpdateConversation(activeConversation.id, data);
    await Promise.all([loadConversations(), loadDetail(activeConversation.id), loadOverview()]);
  }

  async function resolveOrClose(action: 'resolve' | 'close' | 'reopen') {
    if (!activeConversation || mode !== 'admin') return;
    if (action === 'resolve') await connectApi.adminResolve(activeConversation.id, { message: 'Conversația a fost marcată ca rezolvată.' });
    if (action === 'close') await connectApi.adminClose(activeConversation.id, { message: 'Conversația a fost închisă.' });
    if (action === 'reopen') await connectApi.adminReopen(activeConversation.id);
    await Promise.all([loadConversations(), loadDetail(activeConversation.id), loadOverview()]);
  }

  async function residentReopen() {
    if (!activeConversation || mode !== 'resident') return;
    await connectApi.residentReopen(activeConversation.id, { message: 'Aș vrea să redeschid această conversație.' });
    await Promise.all([loadConversations(), loadDetail(activeConversation.id), loadOverview()]);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={mode === 'admin' ? 'Espace Connect' : 'Mesaje'} description="Se încarcă conversațiile..." />
        <LoadingSkeleton variant="cards" rows={4} />
      </div>
    );
  }

  if (error && !conversations.length) {
    return <ErrorState title="Espace Connect nu este disponibil" message={error} retryLabel="Reîncearcă" onRetry={refresh} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace Connect"
        title={mode === 'admin' ? 'Espace Connect' : 'Mesaje'}
        description={
          mode === 'admin'
            ? 'Conversații cu locatarii, legate de apartamente, facturi și cereri.'
            : 'Discută cu administrația despre apartament, facturi sau cereri.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={refresh}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button type="button" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" />
              {mode === 'admin' ? 'Conversație nouă' : 'Mesaj nou'}
            </Button>
          </div>
        }
      />

      {error ? <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={String(item.value)}
            icon={<item.icon className="size-5" />}
            tone={item.tone}
          />
        ))}
      </div>

      <div className={`grid min-h-[650px] gap-4 ${mode === 'admin' ? 'xl:grid-cols-[340px_minmax(0,1fr)_320px]' : 'lg:grid-cols-[320px_minmax(0,1fr)]'}`}>
        <Card className="flex min-h-[520px] flex-col p-0">
          <div className="border-b border-border/70 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Caută conversații"
                className="pl-9"
                aria-label="Caută conversații"
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Status">
                <option value="">Toate statusurile</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Tip">
                <option value="">Toate tipurile</option>
                {adminTypeOptions.map((value) => (
                  <option key={value} value={value}>{typeLabels[value]}</option>
                ))}
              </Select>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-border/80 bg-card px-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyUnread}
                  onChange={(event) => setOnlyUnread(event.target.checked)}
                  className="size-4 rounded border-border text-primary"
                />
                Necitite
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    activeConversation?.id === conversation.id
                      ? 'border-primary/25 bg-accent/45'
                      : 'border-transparent hover:border-border/80 hover:bg-muted/45'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {conversation.resident?.initials || 'ES'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {mode === 'admin' ? conversation.resident?.name || 'Locatar' : conversation.subject || 'Conversație'}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(conversation.lastMessageAt)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {mode === 'admin' ? apartmentLabel(conversation.apartment) : conversation.subject || apartmentLabel(conversation.apartment)}
                      </span>
                      <span className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {conversation.lastMessagePreview || 'Nu există mesaje încă.'}
                      </span>
                      <span className="mt-3 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={statusBadgeMap[conversation.status]} label={statusLabels[conversation.status]} size="sm" dot />
                        <Badge variant="neutral">{typeLabels[conversation.type]}</Badge>
                        {Number(conversation.unreadCount || 0) > 0 ? <Badge variant="warning">{conversation.unreadCount} noi</Badge> : null}
                      </span>
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                icon={<Inbox className="size-6" />}
                title="Nu există conversații"
                description="Conversațiile reale vor apărea aici după ce sunt create."
                action={
                  <Button type="button" onClick={() => setNewOpen(true)}>
                    <Plus className="size-4" />
                    {mode === 'admin' ? 'Conversație nouă' : 'Mesaj nou'}
                  </Button>
                }
              />
            )}
          </div>
        </Card>

        <Card className="flex min-h-[650px] flex-col overflow-hidden p-0">
          {activeConversation ? (
            <>
              <div className="border-b border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight text-foreground">
                        {activeConversation.subject || 'Conversație'}
                      </h2>
                      <StatusBadge status={statusBadgeMap[activeConversation.status]} label={statusLabels[activeConversation.status]} size="sm" dot />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {mode === 'admin'
                        ? `${activeConversation.resident?.name || 'Locatar'} · ${apartmentLabel(activeConversation.apartment)}`
                        : apartmentLabel(activeConversation.apartment)}
                    </p>
                  </div>
                  {mode === 'admin' ? (
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={activeConversation.priority}
                        onChange={(event) => void updateAdminConversation({ priority: event.target.value })}
                        aria-label="Prioritate"
                        className="h-9 min-w-32"
                      >
                        {priorityOptions.map((value) => (
                          <option key={value} value={value}>{priorityLabels[value]}</option>
                        ))}
                      </Select>
                      {activeConversation.status === 'CLOSED' ? (
                        <Button type="button" variant="secondary" onClick={() => void resolveOrClose('reopen')}>
                          <RotateCcw className="size-4" />
                          Redeschide
                        </Button>
                      ) : (
                        <>
                          <Button type="button" variant="secondary" onClick={() => void resolveOrClose('resolve')}>
                            <CheckCircle2 className="size-4" />
                            Rezolvă
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => void resolveOrClose('close')}>
                            <XCircle className="size-4" />
                            Închide
                          </Button>
                        </>
                      )}
                    </div>
                  ) : activeConversation.status === 'CLOSED' || activeConversation.status === 'RESOLVED' ? (
                    <Button type="button" variant="secondary" onClick={() => void residentReopen()}>
                      <RotateCcw className="size-4" />
                      Redeschide
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
                {detailLoading ? (
                  <LoadingSkeleton variant="cards" rows={3} />
                ) : detail?.messages?.length ? (
                  detail.messages.map((message) => (
                    <MessageBubble key={message.id} mode={mode} message={message} />
                  ))
                ) : (
                  <EmptyState
                    icon={<MessageCircle className="size-6" />}
                    title="Nu există mesaje încă"
                    description="Scrie primul mesaj pentru a începe conversația."
                  />
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-border/70 bg-card p-4">
                {isClosed ? (
                  <div className="rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Conversația este închisă. Redeschide conversația pentru a continua.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      placeholder={mode === 'admin' ? 'Scrie un răspuns pentru locatar...' : 'Scrie un mesaj către administrație...'}
                      rows={3}
                      aria-label="Mesaj"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Paperclip className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={attachmentUrl}
                          onChange={(event) => setAttachmentUrl(event.target.value)}
                          placeholder="URL atașament opțional"
                          className="pl-9"
                          aria-label="URL atașament"
                        />
                      </div>
                      <Button type="submit" disabled={isSending || (!composer.trim() && !attachmentUrl.trim())}>
                        <Send className="size-4" />
                        Trimite
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Nu include date sensibile inutile.</p>
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center p-6">
              <EmptyState
                icon={<MessageCircle className="size-6" />}
                title="Selectează o conversație"
                description="Alege o conversație din inbox sau creează una nouă."
              />
            </div>
          )}
        </Card>

        {mode === 'admin' ? <AdminContextPanel detail={detail} onNote={(note) => void updateAdminConversation({ internalNote: note })} /> : null}
        {mode === 'resident' ? <ResidentContextPanel detail={detail} /> : null}
      </div>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} maxWidth="2xl">
        <ModalHeader title={mode === 'admin' ? 'Conversație nouă' : 'Mesaj nou'} onClose={() => setNewOpen(false)} />
        <form onSubmit={createConversation}>
          <ModalBody className="space-y-4">
            {mode === 'admin' ? (
              <Select
                label="Locatar"
                value={draft.residentKey}
                onChange={(event) => setDraft((current) => ({ ...current, residentKey: event.target.value }))}
                required
              >
                <option value="">Alege locatarul</option>
                {recipients.map((recipient) => (
                  <option key={`${recipient.residentUserId}|${recipient.apartment?.id || ''}`} value={`${recipient.residentUserId}|${recipient.apartment?.id || ''}`}>
                    {recipient.name} · {apartmentLabel(recipient.apartment)}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                label="Apartament"
                value={draft.apartmentId}
                onChange={(event) => setDraft((current) => ({ ...current, apartmentId: event.target.value }))}
                required
              >
                <option value="">Alege apartamentul</option>
                {apartments.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>{apartmentLabel(apartment)}</option>
                ))}
              </Select>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Tip conversație"
                value={draft.type}
                onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as ConversationType }))}
              >
                {(mode === 'admin' ? adminTypeOptions : typeOptions).map((value) => (
                  <option key={value} value={value}>{typeLabels[value]}</option>
                ))}
              </Select>
              {mode === 'admin' ? (
                <Select
                  label="Prioritate"
                  value={draft.priority}
                  onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as Priority }))}
                >
                  {priorityOptions.map((value) => (
                    <option key={value} value={value}>{priorityLabels[value]}</option>
                  ))}
                </Select>
              ) : null}
            </div>
            <Input
              label="Subiect"
              value={draft.subject}
              onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
              placeholder={mode === 'admin' ? 'Întrebare despre factura lunii' : 'Întrebare pentru administrație'}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="ID factură opțional"
                value={draft.relatedInvoiceId}
                onChange={(event) => setDraft((current) => ({ ...current, relatedInvoiceId: event.target.value }))}
              />
              <Input
                label="ID cerere opțional"
                value={draft.relatedServiceTicketId}
                onChange={(event) => setDraft((current) => ({ ...current, relatedServiceTicketId: event.target.value }))}
              />
              <Input
                label="ID citire opțional"
                value={draft.relatedMeterReadingId}
                onChange={(event) => setDraft((current) => ({ ...current, relatedMeterReadingId: event.target.value }))}
              />
              <Input
                label="ID dovadă plată opțional"
                value={draft.relatedPaymentProofId}
                onChange={(event) => setDraft((current) => ({ ...current, relatedPaymentProofId: event.target.value }))}
              />
            </div>
            <Textarea
              label="Primul mesaj"
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              rows={5}
              required
            />
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
              Anulează
            </Button>
            <Button type="submit" disabled={isSending || !draft.body.trim() || (mode === 'admin' ? !draft.residentKey : !draft.apartmentId)}>
              <Send className="size-4" />
              Creează conversația
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}

function MessageBubble({ mode, message }: { mode: ConnectMode; message: ConnectMessage }) {
  if (message.senderRole === 'SYSTEM' || message.messageType === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <span className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
          {message.body || 'Actualizare de sistem'}
        </span>
      </div>
    );
  }

  const mine = mode === 'admin'
    ? message.senderRole === 'ADMIN' || message.senderRole === 'SUPERADMIN'
    : message.senderRole === 'RESIDENT';

  return (
    <div className={`flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine ? (
        <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary shadow-sm">
          {message.senderInitials || 'ES'}
        </span>
      ) : null}
      <div className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-card ${mine ? 'bg-primary text-primary-foreground' : 'border border-border/80 bg-card text-foreground'}`}>
        {!mine ? <p className="mb-1 text-xs font-semibold text-muted-foreground">{message.senderName || 'Utilizator'}</p> : null}
        {message.body ? <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p> : null}
        {message.attachmentUrl ? (
          <a
            href={message.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-border bg-muted/45 text-foreground'}`}
          >
            <Paperclip className="size-3.5" />
            {message.attachmentFileName || 'Atașament'}
          </a>
        ) : null}
        <p className={`mt-2 text-[11px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>
          {formatDateTime(message.createdAt)} · {messageReceipt(message)}
        </p>
      </div>
    </div>
  );
}

function AdminContextPanel({ detail, onNote }: { detail: DetailPayload | null; onNote: (note: string) => void }) {
  const [note, setNote] = useState('');

  useEffect(() => {
    setNote(detail?.conversation?.internalNote || '');
  }, [detail?.conversation?.internalNote]);

  if (!detail?.conversation) {
    return (
      <Card className="hidden p-5 xl:block">
        <EmptyState title="Context conversație" description="Selectează o conversație pentru detalii." />
      </Card>
    );
  }

  const context = detail.context || {};
  const conversation = detail.conversation;
  return (
    <Card className="hidden min-h-[650px] overflow-hidden p-0 xl:block">
      <div className="border-b border-border/70 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Context</h3>
        <p className="mt-2 text-lg font-semibold text-foreground">{conversation.resident?.name || 'Locatar'}</p>
        <p className="text-sm text-muted-foreground">{apartmentLabel(conversation.apartment)}</p>
      </div>
      <div className="space-y-4 p-5">
        <ContextSection icon={<UserRound className="size-4" />} title="Locatar">
          <InfoLine label="Email" value={conversation.resident?.email || 'Nesetat'} />
          <InfoLine label="Telefon" value={conversation.resident?.phone || 'Nesetat'} />
        </ContextSection>
        <ContextSection icon={<Home className="size-4" />} title="Apartament">
          <InfoLine label="Apartament" value={apartmentLabel(conversation.apartment)} />
        </ContextSection>
        {detail.relatedSummary ? (
          <ContextSection icon={<FileText className="size-4" />} title="Legat de">
            <InfoLine label="Tip" value={typeLabels[(detail.relatedSummary.type || conversation.type) as ConversationType] || detail.relatedSummary.type} />
            <InfoLine label="Status" value={detail.relatedSummary.status || '-'} />
          </ContextSection>
        ) : null}
        <ContextSection icon={<WalletCards className="size-4" />} title="Facturi neachitate">
          {context.unpaidInvoices?.length ? (
            context.unpaidInvoices.map((invoice: any) => (
              <div key={invoice.id} className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber || 'Factură'}</p>
                <p className="text-xs text-muted-foreground">{money(invoice.total, invoice.currency || 'MDL')}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nu sunt facturi restante în context.</p>
          )}
        </ContextSection>
        <ContextSection icon={<Gauge className="size-4" />} title="Ultimele citiri">
          {context.latestMeterReadings?.length ? (
            context.latestMeterReadings.slice(0, 3).map((reading: any) => (
              <InfoLine key={reading.id} label={reading.meter?.serialNumber || 'Contor'} value={String(reading.value)} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nu există citiri recente.</p>
          )}
        </ContextSection>
        <ContextSection icon={<MessageCircle className="size-4" />} title="Acțiuni rapide">
          <div className="grid gap-2">
            {(context.quickActions || []).map((action: any) => (
              <ButtonLink key={action.href} href={action.href} variant="secondary" size="sm">
                {action.label}
              </ButtonLink>
            ))}
          </div>
        </ContextSection>
        <ContextSection icon={<FileText className="size-4" />} title="Notă internă">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
          <Button type="button" variant="secondary" size="sm" onClick={() => onNote(note)}>
            Salvează nota
          </Button>
        </ContextSection>
      </div>
    </Card>
  );
}

function ResidentContextPanel({ detail }: { detail: DetailPayload | null }) {
  if (!detail?.conversation) return null;
  const conversation = detail.conversation;
  return (
    <Card className="lg:hidden">
      <ContextSection icon={<Home className="size-4" />} title="Context">
        <InfoLine label="Apartament" value={apartmentLabel(conversation.apartment)} />
        <InfoLine label="Subiect" value={conversation.subject || 'Mesaj'} />
        <InfoLine label="Status" value={statusLabels[conversation.status]} />
      </ContextSection>
    </Card>
  );
}

function ContextSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
