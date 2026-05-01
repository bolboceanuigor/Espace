'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Search, Send } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import Button from '@/components/ui/Button';

export type InboxConversation = {
  id: string;
  name: string;
  preview: string;
  createdAt?: string;
  unread?: boolean;
  meta?: string;
};

export type InboxMessage = {
  id: string;
  content: string;
  createdAt: string;
  mine?: boolean;
  senderName?: string;
};

type MesajePageProps = {
  description: string;
  loadConversations: () => Promise<InboxConversation[]>;
  loadMessages: (conversationId: string) => Promise<InboxMessage[]>;
  sendMessage?: (conversationId: string, content: string) => Promise<InboxMessage | null | void>;
};

const FALLBACK_CONVERSATIONS: InboxConversation[] = [
  {
    id: 'local-general',
    name: 'Administrație',
    preview: 'Bun venit în modulul de mesaje.',
    createdAt: new Date().toISOString(),
    unread: true,
    meta: 'Suport',
  },
  {
    id: 'local-community',
    name: 'Comunitate',
    preview: 'Aici vor apărea discuțiile comunității.',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    unread: false,
    meta: 'General',
  },
];

const FALLBACK_MESSAGES: Record<string, InboxMessage[]> = {
  'local-general': [
    {
      id: 'm-1',
      senderName: 'Administrație',
      content: 'Bun venit! Poți folosi acest spațiu pentru întrebări rapide.',
      createdAt: new Date().toISOString(),
    },
  ],
  'local-community': [
    {
      id: 'm-2',
      senderName: 'Comunitate',
      content: 'Mesajele comunității vor fi afișate aici.',
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
  ],
};

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(date);
}

function localMessage(content: string): InboxMessage {
  return {
    id: `local-${Date.now()}`,
    content,
    createdAt: new Date().toISOString(),
    mine: true,
    senderName: 'Tu',
  };
}

export default function MesajePage({ description, loadConversations, loadMessages, sendMessage }: MesajePageProps) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, InboxMessage[]>>({});
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const rows = await loadConversations();
        if (!active) return;
        const next = rows;
        setConversations(next);
        setSelectedId((current) => current || next[0]?.id || '');
      } catch {
        if (!active) return;
        setConversations(FALLBACK_CONVERSATIONS);
        setMessagesByConversation(FALLBACK_MESSAGES);
        setSelectedId('local-general');
        setError('Nu am putut încărca mesajele din API. Afișăm temporar conversații locale.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId || messagesByConversation[selectedId]) return;
    let active = true;
    loadMessages(selectedId)
      .then((rows) => {
        if (!active) return;
        setMessagesByConversation((current) => ({ ...current, [selectedId]: rows.length ? rows : FALLBACK_MESSAGES[selectedId] || [] }));
      })
      .catch(() => {
        if (!active) return;
        setMessagesByConversation((current) => ({ ...current, [selectedId]: FALLBACK_MESSAGES[selectedId] || [] }));
      });
    return () => {
      active = false;
    };
  }, [loadMessages, messagesByConversation, selectedId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((item) => `${item.name} ${item.preview} ${item.meta || ''}`.toLowerCase().includes(needle));
  }, [conversations, query]);

  const selected = conversations.find((item) => item.id === selectedId) || null;
  const messages = selectedId ? messagesByConversation[selectedId] || [] : [];

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedId || !content) return;
    setSending(true);
    const fallback = localMessage(content);
    try {
      const created = sendMessage ? await sendMessage(selectedId, content) : null;
      setMessagesByConversation((current) => ({
        ...current,
        [selectedId]: [...(current[selectedId] || []), created || fallback],
      }));
    } catch {
      setMessagesByConversation((current) => ({
        ...current,
        [selectedId]: [...(current[selectedId] || []), fallback],
      }));
      setError('Mesajul a fost adăugat local. Trimiterea prin API nu este disponibilă momentan.');
    } finally {
      setDraft('');
      setSending(false);
    }
  }

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:space-y-6 md:pb-8">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          Inbox
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Mesaje</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
      </section>

      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}
      {loading ? <LoadingState label="Se încarcă mesajele..." /> : null}

      {!loading && !conversations.length ? <EmptyState title="Nu există mesaje încă." /> : null}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-[1.35rem] border border-border/70 bg-white/90 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <label className="mb-3 flex h-11 items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută conversații"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
            />
          </label>
          <div className="space-y-2">
            {filtered.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setConversations((current) => current.map((item) => (item.id === conversation.id ? { ...item, unread: false } : item)));
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === conversation.id ? 'border-foreground/20 bg-muted/70' : 'border-border/60 bg-white/60 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{conversation.name}</p>
                  <span className="text-[11px] text-muted-foreground">{formatTime(conversation.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{conversation.preview}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{conversation.meta}</span>
                  {conversation.unread ? <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Necitit" /> : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="border-b border-border/70 p-4">
            <h2 className="text-base font-semibold text-foreground">{selected?.name || 'Selectează o conversație'}</h2>
            {selected?.meta ? <p className="text-sm text-muted-foreground">{selected.meta}</p> : null}
          </div>
          <div className="min-h-[380px] space-y-3 p-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.mine ? 'bg-foreground text-background shadow-[0_12px_30px_rgba(15,23,42,0.14)]' : 'bg-muted/75 text-foreground'}`}>
                  <p className="mb-1 text-[11px] opacity-70">{message.senderName || 'Utilizator'} • {formatTime(message.createdAt)}</p>
                  <p className="leading-6">{message.content}</p>
                </div>
              </div>
            ))}
            {!messages.length ? <p className="text-sm text-muted-foreground">Nu există mesaje încă.</p> : null}
          </div>
          <form onSubmit={handleSend} className="flex gap-2 border-t border-border/70 p-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Scrie un mesaj..."
              className="input min-w-0 flex-1"
              disabled={!selectedId}
            />
            <Button type="submit" isLoading={sending} disabled={!selectedId || !draft.trim()}>
              <Send className="h-4 w-4" />
              Trimite
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
