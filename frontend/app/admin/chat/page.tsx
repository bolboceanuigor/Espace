'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Search, Send } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui';
import { getStoredUser } from '@/lib/auth';
import { messagesMvpApi } from '@/lib/api';

type Thread = {
  id: string;
  subject: string;
  apartmentNumber?: string | null;
  residentName?: string | null;
  preview?: string | null;
  lastMessageAt?: string | null;
  messages: Array<{
    id: string;
    senderId?: string;
    senderName?: string | null;
    senderRole?: string | null;
    content: string;
    createdAt: string;
  }>;
};

export default function AdminChatPage() {
  const storedUser = getStoredUser();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState<'loading' | 'api' | 'unavailable'>('loading');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return threads.filter((item) => !needle || `${item.residentName || ''} ${item.apartmentNumber || ''} ${item.preview || ''}`.toLowerCase().includes(needle));
  }, [query, threads]);

  const selected = threads.find((item) => item.id === selectedId) ?? threads[0] ?? null;

  const loadThreads = async () => {
    const res = await messagesMvpApi.adminList();
    const nextThreads = res.data || [];
    setThreads(nextThreads);
    setSelectedId((current) => current || nextThreads[0]?.id || '');
    setSource('api');
  };

  useEffect(() => {
    let active = true;
    loadThreads().catch(() => {
      if (!active) return;
      setThreads([]);
      setSource('unavailable');
      setError('Mesageria este indisponibilă temporar.');
    });
    return () => {
      active = false;
    };
  }, []);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selected || source !== 'api') return;
    setError('');
    setIsSending(true);
    try {
      const res = await messagesMvpApi.adminSend({ threadId: selected.id, content });
      setThreads((current) => current.map((thread) => (thread.id === res.data.id ? res.data : thread)));
      setDraft('');
    } catch {
      setError('Nu am putut trimite mesajul.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Mesaje"
        description="Conversații directe cu locatarii."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {source === 'loading' ? 'Se încarcă...' : source === 'api' ? 'Date reale' : 'API indisponibil temporar'}
          </span>
        }
      />

      {error ? (
        <Card className="border-rose-200 bg-rose-50/70 p-4 text-sm font-semibold text-rose-700">
          {error}
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută conversații" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="mt-3 grid gap-2">
            {filtered.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedId(thread.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  selected?.id === thread.id ? 'border-foreground/20 bg-muted/70' : 'border-border/60 bg-white hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{thread.residentName || 'Locatar'}</p>
                  <span className="text-[11px] text-muted-foreground">{thread.lastMessageAt ? formatTime(thread.lastMessageAt) : ''}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{thread.apartmentNumber ? `Apt. ${thread.apartmentNumber}` : 'Apartament'}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{thread.preview || 'Fără mesaje încă.'}</p>
              </button>
            ))}
            {source === 'loading' ? <p className="rounded-2xl bg-muted/35 p-3 text-sm text-muted-foreground">Se încarcă datele...</p> : null}
            {source === 'api' && !filtered.length ? <p className="rounded-2xl bg-muted/35 p-3 text-sm text-muted-foreground">Nu există conversații încă.</p> : null}
            {source === 'unavailable' ? <p className="rounded-2xl bg-muted/35 p-3 text-sm text-muted-foreground">Mesageria este în lucru sau API-ul nu este disponibil temporar.</p> : null}
          </div>
        </Card>

        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="border-b border-border/70 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <MessageCircle className="h-4 w-4" />
              {selected?.residentName || 'Conversație'}
            </h2>
            <p className="text-sm text-muted-foreground">{selected?.apartmentNumber ? `Apt. ${selected.apartmentNumber}` : 'Selectează o conversație'}</p>
          </div>

          <div className="min-h-[420px] space-y-3 bg-muted/20 p-4">
            {selected?.messages?.map((message) => {
              const mine = message.senderId === storedUser?.id || String(message.senderRole || '').toUpperCase() === 'ADMIN';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? 'bg-foreground text-background' : 'bg-white text-foreground'}`}>
                    <p className="mb-1 text-[11px] opacity-70">{mine ? 'Administrație' : message.senderName || 'Locatar'} · {formatTime(message.createdAt)}</p>
                    <p className="leading-6">{message.content}</p>
                  </div>
                </div>
              );
            })}
            {source === 'api' && selected && !selected.messages?.length ? <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">Nu există mesaje în conversație.</p> : null}
            {source === 'api' && !selected ? <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">Nu există conversații încă.</p> : null}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border/70 p-3">
            <Input className="min-w-0 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Scrie un mesaj..." disabled={!selected || source !== 'api'} />
            <Button type="submit" disabled={!draft.trim() || !selected || isSending || source !== 'api'}><Send className="h-4 w-4" /> {isSending ? 'Se trimite...' : 'Trimite'}</Button>
          </form>
        </section>
      </div>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
