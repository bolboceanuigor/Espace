'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button, Card, Input, PageHeader } from '@/components/ui';
import { getStoredUser } from '@/lib/auth';
import { messagesMvpApi, residentDemoApi } from '@/lib/api';
import { normalizeResidentContext } from '@/lib/resident-mvp-data';

type Thread = {
  id: string;
  subject: string;
  apartmentNumber?: string | null;
  apartment?: { number?: string | null; staircase?: { name?: string | null } | null } | null;
  messages: Array<{
    id: string;
    senderId?: string;
    senderName?: string | null;
    senderRole?: string | null;
    content: string;
    createdAt: string;
  }>;
};

export default function ResidentChatPage() {
  const storedUser = getStoredUser();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState<ReturnType<typeof normalizeResidentContext> | null>(null);
  const [source, setSource] = useState<'loading' | 'api' | 'unavailable'>('loading');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const activeThread = useMemo(() => threads[0] || null, [threads]);

  const loadThreads = async () => {
    const [threadRes, contextRes] = await Promise.all([
      messagesMvpApi.residentList(),
      residentDemoApi.context().catch(() => ({ data: null })),
    ]);
    setThreads(threadRes.data || []);
    if (contextRes.data) setContext(normalizeResidentContext(contextRes.data));
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
    if (!content || source !== 'api') return;
    setError('');
    setIsSending(true);
    try {
      const res = await messagesMvpApi.residentSend({ content });
      setThreads((current) => [res.data, ...current.filter((thread) => thread.id !== res.data.id)]);
      setDraft('');
    } catch {
      setError('Nu am putut trimite mesajul.');
    } finally {
      setIsSending(false);
    }
  };

  const apartmentLabel = context
    ? [context.apartment, context.staircase].filter(Boolean).join(' · ')
    : activeThread?.apartment?.number
      ? `Apt. ${activeThread.apartment.number}`
      : 'Apartament';

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Mesaje"
        description="Discuție simplă cu administrația A.P.C."
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

      <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
        <div className="border-b border-border/70 p-4">
          <h2 className="inline-flex items-center gap-2 font-semibold text-foreground">
            <MessageCircle className="h-4 w-4" />
            Administrație
          </h2>
          <p className="text-sm text-muted-foreground">
            {source === 'loading' ? 'Se încarcă conversația...' : apartmentLabel}
          </p>
        </div>
        <div className="min-h-[460px] space-y-3 bg-muted/20 p-4">
          {activeThread?.messages?.map((message) => {
            const mine = message.senderId === storedUser?.id || String(message.senderRole || '').toUpperCase() === 'RESIDENT';
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? 'bg-foreground text-background' : 'bg-white text-foreground'}`}>
                  <p className="mb-1 text-[11px] opacity-70">{mine ? 'Tu' : message.senderName || 'Administrație'} · {formatTime(message.createdAt)}</p>
                  <p className="leading-6">{message.content}</p>
                </div>
              </div>
            );
          })}
          {source === 'loading' ? <p className="text-sm text-muted-foreground">Se încarcă datele...</p> : null}
          {source === 'api' && !activeThread?.messages?.length ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">
              Nu există mesaje încă. Scrie administrației A.P.C. pentru a începe conversația.
            </p>
          ) : null}
          {source === 'unavailable' ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">
              Mesageria este în lucru sau API-ul nu este disponibil temporar.
            </p>
          ) : null}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border/70 p-3">
          <Input className="min-w-0 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Scrie un mesaj..." disabled={source !== 'api'} />
          <Button type="submit" disabled={!draft.trim() || isSending || source !== 'api'}><Send className="h-4 w-4" /> {isSending ? 'Se trimite...' : 'Trimite'}</Button>
        </form>
      </section>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
